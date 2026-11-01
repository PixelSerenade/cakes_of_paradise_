const crypto = require('crypto');
const Order = require('../models/Order');
const Product = require('../models/Product');
const razorpay = require('../services/razorpay');
const { orderConfirmation, orderUpdate } = require('../services/orderEmail');
const { sendPaymentConfirmation, sendOrderShipped } = require('../services/notificationEmails');
const { resolveCheckoutBenefits } = require('./commerceController');
const { resolveDelivery } = require('./deliveryController');
const PromoCode = require('../models/PromoCode');
const GiftCard = require('../models/GiftCard');
const GiftCardTransaction = require('../models/GiftCardTransaction');
const { expandCakeSizes } = require('../utils/cakeSizes');
const { withCategoryMatchedImage } = require('../utils/productImages');
const LoyaltyTransaction = require('../models/LoyaltyTransaction');
const GiftWalletTransaction = require('../models/GiftWalletTransaction');
const User = require('../models/User');
const StorePolicy = require('../models/StorePolicy');
const ReferralClaim = require('../models/ReferralClaim');
const { getReferralRewards } = require('../utils/referralRewards');
const { isSaleEligible, saleMatch } = require('../utils/orderMetrics');

const ORDER_STATUSES = ['placed', 'confirmed', 'preparing', 'ready', 'shipped', 'out-for-delivery', 'completed', 'cancelled'];
const OFFLINE_PAYMENT_METHODS = ['pay-at-pickup', 'pay-on-delivery', 'pay-at-store'];
const isUnpaid = (status) => ['unpaid', 'pending', 'failed'].includes(String(status || '').toLowerCase());
const visibleOrder = (order) => order.toObject ? order.toObject() : order;

const recordActivity = (order, { type = 'status', status = order.status, from = '', to = '', note = '', changedBy = 'system' }) => {
  order.tracking.push({ type, status, from, to, note: String(note || '').trim().slice(0, 240), changedBy });
};

const markOfflinePaymentReceived = async (order, changedBy) => {
  if (!OFFLINE_PAYMENT_METHODS.includes(order.paymentMethod)) throw new Error('Only Pay at Pickup and Pay on Delivery orders can be marked paid by an admin.');
  if (order.status === 'cancelled') throw new Error('Cancelled orders cannot be marked paid.');
  if (!isUnpaid(order.paymentStatus)) return false;
  const previousPaymentStatus = order.paymentStatus;
  order.paymentStatus = 'paid';
  order.paidAt = new Date();
  order.paidBy = changedBy;
  recordActivity(order, { type: 'payment', from: previousPaymentStatus, to: 'paid', note: 'Payment received and recorded by admin', changedBy });
  return true;
};

const createOrder = async (req, res) => {
  const { items, customer, promoCode, giftCardCode } = req.body;
  let { paymentMethod } = req.body;
  const loyaltyPointsRedeemed = Number(req.body.loyaltyPoints || 0);
  const giftWalletAmount = Number(req.body.giftWalletAmount || 0);
  if (!Array.isArray(items) || items.length < 1 || items.length > 10) {
    return res.status(400).json({ message: 'Choose between 1 and 10 cake items.' });
  }
  if (!customer || typeof customer !== 'object' || Array.isArray(customer)) {
    return res.status(400).json({ message: 'Add delivery details to place your order.' });
  }
  if (customer.name !== undefined && typeof customer.name !== 'string' || typeof customer.phone !== 'string' ||
      customer.address !== undefined && typeof customer.address !== 'string' || typeof customer.deliveryDate !== 'string' || typeof customer.deliveryTime !== 'string' ||
      customer.notes !== undefined && typeof customer.notes !== 'string') {
    return res.status(400).json({ message: 'Delivery details have an invalid format.' });
  }
  const name = String(customer.name || req.user.name).trim();
  const phone = String(customer.phone || '').trim();
  const deliveryType = customer.deliveryType === 'pickup' ? 'pickup' : 'delivery';
  const area = String(customer.area || '').trim();
  const city = String(customer.city || '').trim();
  const postalCode = String(customer.postalCode || '').trim();
  const address = deliveryType === 'pickup' ? 'Bakery pickup' : String(customer.address || '').trim();
  const notes = String(customer.notes || '').trim();
  const deliveryDate = new Date(customer.deliveryDate);
  const deliveryTime = customer.deliveryTime.trim();
  const todayInIndia = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const deliveryDateText = /^\d{4}-\d{2}-\d{2}$/.test(customer.deliveryDate) ? customer.deliveryDate : '';
  if (!name || name.length > 100 || phone.replace(/\D/g, '').length < 7 || phone.length > 24 ||
      (deliveryType === 'delivery' && (address.length < 8 || address.length > 400 || !area || area.length > 80 || !city || city.length > 80 || !/^\d{6}$/.test(postalCode))) || notes.length > 300 ||
      Number.isNaN(deliveryDate.getTime()) || !deliveryDateText || deliveryDate.toISOString().slice(0, 10) !== deliveryDateText || deliveryDateText <= todayInIndia || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(deliveryTime)) {
    return res.status(400).json({ message: 'Provide valid customer details, a delivery date at least one day ahead, and a requested delivery or pickup time.' });
  }
  if (!['razorpay', 'pay-at-pickup', 'pay-on-delivery', 'pay-at-store'].includes(paymentMethod)) {
    return res.status(400).json({ message: 'Choose Online Payment, Pay at Pickup, or Pay on Delivery.' });
  }
  if (paymentMethod === 'pay-at-store') paymentMethod = deliveryType === 'pickup' ? 'pay-at-pickup' : 'pay-on-delivery';
  if (paymentMethod === 'pay-at-pickup' && deliveryType !== 'pickup') return res.status(400).json({ message: 'Pay at Pickup is available only when collecting your cake from the bakery.' });
  if (paymentMethod === 'pay-on-delivery' && deliveryType !== 'delivery') return res.status(400).json({ message: 'Pay on Delivery is available only for delivery orders.' });
  let delivery;
  try { delivery = await resolveDelivery(deliveryType, area, city, postalCode); }
  catch (error) { return res.status(400).json({ message: error.message }); }

  const orderItems = [];
  const productIds = [...new Set(items.map((item) => String(item.productId || '')))];
  const products = await Product.find({ slug: { $in: productIds }, available: true });
  for (const item of items) {
    const product = products.find((candidate) => candidate.slug === item.productId);
    const size = product && expandCakeSizes(product).find((candidate) => candidate.name === item.size);
    const quantity = Number(item.quantity);
    if (!product || !size || !product.flavors.includes(item.flavor) || item.cakeMessage !== undefined && (typeof item.cakeMessage !== 'string' || item.cakeMessage.length > 50) || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      return res.status(400).json({ message: 'One of the cake choices is invalid. Please refresh the catalogue and try again.' });
    }
    if (product.stock !== undefined && product.stock < quantity) {
      return res.status(409).json({ message: `"${product.name}" only has ${product.stock} in stock. Please adjust your quantity.` });
    }
    orderItems.push({
      productId: product.slug,
      name: product.name,
      image: withCategoryMatchedImage(product).image,
      flavor: item.flavor,
      size: size.name,
      cakeMessage: String(item.cakeMessage || '').trim(),
      unitPrice: size.price,
      quantity,
    });
  }
  const subtotal = orderItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  if (!Number.isSafeInteger(loyaltyPointsRedeemed) || loyaltyPointsRedeemed < 0 || loyaltyPointsRedeemed % 100 !== 0) return res.status(400).json({ message: 'Redeem reward points in 100-point steps (100 points = ₹1).' });
  let promoPreview;
  try { promoPreview = await resolveCheckoutBenefits(promoCode, '', subtotal, delivery.fee, 0, req.user._id); }
  catch (error) { return res.status(400).json({ message: error.message }); }
  const pointsLimit = Math.floor(Math.min(Number(req.user.loyaltyPoints || 0), Math.floor(Math.max(0, subtotal - promoPreview.discount) * 0.2) * 100) / 100) * 100;
  if (loyaltyPointsRedeemed > pointsLimit) return res.status(400).json({ message: `You can redeem up to ${pointsLimit} points on this order.` });
  const loyaltyDiscount = loyaltyPointsRedeemed / 100;
  let benefits;
  try { benefits = await resolveCheckoutBenefits(promoCode, giftCardCode, subtotal, delivery.fee, loyaltyDiscount, req.user._id); }
  catch (error) { return res.status(400).json({ message: error.message }); }
  const total = subtotal - benefits.discount - loyaltyDiscount + delivery.fee - benefits.giftAmount;
  if (!Number.isSafeInteger(giftWalletAmount) || giftWalletAmount < 0 || giftWalletAmount > Number(req.user.giftWalletBalance || 0) || giftWalletAmount > total) return res.status(400).json({ message: 'Choose a valid gift wallet amount within your available balance and order total.' });
  const payableTotal = total - giftWalletAmount;
  if (payableTotal > 0 && paymentMethod === 'razorpay' && !razorpay.isConfigured()) {
    return res.status(503).json({ message: `${razorpay.unavailableReason()} Please choose an offline payment method or contact us.` });
  }
  const orderNumber = `CP-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const paidAt = payableTotal === 0 ? new Date() : null;
  const order = new Order({
    orderNumber,
    user: req.user._id,
    customer: { name, email: req.user.email, phone, address, area, city, postalCode, deliveryType, deliveryDate, deliveryTime, notes },
    items: orderItems,
    total: payableTotal, subtotal,
    deliveryFee: delivery.fee,
    deliveryDistanceBand: delivery.distanceBand,
    loyaltyPointsRedeemed,
    discountAmount: benefits.discount,
    promoCode: benefits.promo?.code || '',
    referralCode: benefits.referral?.code || '',
    giftCardAmount: benefits.giftAmount,
    giftWalletAmount,
    giftCardLast4: benefits.giftCard?.codeLast4 || '',
    giftCardRef: benefits.giftCard?._id || null,
    paymentStatus: payableTotal === 0 ? 'paid' : 'unpaid',
    paymentMethod,
    paidAt,
    paidBy: payableTotal === 0 ? 'Gift wallet and discounts' : '',
    status: payableTotal === 0 ? 'confirmed' : 'placed',
    tracking: [
      { type: 'status', status: payableTotal === 0 ? 'confirmed' : 'placed', from: '', to: payableTotal === 0 ? 'confirmed' : 'placed', note: payableTotal === 0 ? 'Confirmed; the order total is covered by wallet and discounts' : 'Order received', changedBy: payableTotal === 0 ? 'Gift wallet' : req.user.name },
      { type: 'payment', status: payableTotal === 0 ? 'confirmed' : 'placed', from: '', to: payableTotal === 0 ? 'paid' : 'unpaid', note: payableTotal === 0 ? 'Covered by gift wallet and discounts' : 'Payment is due', changedBy: payableTotal === 0 ? 'Gift wallet' : req.user.name },
    ],
  });

  let payment;
  if (paymentMethod === 'razorpay' && payableTotal > 0) {
    try {
      payment = await razorpay.createOrder(payableTotal, orderNumber, order.customer);
      order.paymentOrderId = payment.id;
    } catch (error) {
      console.error(`Razorpay order creation failed: ${error.message}`);
      return res.status(502).json({ message: 'Could not start online checkout. Please try again or choose pay at the bakery.' });
    }
  }

  await order.save();
  for (const item of orderItems) {
    await Product.updateOne({ slug: item.productId, stock: { $gte: item.quantity } }, { $inc: { stock: -item.quantity } });
  }
  if (benefits.referral) {
    const policy = await StorePolicy.findById('default');
    const rewards = getReferralRewards(policy);
    try {
      await ReferralClaim.create({ referrer: benefits.referral.referrer, referee: req.user._id, order: order._id, referralCode: benefits.referral.code, rewardPoints: rewards.referrerPoints, refereeRewardPoints: rewards.customerPoints });
    } catch (error) {
      await Order.deleteOne({ _id: order._id });
      if (error.code === 11000) return res.status(409).json({ message: 'A referral code can only be used on your first order.' });
      throw error;
    }
  }
  if (benefits.promo) {
    const updated = await PromoCode.findOneAndUpdate({ _id: benefits.promo._id, active: true, $expr: { $or: [{ $eq: ['$usageLimit', 0] }, { $lt: ['$usedCount', '$usageLimit'] }] } }, { $inc: { usedCount: 1 } });
    if (!updated) { await Order.deleteOne({ _id: order._id }); return res.status(409).json({ message: 'That promotion has just reached its usage limit.' }); }
  }
  if (benefits.giftCard && benefits.giftAmount > 0) {
    const updated = await GiftCard.findOneAndUpdate({ _id: benefits.giftCard._id, balance: { $gte: benefits.giftAmount }, active: true }, { $inc: { balance: -benefits.giftAmount } }, { new: true });
    if (!updated) { if (benefits.promo) await PromoCode.updateOne({ _id: benefits.promo._id }, { $inc: { usedCount: -1 } }); await Order.deleteOne({ _id: order._id }); return res.status(409).json({ message: 'Gift card balance changed. Please check it again.' }); }
    await GiftCardTransaction.create({ giftCard: updated._id, order: order._id, type: 'redeemed', amount: benefits.giftAmount, balanceAfter: updated.balance, note: `Applied to order ${orderNumber}` });
  }
  if (loyaltyPointsRedeemed > 0) {
    const customerAccount = await User.findOneAndUpdate({ _id: req.user._id, loyaltyPoints: { $gte: loyaltyPointsRedeemed } }, { $inc: { loyaltyPoints: -loyaltyPointsRedeemed } }, { new: true });
    if (!customerAccount) {
      if (benefits.giftCard && benefits.giftAmount > 0) { const refunded = await GiftCard.findByIdAndUpdate(benefits.giftCard._id, { $inc: { balance: benefits.giftAmount } }, { new: true }); await GiftCardTransaction.create({ giftCard: benefits.giftCard._id, order: order._id, type: 'refunded', amount: benefits.giftAmount, balanceAfter: refunded.balance, note: 'Checkout could not use reward points' }); }
      if (benefits.promo) await PromoCode.updateOne({ _id: benefits.promo._id }, { $inc: { usedCount: -1 } });
      await Order.deleteOne({ _id: order._id });
      return res.status(409).json({ message: 'Your reward points changed. Refresh your account and try again.' });
    }
    await LoyaltyTransaction.create({ user: req.user._id, order: order._id, kind: 'redeemed', points: loyaltyPointsRedeemed, note: `Used on order ${orderNumber}` });
  }
  if (giftWalletAmount > 0) {
    const session = await User.startSession();
    try {
      await session.withTransaction(async () => {
        const walletUser = await User.findOneAndUpdate(
          { _id: req.user._id, giftWalletBalance: { $gte: giftWalletAmount } },
          { $inc: { giftWalletBalance: -giftWalletAmount } },
          { new: true, session },
        );
        if (!walletUser) throw Object.assign(new Error('Your gift wallet balance changed. Refresh your account and try again.'), { status: 409 });
        await GiftWalletTransaction.create([{ user: req.user._id, order: order._id, type: 'spent', amount: giftWalletAmount, balanceAfter: walletUser.giftWalletBalance, note: `Used on order ${orderNumber}` }], { session });
      });
    } catch (error) {
      if (error.status === 409) {
        if (loyaltyPointsRedeemed > 0) {
          const restored = await User.findByIdAndUpdate(req.user._id, { $inc: { loyaltyPoints: loyaltyPointsRedeemed } }, { new: true });
          if (restored) await LoyaltyTransaction.create({ user: req.user._id, order: order._id, kind: 'refunded', points: loyaltyPointsRedeemed, note: `Restored after checkout retry for ${orderNumber}` });
        }
        if (benefits.giftCard && benefits.giftAmount > 0) {
          const restored = await GiftCard.findByIdAndUpdate(benefits.giftCard._id, { $inc: { balance: benefits.giftAmount } }, { new: true });
          if (restored) await GiftCardTransaction.create({ giftCard: restored._id, order: order._id, type: 'refunded', amount: benefits.giftAmount, balanceAfter: restored.balance, note: `Restored after checkout retry for ${orderNumber}` });
        }
        if (benefits.promo) await PromoCode.updateOne({ _id: benefits.promo._id, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });
        for (const item of orderItems) await Product.updateOne({ slug: item.productId }, { $inc: { stock: item.quantity } });
        if (benefits.referral) await ReferralClaim.deleteOne({ order: order._id, status: 'pending' });
        await Order.deleteOne({ _id: order._id });
        return res.status(409).json({ message: error.message });
      }
      throw error;
    } finally { await session.endSession(); }
  }
  void orderConfirmation(order);
  if (order.paymentStatus === 'paid') void sendPaymentConfirmation(order);
  return res.status(201).json({
    message: paymentMethod === 'razorpay' ? 'Order reserved. Complete payment to confirm it.' : 'Order placed successfully!',
    order: visibleOrder(order),
    payment: payment ? { keyId: process.env.RAZORPAY_KEY_ID, orderId: payment.id, amount: payment.amount, currency: payment.currency } : null,
  });
};

const listMyOrders = async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50);
  return res.json({ orders });
};

const getOrder = async (req, res) => {
  const order = await Order.findOne({ orderNumber: req.params.orderNumber, user: req.user._id });
  if (!order) return res.status(404).json({ message: 'Order not found.' });
  return res.json({ order });
};

const listAllOrders = async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = 50;
  const filter = req.query.status && ORDER_STATUSES.includes(req.query.status) ? { status: req.query.status } : {};
  const [orders, count] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('user', 'name email'),
    Order.countDocuments(filter),
  ]);
  res.set('Cache-Control', 'no-store');
  return res.json({ orders, count, page, pages: Math.ceil(count / limit) });
};

const listCompletedPaidOrders = async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = 50;
  const filter = saleMatch();
  if (req.query.from || req.query.to) {
    const from = req.query.from ? new Date(`${req.query.from}T00:00:00.000+05:30`) : null;
    const to = req.query.to ? new Date(`${req.query.to}T23:59:59.999+05:30`) : null;
    if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime())) || (from && to && from > to)) return res.status(400).json({ message: 'Choose a valid date range.' });
    filter.createdAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
  }
  const search = String(req.query.search || '').trim().slice(0, 80);
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(escaped, 'i');
    filter.$or = [{ orderNumber: pattern }, { 'customer.name': pattern }, { 'customer.email': pattern }, { 'items.name': pattern }];
  }
  const [orders, count] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('user', 'name email').lean(),
    Order.countDocuments(filter),
  ]);
  res.set('Cache-Control', 'no-store');
  return res.json({ orders, count, page, pages: Math.max(1, Math.ceil(count / limit)) });
};

const settleCancellationBenefits = async (order) => {
  if (order.giftWalletAmount > 0 && !order.giftWalletRefunded) {
    const walletUser = await User.findByIdAndUpdate(order.user, { $inc: { giftWalletBalance: order.giftWalletAmount } }, { new: true });
    if (walletUser) await GiftWalletTransaction.create({ user: order.user, order: order._id, type: 'refunded', amount: order.giftWalletAmount, balanceAfter: walletUser.giftWalletBalance, note: `Restored after cancellation of ${order.orderNumber}` });
    order.giftWalletRefunded = true;
  }
  if (order.giftCardRef && order.giftCardAmount > 0 && !order.giftCardRefunded) {
    const card = await GiftCard.findByIdAndUpdate(order.giftCardRef, { $inc: { balance: order.giftCardAmount } }, { new: true });
    if (card) await GiftCardTransaction.create({ giftCard: card._id, order: order._id, type: 'refunded', amount: order.giftCardAmount, balanceAfter: card.balance, note: `Restored after cancellation of ${order.orderNumber}` });
    order.giftCardRefunded = true;
  }
  if (order.loyaltyPointsRedeemed > 0 && !order.loyaltyPointsRefunded) {
    await User.updateOne({ _id: order.user }, { $inc: { loyaltyPoints: order.loyaltyPointsRedeemed } });
    await LoyaltyTransaction.create({ user: order.user, order: order._id, kind: 'refunded', points: order.loyaltyPointsRedeemed, note: `Returned after cancellation of ${order.orderNumber}` });
    order.loyaltyPointsRefunded = true;
  }
  if (order.promoCode && !order.promoUsageRefunded) {
    await PromoCode.updateOne({ code: order.promoCode, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });
    order.promoUsageRefunded = true;
  }
  if (!order.stockRestored && Array.isArray(order.items)) {
    for (const item of order.items) {
      await Product.updateOne({ slug: item.productId }, { $inc: { stock: item.quantity } });
    }
    order.stockRestored = true;
  }
  await order.save();
};

const awardLoyalty = async (order) => {
  if (!isSaleEligible(order)) return;
  const points = Math.floor(Math.max(0, order.subtotal - order.discountAmount - order.loyaltyPointsRedeemed / 100));
  if (!points || order.loyaltyPointsEarned) return;
  const claimed = await Order.findOneAndUpdate({ _id: order._id, status: 'completed', paymentStatus: 'paid', loyaltyPointsEarned: 0 }, { $set: { loyaltyPointsEarned: points } }, { new: true });
  if (!claimed) return;
  await User.updateOne({ _id: order.user }, { $inc: { loyaltyPoints: points } });
  await LoyaltyTransaction.create({ user: order.user, order: order._id, kind: 'earned', points, note: `Earned from order ${order.orderNumber}` });
  order.loyaltyPointsEarned = points;
};

const awardReferral = async (order) => {
  if (!isSaleEligible(order)) return;
  const session = await User.startSession();
  try {
    await session.withTransaction(async () => {
      const claim = await ReferralClaim.findOneAndUpdate(
        { order: order._id, status: 'pending' },
        { $set: { status: 'rewarded' } },
        { new: true, session },
      );
      if (!claim) return;
      const credited = await User.updateOne({ _id: claim.referrer }, { $inc: { loyaltyPoints: claim.rewardPoints } }, { session });
      if (!credited.matchedCount) throw new Error('The referral reward recipient no longer exists.');
      const refereeCredit = await User.updateOne({ _id: claim.referee }, { $inc: { loyaltyPoints: claim.refereeRewardPoints } }, { session });
      if (!refereeCredit.matchedCount) throw new Error('The referred customer no longer exists.');
      await LoyaltyTransaction.create([
        { user: claim.referrer, kind: 'earned', points: claim.rewardPoints, note: `Referral reward for ${order.orderNumber}` },
        { user: claim.referee, kind: 'earned', points: claim.refereeRewardPoints, note: `Welcome referral bonus for ${order.orderNumber}` },
      ], { session });
    });
  } finally {
    await session.endSession();
  }
};

const applyOrderStatus = async (order, status, note, changedBy, { markPaid = false } = {}) => {
  if (markPaid) await markOfflinePaymentReceived(order, changedBy);
  if (status === 'completed' && order.paymentStatus !== 'paid') throw new Error('Payment not received. Mark as Paid first?');
  if (order.status === status) {
    if (markPaid) await order.save();
    if (status === 'completed') { await awardLoyalty(order); await awardReferral(order); }
    return markPaid;
  }
  const previousStatus = order.status;
  const previousPaymentStatus = order.paymentStatus;
  order.status = status;
  recordActivity(order, { type: 'status', status, from: previousStatus, to: status, note, changedBy });
  if (status === 'cancelled' && previousStatus !== 'cancelled' && previousPaymentStatus === 'paid' && order.total > 0) {
    order.paymentStatus = 'refund-due';
    order.refundStatus = 'pending';
    recordActivity(order, { type: 'refund', status, from: 'paid', to: 'refund-due', note: 'Payment must be returned after cancellation', changedBy });
  }
  await order.save();
  if (status === 'cancelled' && previousStatus !== 'cancelled') { await settleCancellationBenefits(order); await ReferralClaim.updateOne({ order: order._id, status: 'pending' }, { $set: { status: 'void' } }); }
  if (status === 'completed') { await awardLoyalty(order); await awardReferral(order); }
  void orderUpdate(order);
  return true;
};

const processOnlineRefund = async (order, changedBy = 'Razorpay') => {
  if (order.paymentMethod !== 'razorpay' || order.paymentStatus !== 'refund-due') return { ok: false, message: 'Refund Due is recorded for the order.' };
  if (order.refundId && order.refundStatus === 'pending') {
    if (!razorpay.isConfigured()) return { ok: false, message: razorpay.unavailableReason() };
    try {
      const refund = await razorpay.getRefund(order.refundId);
      if (refund.status === 'processed' || refund.status === 'failed') {
        const previousStatus = order.paymentStatus;
        order.refundStatus = refund.status;
        order.paymentStatus = refund.status === 'processed' ? 'refunded' : 'refund-due';
        recordActivity(order, { type: 'refund', status: order.status, from: previousStatus, to: order.paymentStatus, note: `Razorpay refund ${refund.status} confirmed by status check`, changedBy });
        await order.save();
        return { ok: refund.status === 'processed', message: refund.status === 'processed' ? 'Razorpay refund confirmed as Refunded.' : 'Razorpay refund failed. Payment remains Refund Due.' };
      }
      return { ok: true, message: 'Razorpay refund is still pending with the payment gateway.' };
    } catch (error) {
      return { ok: false, message: `Could not verify the Razorpay refund status: ${error.message}` };
    }
  }
  if (!order.paymentId || !razorpay.isConfigured()) {
    order.refundStatus = 'failed';
    await order.save();
    return { ok: false, message: 'Order cancelled. Refund Due is recorded, but Razorpay test credentials or payment details are unavailable.' };
  }
  try {
    const refund = await razorpay.refundPayment(order.paymentId, order.total);
    const previousStatus = order.paymentStatus;
    order.refundId = refund.id;
    order.refundStatus = refund.status === 'processed' ? 'processed' : refund.status === 'failed' ? 'failed' : 'pending';
    order.refundedAmount = order.total;
    order.paymentStatus = refund.status === 'processed' ? 'refunded' : 'refund-due';
    recordActivity(order, { type: 'refund', status: order.status, from: previousStatus, to: order.paymentStatus, note: `Razorpay refund ${refund.status || 'submitted'}`, changedBy });
    await order.save();
    return { ok: refund.status !== 'failed', message: `Order cancelled. Razorpay refund ${refund.status || 'submitted'}.` };
  } catch (error) {
    order.refundStatus = 'failed';
    recordActivity(order, { type: 'refund', status: order.status, from: 'refund-due', to: 'refund-due', note: 'Razorpay refund request failed; retry from the admin order.', changedBy });
    await order.save();
    return { ok: false, message: `Order cancelled. Refund Due remains recorded; Razorpay refund could not be started: ${error.message}` };
  }
};

const updateOrderStatus = async (req, res) => {
  const { status, note, markPaid = false, confirmOfflineRefund = false, trackingNumber, carrier, estimatedDelivery } = req.body;
  if (!ORDER_STATUSES.includes(status)) return res.status(400).json({ message: 'Choose a valid order status.' });
  const order = await Order.findOne({ orderNumber: req.params.orderNumber });
  if (!order) return res.status(404).json({ message: 'Order not found.' });
  const previousStatus = order.status;
  const previousPaymentStatus = order.paymentStatus;
  const nextTrackingNumber = trackingNumber === undefined ? undefined : typeof trackingNumber === 'string' ? trackingNumber.trim() : null;
  const nextCarrier = carrier === undefined ? undefined : typeof carrier === 'string' ? carrier.trim() : null;
  const nextEstimatedDelivery = estimatedDelivery === undefined || estimatedDelivery === '' ? undefined : typeof estimatedDelivery === 'string' ? new Date(`${estimatedDelivery}T12:00:00+05:30`) : null;
  if (nextTrackingNumber === null || nextCarrier === null || nextTrackingNumber !== undefined && nextTrackingNumber.length > 100 || nextCarrier !== undefined && nextCarrier.length > 100 || nextEstimatedDelivery === null || nextEstimatedDelivery && Number.isNaN(nextEstimatedDelivery.getTime())) {
    return res.status(400).json({ message: 'Enter a valid tracking number, carrier and estimated delivery date.' });
  }
  if (markPaid && !OFFLINE_PAYMENT_METHODS.includes(order.paymentMethod)) {
    return res.status(409).json({ message: 'Only offline payments can be recorded by an admin.' });
  }
  if (order.paymentMethod === 'razorpay' && isUnpaid(order.paymentStatus) && !['placed', 'cancelled'].includes(status)) {
    return res.status(409).json({ message: 'Online orders move to Confirmed only after Razorpay verifies payment.' });
  }
  if (status === 'cancelled' && order.paymentStatus === 'paid' && OFFLINE_PAYMENT_METHODS.includes(order.paymentMethod) && !confirmOfflineRefund) {
    return res.status(409).json({ message: 'Confirm that this paid offline order should be cancelled and flagged as Refund Due.' });
  }
  try { await applyOrderStatus(order, status, note, req.user.name, { markPaid }); }
  catch (error) { return res.status(409).json({ message: error.message }); }
  if (nextTrackingNumber !== undefined) order.trackingNumber = nextTrackingNumber;
  if (nextCarrier !== undefined) order.shippingCarrier = nextCarrier;
  if (estimatedDelivery !== undefined) order.estimatedDelivery = nextEstimatedDelivery || null;
  if (nextTrackingNumber !== undefined || nextCarrier !== undefined || estimatedDelivery !== undefined) await order.save();
  if (status === 'shipped' && previousStatus !== 'shipped') void sendOrderShipped(order);
  if (previousPaymentStatus !== 'paid' && order.paymentStatus === 'paid') void sendPaymentConfirmation(order);
  let message = 'Order status updated.';
  let actionSucceeded = true;
  if (status === 'cancelled' && order.paymentStatus === 'refund-due') {
    if (order.paymentMethod === 'razorpay') {
      const refundResult = await processOnlineRefund(order, req.user.name);
      message = refundResult.message;
      actionSucceeded = refundResult.ok;
    } else message = 'Order cancelled. Refund Due is recorded; return the offline payment and mark it Refunded when sent.';
  }
  return res.status(actionSucceeded ? 200 : 502).json({ message, order });
};

const cancelMyOrder = async (req, res) => {
  const order = await Order.findOne({ orderNumber: req.params.orderNumber, user: req.user._id });
  if (!order) return res.status(404).json({ message: 'Order not found.' });
  if (order.paymentStatus === 'paid' && OFFLINE_PAYMENT_METHODS.includes(order.paymentMethod)) {
    return res.status(409).json({ message: 'Paid offline orders need bakery confirmation before cancellation. Please contact the bakery.' });
  }
  const todayInIndia = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const deliveryDay = new Date(order.customer.deliveryDate).toISOString().slice(0, 10);
  if (todayInIndia >= deliveryDay) return res.status(409).json({ message: 'Orders can only be cancelled before the delivery date. Same-day cancellations are not available; please contact the bakery.' });
  const policy = await StorePolicy.findById('default');
  const cutoff = policy?.cancellationCutoffStatus || 'confirmed';
  const allowedStatuses = ORDER_STATUSES.slice(0, ORDER_STATUSES.indexOf(cutoff) + 1);
  if (!allowedStatuses.includes(order.status)) return res.status(409).json({ message: `This bakery accepts customer cancellations only through the “${cutoff.replaceAll('-', ' ')}” stage. Please contact the bakery for help.` });
  try { await applyOrderStatus(order, 'cancelled', String(req.body.reason || 'Customer cancellation'), req.user.name); }
  catch (error) { return res.status(409).json({ message: error.message }); }
  let message = order.paymentStatus === 'refund-due' ? 'Order cancelled. Refund Due is recorded for the bakery.' : 'Order cancelled. Any gift card or reward points used were restored.';
  if (order.paymentStatus === 'refund-due' && order.paymentMethod === 'razorpay') message = (await processOnlineRefund(order, req.user.name)).message;
  return res.json({ message, order });
};

const refundOrder = async (req, res) => {
  const order = await Order.findOne({ orderNumber: req.params.orderNumber });
  if (!order) return res.status(404).json({ message: 'Order not found.' });
  if (order.status !== 'cancelled' || order.paymentStatus !== 'refund-due' || order.total <= 0) return res.status(409).json({ message: 'Only cancelled orders with Refund Due can be refunded.' });
  if (order.refundStatus === 'processed') return res.status(409).json({ message: 'A refund is already recorded for this order.' });
  if (order.paymentMethod === 'razorpay') {
    const result = await processOnlineRefund(order, req.user.name);
    return res.status(result.ok ? 200 : 502).json({ message: result.message, order });
  }
  if (!OFFLINE_PAYMENT_METHODS.includes(order.paymentMethod)) return res.status(409).json({ message: 'This payment method cannot be refunded by the bakery.' });
  if (!req.body?.confirmOfflineRefund) return res.status(409).json({ message: 'Confirm that the offline payment has been returned to the customer.' });
  order.refundStatus = 'processed';
  order.refundedAmount = order.total;
  order.refundId = `manual-${Date.now()}`;
  order.paymentStatus = 'refunded';
  recordActivity(order, { type: 'refund', status: order.status, from: 'refund-due', to: 'refunded', note: `Manual refund of ₹${order.total} recorded`, changedBy: req.user.name });
  await order.save();
  return res.json({ message: 'Offline refund recorded as Refunded after admin confirmation.', order });
};

const markOfflinePaid = async (req, res) => {
  const order = await Order.findOne({ orderNumber: req.params.orderNumber });
  if (!order) return res.status(404).json({ message: 'Order not found.' });
  try { const changed = await markOfflinePaymentReceived(order, req.user.name); if (changed) { await order.save(); void orderUpdate(order); void sendPaymentConfirmation(order); } }
  catch (error) { return res.status(409).json({ message: error.message }); }
  return res.json({ message: 'Payment recorded.', order });
};

const markOrderPaid = async (order, paymentId) => {
  const existing = await Order.findById(order._id);
  if (!existing) throw new Error('Order not found.');
  if (existing.paymentStatus === 'paid' || existing.paymentStatus === 'refund-due' || existing.paymentStatus === 'refunded') {
    if (existing.paymentId === paymentId) return existing;
    throw new Error('A different payment has already been recorded for this order. Duplicate payment was rejected.');
  }
  if (!isUnpaid(existing.paymentStatus)) throw new Error('This order is not awaiting online payment.');
  const wasCancelled = existing.status === 'cancelled';
  const nextStatus = wasCancelled ? 'refund-due' : 'paid';
  const nextOrderStatus = !wasCancelled && existing.status === 'placed' ? 'confirmed' : existing.status;
  const events = [{ type: 'payment', status: nextOrderStatus, from: existing.paymentStatus, to: nextStatus, note: 'Online payment captured and verified with Razorpay', changedBy: 'Razorpay', at: new Date() }];
  if (nextOrderStatus !== existing.status) events.unshift({ type: 'status', status: nextOrderStatus, from: existing.status, to: nextOrderStatus, note: 'Confirmed after payment verification', changedBy: 'Razorpay', at: new Date() });
  if (wasCancelled && existing.total > 0) events.push({ type: 'refund', status: 'cancelled', from: 'paid', to: 'refund-due', note: 'Captured payment arrived after cancellation; refund required', changedBy: 'Razorpay', at: new Date() });
  const updated = await Order.findOneAndUpdate(
    { _id: existing._id, status: existing.status, paymentStatus: { $in: ['unpaid', 'pending', 'failed'] }, paymentId: { $in: ['', null] } },
    { $set: { paymentStatus: nextStatus, paymentId, paidAt: new Date(), paidBy: 'Razorpay', status: nextOrderStatus, ...(wasCancelled && existing.total > 0 ? { refundStatus: 'pending' } : {}) }, $push: { tracking: { $each: events } } },
    { new: true, runValidators: true },
  );
  if (!updated) {
    const current = await Order.findById(existing._id);
    if (current?.paymentId === paymentId && ['paid', 'refund-due', 'refunded'].includes(current.paymentStatus)) return current;
    throw new Error('A payment update is already being processed for this order.');
  }
  if (wasCancelled && updated.paymentStatus === 'refund-due') await processOnlineRefund(updated, 'Razorpay');
  else void sendPaymentConfirmation(updated);
  void orderUpdate(updated);
  return updated;
};

const verifyPayment = async (req, res) => {
  const order = await Order.findOne({ orderNumber: req.params.orderNumber, user: req.user._id });
  if (!order || order.paymentMethod !== 'razorpay') return res.status(404).json({ message: 'Online order not found.' });
  const { razorpay_order_id: providerOrderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;
  if (providerOrderId !== order.paymentOrderId || !paymentId || !razorpay.verifyCheckoutSignature(providerOrderId, paymentId, signature)) {
    return res.status(400).json({ message: 'Payment verification failed. Contact us with your order number if money was deducted.' });
  }
  if (!razorpay.isConfigured()) return res.status(503).json({ message: razorpay.unavailableReason() });
  let payment;
  try { payment = await razorpay.getPayment(paymentId); }
  catch (error) { return res.status(502).json({ message: `Could not verify payment with Razorpay: ${error.message}` }); }
  if (payment.order_id !== order.paymentOrderId || payment.amount !== order.total * 100 || payment.status !== 'captured') {
    return res.status(409).json({ message: 'Payment has not been captured yet. Your order will update when the payment is confirmed.' });
  }
  let updated;
  try { updated = await markOrderPaid(order, paymentId); }
  catch (error) { return res.status(409).json({ message: error.message }); }
  return res.json({ message: updated.paymentStatus === 'refund-due' ? 'Payment was verified after cancellation. Refund Due is recorded.' : 'Payment confirmed. Your cake order is in our system!', order: updated });
};

const retryPayment = async (req, res) => {
  const order = await Order.findOne({ orderNumber: req.params.orderNumber, user: req.user._id });
  if (!order || order.paymentMethod !== 'razorpay') return res.status(404).json({ message: 'Online order not found.' });
  if (order.status === 'cancelled') return res.status(409).json({ message: 'This order has been cancelled. Contact the bakery if you already paid.' });
  if (!isUnpaid(order.paymentStatus)) return res.status(409).json({ message: 'This order is not awaiting online payment.' });
  if (!razorpay.isConfigured()) return res.status(503).json({ message: razorpay.unavailableReason() });
  try {
    let paymentOrderId = order.paymentOrderId;
    if (!paymentOrderId) {
      const payment = await razorpay.createOrder(order.total, `${order.orderNumber.slice(0, 24)}-R${Date.now().toString(36)}`, order.customer);
      const saved = await Order.findOneAndUpdate({ _id: order._id, paymentStatus: { $in: ['unpaid', 'pending', 'failed'] }, paymentOrderId: '' }, { $set: { paymentOrderId: payment.id } }, { new: true });
      paymentOrderId = saved?.paymentOrderId || (await Order.findById(order._id))?.paymentOrderId;
      if (paymentOrderId !== payment.id) return res.status(409).json({ message: 'Another checkout attempt has already started. Reopen that payment attempt from your order.' });
    }
    return res.json({ payment: { keyId: process.env.RAZORPAY_KEY_ID, orderId: paymentOrderId, amount: order.total * 100, currency: 'INR' } });
  } catch (error) {
    console.error(`Razorpay retry failed: ${error.message}`);
    return res.status(502).json({ message: 'Could not start checkout. Please try again shortly.' });
  }
};

const razorpayWebhook = async (req, res) => {
  if (!razorpay.isConfigured()) return res.status(503).json({ message: razorpay.unavailableReason() });
  if (!razorpay.verifyWebhookSignature(req.rawBody, req.headers['x-razorpay-signature'])) {
    return res.status(400).json({ message: 'Invalid webhook signature.' });
  }
  const event = req.body?.event;
  const refund = req.body?.payload?.refund?.entity;
  if (['refund.processed', 'refund.failed'].includes(event) && refund?.id) {
    const order = await Order.findOne({ refundId: refund.id });
    if (order) {
      const previousStatus = order.paymentStatus;
      order.refundStatus = event === 'refund.processed' ? 'processed' : 'failed';
      order.paymentStatus = event === 'refund.processed' ? 'refunded' : 'refund-due';
      recordActivity(order, { type: 'refund', status: order.status, from: previousStatus, to: order.paymentStatus, note: `Razorpay refund ${event === 'refund.processed' ? 'confirmed' : 'failed'}`, changedBy: 'Razorpay' });
      await order.save();
    }
    return res.json({ received: true });
  }
  let payment = req.body?.payload?.payment?.entity;
  const providerOrderId = payment?.order_id || req.body?.payload?.order?.entity?.id;
  if (['payment.captured', 'order.paid'].includes(event) && providerOrderId) {
    const order = await Order.findOne({ paymentOrderId: providerOrderId });
    if (!payment && event === 'order.paid' && order) {
      const payments = await razorpay.getPaymentsForOrder(providerOrderId);
      payment = payments.find((candidate) => candidate.status === 'captured') || null;
    }
    if (order && payment?.status === 'captured' && payment.order_id === order.paymentOrderId && payment.amount === order.total * 100 && payment.id) {
      try { await markOrderPaid(order, payment.id); }
      catch (error) { console.error(`Razorpay webhook payment was not applied to ${order.orderNumber}: ${error.message}`); }
    }
  }
  return res.json({ received: true });
};

module.exports = {
  createOrder, listMyOrders, getOrder, listAllOrders, listCompletedPaidOrders, updateOrderStatus, cancelMyOrder, refundOrder,
  markOfflinePaid, verifyPayment, retryPayment, razorpayWebhook, awardReferral,
};
