const crypto = require('crypto');
const mongoose = require('mongoose');
const PromoCode = require('../models/PromoCode');
const PromoCampaign = require('../models/PromoCampaign');
const GiftCard = require('../models/GiftCard');
const GiftCardTransaction = require('../models/GiftCardTransaction');
const User = require('../models/User');
const Order = require('../models/Order');
const StorePolicy = require('../models/StorePolicy');
const ReferralClaim = require('../models/ReferralClaim');
const { getReferralRewards } = require('../utils/referralRewards');
const GiftCardPurchase = require('../models/GiftCardPurchase');
const razorpay = require('../services/razorpay');
const { sendEmailMessage } = require('../services/emailService');
const GiftWalletTransaction = require('../models/GiftWalletTransaction');
const GiftCardOffer = require('../models/GiftCardOffer');
const giftEmailTemplates = ['sweet-moments', 'cake-love', 'birthday-bliss', 'just-because', 'with-love', 'special-treat'];

const codeHash = (code) => crypto.createHash('sha256').update(String(code).trim().toUpperCase()).digest('hex');
// Codes are issued per card (never per design/offer) and only after payment is confirmed.
// The model's unique codeHash index is the final guard against duplicates.
const generateGiftCardCode = () => `CAKE-${crypto.randomBytes(16).toString('hex').toUpperCase()}`;
const giftCodeEncryptionKey = () => crypto.createHash('sha256').update(String(process.env.JWT_SECRET || '')).digest();
const encryptGiftCode = (code) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', giftCodeEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(code, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.');
};
const decryptGiftCode = (value) => {
  const [ivText, tagText, encryptedText] = String(value || '').split('.');
  if (!ivText || !tagText || !encryptedText) throw new Error('Gift card delivery code is unavailable. Please contact the bakery with your payment reference.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', giftCodeEncryptionKey(), Buffer.from(ivText, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedText, 'base64url')), decipher.final()]).toString('utf8');
};
const emailPurchasedGiftCard = async (purchase, code) => {
  const recipientName = String(purchase.recipientName || '').trim();
  const offerName = String(purchase.offerName || 'Gift Card').trim();
  const note = String(purchase.message || '').trim();
  const value = Number(purchase.value || 0).toLocaleString('en-IN');
  const safeRecipient = escapeHtml(recipientName);
  const safeOffer = escapeHtml(offerName);
  const safeNote = escapeHtml(note).replace(/\r?\n/g, '<br>');
  const greeting = recipientName ? `Dear ${recipientName},` : 'A little something, just for you';
  const valueNumber = Number(purchase.value || 0);
  const themes = {
    'sweet-moments': { paper: '#fff9f5', panel: '#f4dfde', accent: '#b77678', ribbon: '#edc9ca', ornament: '❀　♡　❀', title: 'Sweet Moments' },
    'cake-love': { paper: '#fff8f7', panel: '#f2d9de', accent: '#ad5f70', ribbon: '#e9c1cb', ornament: '♡　♥　♡', title: 'Made with Cake Love' },
    'birthday-bliss': { paper: '#fff8ff', panel: '#e8ddf3', accent: '#8b6698', ribbon: '#d7c4e9', ornament: '🎈　✦　🎂　✦　🎈', title: 'Birthday Bliss' },
    'just-because': { paper: '#fcf9ff', panel: '#eae3f4', accent: '#81709a', ribbon: '#d8cce9', ornament: '✧　♡　✧', title: 'Just Because' },
    'with-love': { paper: '#fff9f5', panel: '#f5e0e0', accent: '#b6787a', ribbon: '#eccccb', ornament: '♡　୨୧　♡', title: 'Sent With Love' },
    'special-treat': { paper: '#fffaf0', panel: '#f1e2c5', accent: '#a77746', ribbon: '#e4c990', ornament: '✦　♡　✦', title: 'A Special Treat' },
  };
  const tier = themes[purchase.emailTemplate || purchase.design] || themes['sweet-moments'];
  const grandDetail = valueNumber >= 2500;
  const text = `${greeting}\n\n${tier.title}: ${offerName}, worth ₹${value}.\n\nYour gift card code: ${code}\nUse this code at checkout on your next Cakes of Paradise order.\n${note ? `\nA personal note:\n“${note}”\n` : ''}\nYour card is valid for one year. Enjoy every bite!`;
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f5eee5;color:#51443b;font-family:Georgia,'Times New Roman',serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5eee5;padding:28px 12px"><tr><td align="center"><table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:560px;background:${tier.paper};border:${grandDetail ? '2px' : '1px'} solid ${tier.ribbon};border-radius:24px;overflow:hidden"><tr><td align="center" style="padding:30px 28px 24px;background:#e6eadf"><div style="font-family:Georgia,serif;font-size:34px;font-style:italic;color:#65715e">Cakes of Paradise</div><div style="margin-top:7px;font-family:Arial,sans-serif;font-size:10px;letter-spacing:3px;color:#7d8272">A LITTLE SWEETNESS, WITH LOVE</div></td></tr><tr><td align="center" style="padding:30px 28px 8px"><div style="font-size:${grandDetail ? '21px' : '17px'};letter-spacing:3px;color:${tier.accent}">${tier.ornament}</div><div style="margin-top:13px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${tier.accent}">${tier.title}</div><h1 style="margin:11px 0 8px;font-size:32px;line-height:1.15;font-weight:400;color:#51443b">${safeRecipient ? `For ${safeRecipient},` : 'A sweet surprise for you'}</h1><p style="margin:0;color:#7c6c60;font-size:17px;line-height:1.55">Someone picked out a little happiness just for you.</p></td></tr><tr><td style="padding:24px 28px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${tier.panel};border:${grandDetail ? '3px' : '2px'} solid ${tier.ribbon};border-radius:20px"><tr><td align="center" style="padding:${grandDetail ? '38px 18px 34px' : valueNumber >= 1500 ? '29px 18px 26px' : '25px 18px 23px'}"><div style="font-size:${grandDetail ? '19px' : '15px'};color:${tier.accent}">${tier.ornament}</div><div style="margin:10px 0 3px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${tier.accent}">${safeOffer}</div><div style="margin:8px 0 3px;font-size:${grandDetail ? '52px' : valueNumber >= 1500 ? '46px' : '42px'};line-height:1.1;color:#4e433c">₹${value}</div><div style="font-family:Arial,sans-serif;font-size:12px;color:#78685e">to spend on your favourite cakes</div><div style="margin:20px auto 0;padding:14px 16px;max-width:320px;background:${tier.paper};border:1px dashed ${tier.accent};border-radius:11px;font-family:Arial,sans-serif;font-size:19px;font-weight:bold;letter-spacing:2px;color:#5a4a42">${escapeHtml(code)}</div><div style="margin-top:9px;font-family:Arial,sans-serif;font-size:11px;color:#816f65">Enter this gift code at checkout</div></td></tr></table></td></tr>${note ? `<tr><td style="padding:0 28px 24px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f1e8;border-left:3px solid ${tier.accent};border-radius:4px 12px 12px 4px"><tr><td style="padding:17px 19px"><div style="margin-bottom:7px;font-family:Arial,sans-serif;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:${tier.accent}">A little note for you</div><div style="font-size:16px;line-height:1.65;color:#5b4c43">${safeNote}</div></td></tr></table></td></tr>` : ''}<tr><td align="center" style="padding:0 28px 28px"><p style="margin:0 0 7px;font-size:15px;color:#6d6258">${safeRecipient ? `We hope you enjoy it, ${safeRecipient}.` : 'We hope it makes your day a little sweeter.'}</p><p style="margin:0;font-family:Arial,sans-serif;font-size:12px;line-height:1.6;color:#887b70">Valid for one year from issue · Redeem online at Cakes of Paradise</p></td></tr><tr><td align="center" style="padding:15px;background:#e6eadf;font-family:Arial,sans-serif;font-size:11px;letter-spacing:.5px;color:#6f7866">Baked with love, just for your special moments ♡</td></tr></table></td></tr></table></body></html>`;
  return sendEmailMessage({ to: purchase.recipientEmail, subject: `${offerName} · A sweet gift is on its way ♡`, text, html });
};
const deliverGiftCardPurchase = async (purchase, card) => {
  if (!purchase.deliveryCodeEncrypted) throw new Error('The gift card email is not available to resend. Please contact the bakery.');
  const code = decryptGiftCode(purchase.deliveryCodeEncrypted);
  const delivery = await emailPurchasedGiftCard(purchase, code);
  if (!delivery.sent) return false;
  purchase.giftCard = card._id;
  purchase.status = 'fulfilled';
  purchase.deliveryCodeEncrypted = '';
  await purchase.save();
  return true;
};
const queueGiftCardEmail = (purchaseId) => {
  setImmediate(async () => {
    let purchase;
    try {
      // Claim this email job once so a duplicate payment callback cannot send duplicates.
      purchase = await GiftCardPurchase.findOneAndUpdate(
        { _id: purchaseId, status: 'paid', emailDeliveryStatus: 'queued' },
        { $set: { emailDeliveryStatus: 'sending' } },
        { new: true },
      ).select('+deliveryCodeEncrypted');
      if (!purchase) return;
      const code = decryptGiftCode(purchase.deliveryCodeEncrypted);
      const result = await emailPurchasedGiftCard(purchase, code);
      if (!result.sent) throw new Error('Mail provider did not accept the gift email.');
      await GiftCardPurchase.updateOne(
        { _id: purchase._id, emailDeliveryStatus: 'sending' },
        { $set: { status: 'fulfilled', emailDeliveryStatus: 'sent', deliveryCodeEncrypted: '' } },
      );
    } catch (error) {
      console.error(`Gift card email delivery failed for purchase ${purchaseId}: ${error.message}`);
      if (purchase) await GiftCardPurchase.updateOne(
        { _id: purchase._id, emailDeliveryStatus: 'sending' },
        { $set: { emailDeliveryStatus: 'failed' } },
      ).catch((updateError) => console.error(`Could not record gift email failure for purchase ${purchaseId}: ${updateError.message}`));
    }
  });
};
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const calculateDiscount = (promo, subtotal) => {
  const startsInFuture = promo.startsAt && new Date(promo.startsAt) > new Date();
  // In the admin offer form, email scheduling controls delivery only. The offer is usable as soon as it is created.
  if (promo.active === false || (startsInFuture && !promo.sendToSubscribers) || (promo.endsAt && new Date(promo.endsAt) < new Date()) ||
      (Number(promo.usageLimit) > 0 && Number(promo.usedCount || 0) >= Number(promo.usageLimit)) || subtotal < Number(promo.minimumSubtotal || 0)) return 0;
  const amount = promo.type === 'percent' ? subtotal * promo.value / 100 : promo.value;
  const cap = Number(promo.maximumDiscount || 0);
  return Math.max(0, Math.min(subtotal, cap > 0 ? Math.min(amount, cap) : amount));
};

const findPromoByCode = async (code) => {
  const normalized = String(code || '').trim().toUpperCase();
  if (!normalized) return null;
  const exact = await PromoCode.findOne({ code: normalized });
  if (exact) return exact;
  // Older promo documents may predate the schema's uppercase setter.
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return PromoCode.findOne({ code: { $regex: `^${escaped}$`, $options: 'i' } });
};

const promoUnavailableReason = (promo, subtotal, now = new Date()) => {
  if (!promo || promo.active === false) return 'That discount code is not active. Check the code with the bakery.';
  if (promo.startsAt && new Date(promo.startsAt) > now && !promo.sendToSubscribers) return `That offer starts on ${new Date(promo.startsAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}.`;
  if (promo.endsAt && new Date(promo.endsAt) < now) return 'That discount code has expired.';
  if (Number(promo.usageLimit) > 0 && Number(promo.usedCount || 0) >= Number(promo.usageLimit)) return 'That discount code has reached its use limit.';
  const minimum = Number(promo.minimumSubtotal || 0);
  if (subtotal < minimum) return `Add at least ₹${minimum.toLocaleString('en-IN')} in cakes to use this code.`;
  return 'That discount code could not be applied. Please try again.';
};

exports.validatePromo = async (req, res) => {
  const subtotal = Number(req.body.subtotal);
  const code = String(req.body.code || '').trim().toUpperCase();
  if (!Number.isSafeInteger(subtotal) || subtotal < 1 || !code) return res.status(400).json({ message: 'Enter a valid code and basket subtotal.' });
  const referrer = await User.findOne({ referralCode: code }).select('_id');
  if (referrer) {
    if (String(referrer._id) === String(req.user?._id)) return res.status(400).json({ message: 'You cannot use your own referral code.' });
    if (await Order.exists({ user: req.user?._id }) || await ReferralClaim.exists({ referee: req.user?._id, status: { $in: ['pending', 'rewarded'] } })) return res.status(409).json({ message: 'Referral codes apply to your first order only.' });
    const policy = await StorePolicy.findById('default');
    const rewards = getReferralRewards(policy);
    return res.json({ code, discount: 0, total: subtotal, referral: true, message: `Referral linked. You will receive ${rewards.customerPoints} bonus points and your friend ${rewards.referrerPoints} points after your first paid order is completed.` });
  }
  const promo = await findPromoByCode(code);
  if (promo?.user && String(promo.user) !== String(req.user?._id)) return res.status(404).json({ message: 'That code is invalid, expired, or does not apply to this basket.' });
  const discount = promo ? calculateDiscount(promo, subtotal) : 0;
  if (!discount) return res.status(400).json({ message: promoUnavailableReason(promo, subtotal) });
  return res.json({ code, discount, total: subtotal - discount });
};

exports.listPromos = async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 12));
  const search = String(req.query.search || '').trim().slice(0, 80);
  const filter = {};
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { code: { $regex: escaped, $options: 'i' } },
      { description: { $regex: escaped, $options: 'i' } },
    ];
  }
  const [promotions, count] = await Promise.all([
    PromoCode.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    PromoCode.countDocuments(filter),
  ]);
  res.set('Cache-Control', 'no-store');
  return res.json({ promotions, count, page, pages: Math.max(1, Math.ceil(count / limit)), limit });
};
exports.createPromo = async (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  const description = String(req.body.description || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, 160);
  const occasionType = ['festival', 'celebration', 'other'].includes(req.body.occasionType) ? req.body.occasionType : 'other';
  const sendToSubscribers = req.body.sendToSubscribers === true || req.body.sendToSubscribers === 'true';
  const type = req.body.type;
  const value = Number(req.body.value);
  if (!/^[A-Z0-9_-]{3,24}$/.test(code) || !['percent', 'fixed'].includes(type) || !Number.isSafeInteger(value) || value < 1 || (type === 'percent' && value > 100)) return res.status(400).json({ message: 'Provide a valid code and discount value.' });
  if (!description) return res.status(400).json({ message: 'Add a reason or occasion for this offer.' });
  if (sendToSubscribers && occasionType !== 'festival') return res.status(400).json({ message: 'Customer emails are available for festival offers only.' });
  try {
    const expiryInput = String(req.body.endsAt || '');
    if (!expiryInput) return res.status(400).json({ message: 'Choose an expiry date for this offer.' });
    const endsAt = /^\d{4}-\d{2}-\d{2}$/.test(expiryInput)
      ? new Date(`${expiryInput}T23:59:59.999+05:30`)
      : new Date(expiryInput);
    if (Number.isNaN(endsAt.getTime()) || endsAt <= new Date()) return res.status(400).json({ message: 'Choose a future promotion expiry date.' });
    let sendAt = null;
    if (sendToSubscribers) {
      sendAt = new Date(req.body.sendAt);
      if (type !== 'percent' || value > 15) return res.status(400).json({ message: 'Festival emails support percentage discounts up to 15%.' });
      if (Number.isNaN(sendAt.getTime()) || sendAt <= new Date()) return res.status(400).json({ message: 'Choose a future date and time for the festival email.' });
      if (endsAt <= sendAt) return res.status(400).json({ message: 'The offer must expire after its email is scheduled.' });
    }
    const minimumSubtotal = Math.max(0, Number(req.body.minimumSubtotal) || 0);
    const maximumDiscount = Math.max(0, Number(req.body.maximumDiscount) || 0);
    const promotion = await PromoCode.create({ code, description, occasionType, sendToSubscribers, type, value, minimumSubtotal, maximumDiscount, startsAt: new Date(), endsAt, usageLimit: Math.max(0, Number(req.body.usageLimit) || 0) });
    if (sendToSubscribers) {
      try {
        await PromoCampaign.create({ eventName: description, code, promoCode: promotion._id, discountPercent: value, minimumSubtotal, maximumDiscount, sendAt, endsAt });
      } catch (error) {
        await PromoCode.deleteOne({ _id: promotion._id }).catch(() => {});
        throw error;
      }
    }
    return res.status(201).json({ promotion });
  } catch (error) { if (error.code === 11000) return res.status(409).json({ message: 'That promotion code already exists.' }); throw error; }
};
exports.setPromoActive = async (req, res) => {
  const promotion = await PromoCode.findByIdAndUpdate(req.params.id, { active: Boolean(req.body.active) }, { new: true });
  if (!promotion) return res.status(404).json({ message: 'Promotion not found.' });
  return res.json({ promotion });
};

exports.checkGiftCard = async (req, res) => {
  const card = await GiftCard.findOne({ codeHash: codeHash(req.body.code) });
  if (!card) return res.status(404).json({ message: 'Gift card code was not found.' });
  const transactions = await GiftCardTransaction.find({ giftCard: card._id }).sort({ createdAt: -1 }).limit(30).populate('order', 'orderNumber').select('type amount balanceAfter note createdAt order');
  return res.json({ balance: card.balance, last4: card.codeLast4, active: card.active && (!card.expiresAt || card.expiresAt >= new Date()), expiresAt: card.expiresAt, transactions: transactions.map((item) => ({ type: item.type, amount: item.amount, balanceAfter: item.balanceAfter, note: item.note, orderNumber: item.order?.orderNumber || '', createdAt: item.createdAt })) });
};

exports.claimGiftCard = async (req, res) => {
  const code = String(req.body.code || '').trim();
  if (!/^[A-Z0-9-]{8,40}$/i.test(code)) return res.status(400).json({ message: 'Enter a valid gift card code.' });
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const card = await GiftCard.findOne({ codeHash: codeHash(code), active: true, balance: { $gt: 0 }, expiresAt: { $gt: new Date() } }).session(session);
      if (!card) throw Object.assign(new Error('This gift card is invalid, expired, or already claimed.'), { status: 404 });
      const amount = card.balance;
      const claimed = await GiftCard.findOneAndUpdate({ _id: card._id, active: true, balance: amount, expiresAt: { $gt: new Date() } }, { $set: { balance: 0, active: false } }, { new: true, session });
      if (!claimed) throw Object.assign(new Error('This gift card was just claimed. Refresh your wallet to check the balance.'), { status: 409 });
        const user = await User.findByIdAndUpdate(req.user._id, { $inc: { giftWalletBalance: amount } }, { new: true, session }).select('giftWalletBalance');
      if (!user) throw Object.assign(new Error('Your account could not be updated. Please try again.'), { status: 404 });
      await GiftCardTransaction.create([{ giftCard: card._id, user: req.user._id, type: 'claimed', amount, balanceAfter: 0, note: 'Gift card balance transferred to customer wallet' }], { session });
      await GiftWalletTransaction.create([{ user: req.user._id, giftCard: card._id, type: 'claimed', amount, balanceAfter: user.giftWalletBalance, note: 'Gift card claimed into wallet' }], { session });
      result = { added: amount, balance: user.giftWalletBalance };
    });
    return res.json({ message: `₹${result.added.toLocaleString('en-IN')} was added to your gift wallet.`, ...result });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    throw error;
  } finally { await session.endSession(); }
};

exports.getGiftWallet = async (req, res) => {
  const user = await User.findById(req.user._id).select('giftWalletBalance');
  if (!user) return res.status(404).json({ message: 'Customer account not found.' });
  const transactions = await GiftWalletTransaction.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(30).select('type amount balanceAfter note createdAt');
  return res.json({ balance: Number(user.giftWalletBalance || 0), transactions });
};

exports.listCustomerGiftCardOffers = async (_req, res) => {
  const offers = await GiftCardOffer.find({ active: true }).sort({ price: 1, createdAt: -1 }).select('name design price');
  res.set('Cache-Control', 'no-store');
  return res.json({ offers });
};

exports.listAdminGiftCardOffers = async (_req, res) => {
  const offers = await GiftCardOffer.find().sort({ createdAt: -1 }).select('name design emailTemplate price active createdAt');
  res.set('Cache-Control', 'no-store');
  return res.json({ offers });
};

exports.createGiftCardOffer = async (req, res) => {
  const name = String(req.body.name || '').trim();
  const design = String(req.body.design || 'sweet-moments');
  const emailTemplate = String(req.body.emailTemplate || design);
  const price = Number(req.body.price);
  const designs = ['sweet-moments', 'cake-love', 'birthday-bliss', 'just-because', 'with-love', 'special-treat'];
  if (!name || name.length > 80 || !designs.includes(design) || !giftEmailTemplates.includes(emailTemplate) || !Number.isSafeInteger(price) || price < 100 || price > 100000) {
    return res.status(400).json({ message: 'Choose a valid card design and email style, then enter a whole-number price from ₹100 to ₹1,00,000.' });
  }
  const offer = await GiftCardOffer.create({ name, design, emailTemplate, price, createdBy: req.user._id });
  return res.status(201).json({ message: 'Customer gift card offer published.', offer });
};

exports.updateGiftCardOffer = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid gift card offer.' });
  const name = String(req.body.name || '').trim();
  const design = String(req.body.design || 'sweet-moments');
  const emailTemplate = String(req.body.emailTemplate || design);
  const price = Number(req.body.price);
  const designs = ['sweet-moments', 'cake-love', 'birthday-bliss', 'just-because', 'with-love', 'special-treat'];
  if (!name || name.length > 80 || !designs.includes(design) || !giftEmailTemplates.includes(emailTemplate) || !Number.isSafeInteger(price) || price < 100 || price > 100000) {
    return res.status(400).json({ message: 'Choose a valid card design and email style, then enter a whole-number price from ₹100 to ₹1,00,000.' });
  }
  const offer = await GiftCardOffer.findByIdAndUpdate(req.params.id, { $set: { name, design, emailTemplate, price } }, { new: true, runValidators: true });
  if (!offer) return res.status(404).json({ message: 'Gift card offer not found.' });
  return res.json({ message: 'Gift card offer updated.', offer });
};

exports.setGiftCardOfferActive = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid gift card offer.' });
  const offer = await GiftCardOffer.findByIdAndUpdate(req.params.id, { $set: { active: req.body.active === true } }, { new: true });
  if (!offer) return res.status(404).json({ message: 'Gift card offer not found.' });
  return res.json({ message: offer.active ? 'Gift card offer published.' : 'Gift card offer hidden from customers.', offer });
};

exports.createGiftCardPurchase = async (req, res) => {
  const recipientEmail = String(req.body.recipientEmail || '').trim().toLowerCase();
  const recipientName = String(req.body.recipientName || '').trim();
  const message = String(req.body.message || '').trim();
  const offerId = String(req.body.offerId || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,63}$/.test(recipientEmail) || recipientEmail.length > 200 || recipientName.length > 100 || message.length > 200 || !mongoose.isValidObjectId(offerId)) {
    return res.status(400).json({ message: 'Choose a gift card offer and enter a valid recipient email.' });
  }
  const offer = await GiftCardOffer.findOne({ _id: offerId, active: true }).select('name design emailTemplate price');
  if (!offer) return res.status(404).json({ message: 'That gift card offer is no longer available. Refresh and choose another.' });
  const { design, price: value, name: offerName } = offer;
  if (!razorpay.isConfigured()) return res.status(503).json({ message: razorpay.unavailableReason() });
  if (!require('../services/emailService').isConfigured()) return res.status(503).json({ message: 'Gift card email delivery is not configured yet. Please contact the bakery.' });
  const receipt = `GC-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const purchase = await GiftCardPurchase.create({ offer: offer._id, offerName, recipientEmail, recipientName, message, design, emailTemplate: offer.emailTemplate || design, value, receipt, paymentMethod: 'razorpay' });
  try {
    const payment = await razorpay.createOrder(value, receipt.slice(0, 40), { email: recipientEmail });
    purchase.paymentOrderId = payment.id;
    await purchase.save();
    return res.status(201).json({ purchaseId: purchase._id, offerName, amount: value * 100, currency: 'INR', orderId: payment.id, keyId: process.env.RAZORPAY_KEY_ID });
  } catch (error) {
    await GiftCardPurchase.deleteOne({ _id: purchase._id, status: 'pending' }).catch(() => {});
    return res.status(502).json({ message: error.message || 'Could not start secure checkout. Please try again.' });
  }
};

exports.createGiftCardWalletPurchase = async (req, res) => {
  const recipientEmail = String(req.body.recipientEmail || '').trim().toLowerCase();
  const recipientName = String(req.body.recipientName || '').trim();
  const message = String(req.body.message || '').trim();
  const offerId = String(req.body.offerId || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,63}$/.test(recipientEmail) || recipientEmail.length > 200 || recipientName.length > 100 || message.length > 200 || !mongoose.isValidObjectId(offerId)) return res.status(400).json({ message: 'Choose a gift card offer and enter a valid recipient email.' });
  if (!require('../services/emailService').isConfigured()) return res.status(503).json({ message: 'Gift card email delivery is not configured yet. Please contact the bakery.' });
  const offer = await GiftCardOffer.findOne({ _id: offerId, active: true }).select('name design emailTemplate price');
  if (!offer) return res.status(404).json({ message: 'That gift card offer is no longer available. Refresh and choose another.' });
  const receipt = `GCW-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const session = await mongoose.startSession();
  let purchase;
  let card;
  try {
    await session.withTransaction(async () => {
      const user = await User.findOneAndUpdate({ _id: req.user._id, giftWalletBalance: { $gte: offer.price } }, { $inc: { giftWalletBalance: -offer.price } }, { new: true, session }).select('giftWalletBalance');
      if (!user) throw Object.assign(new Error('Your gift wallet balance is too low for this card. Choose UPI or add funds to your wallet.'), { status: 409 });
      [purchase] = await GiftCardPurchase.create([{ offer: offer._id, offerName: offer.name, recipientEmail, recipientName, message, design: offer.design, emailTemplate: offer.emailTemplate || offer.design, value: offer.price, receipt, paymentMethod: 'gift-wallet', user: req.user._id, status: 'paid' }], { session });
      const code = generateGiftCardCode();
      [card] = await GiftCard.create([{ purchaseRef: String(purchase._id), codeHash: codeHash(code), codeLast4: code.slice(-4), value: offer.price, balance: offer.price, recipientName, recipientEmail, message, design: offer.design, emailTemplate: offer.emailTemplate || offer.design, offerName: offer.name, expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) }], { session });
      await GiftCardTransaction.create([{ giftCard: card._id, type: 'issued', amount: offer.price, balanceAfter: offer.price, note: 'Customer gift card purchase using gift wallet' }], { session });
      await GiftWalletTransaction.create([{ user: req.user._id, giftCard: card._id, type: 'spent', amount: offer.price, balanceAfter: user.giftWalletBalance, note: `Gift card purchase: ${offer.name}` }], { session });
      purchase.giftCard = card._id;
      purchase.deliveryCodeEncrypted = encryptGiftCode(code);
      await purchase.save({ session });
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    throw error;
  } finally { await session.endSession(); }
  try {
    const sent = await deliverGiftCardPurchase(purchase, card);
    if (!sent) return res.status(503).json({ paid: true, purchaseId: purchase._id, message: 'Your wallet was charged and the gift card is ready, but its email could not be sent. Retry delivery without another charge.' });
  } catch (error) {
    return res.status(503).json({ paid: true, purchaseId: purchase._id, message: `Your wallet was charged and the gift card is ready. ${error.message} Retry delivery without another charge.` });
  }
  const user = await User.findById(req.user._id).select('giftWalletBalance');
  return res.json({ message: 'Gift card purchased using your gift wallet and emailed successfully.', recipientEmail, balance: Number(user?.giftWalletBalance || 0) });
};

exports.retryGiftCardWalletDelivery = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.purchaseId)) return res.status(400).json({ message: 'Invalid gift card purchase.' });
  const purchase = await GiftCardPurchase.findOne({ _id: req.params.purchaseId, user: req.user._id, paymentMethod: 'gift-wallet' }).select('+deliveryCodeEncrypted');
  if (!purchase) return res.status(404).json({ message: 'Gift card purchase was not found.' });
  if (purchase.status === 'fulfilled') return res.json({ message: 'The gift card email has already been sent.', recipientEmail: purchase.recipientEmail });
  const card = await GiftCard.findById(purchase.giftCard);
  if (!card) return res.status(409).json({ message: 'The gift card has not finished processing. Please contact the bakery.' });
  const sent = await deliverGiftCardPurchase(purchase, card);
  if (!sent) return res.status(503).json({ paid: true, purchaseId: purchase._id, message: 'The email could not be sent yet. Please retry delivery.' });
  return res.json({ message: 'Gift card email sent successfully.', recipientEmail: purchase.recipientEmail });
};

exports.verifyGiftCardPurchase = async (req, res) => {
  const { purchaseId, razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;
  if (!mongoose.isValidObjectId(purchaseId) || !orderId || !paymentId || !razorpay.verifyCheckoutSignature(orderId, paymentId, signature)) return res.status(400).json({ message: 'Payment verification failed. Please contact us before trying again.' });
  let purchase = await GiftCardPurchase.findById(purchaseId).select('+deliveryCodeEncrypted');
  if (!purchase || purchase.paymentOrderId !== orderId) return res.status(404).json({ message: 'Gift card purchase was not found.' });
  if (!razorpay.isConfigured()) return res.status(503).json({ message: razorpay.unavailableReason() });
  if (purchase.status === 'fulfilled' && purchase.giftCard) return res.json({ message: 'Your gift card has been emailed.', recipientEmail: purchase.recipientEmail });
  let payment;
  try { payment = await razorpay.getPayment(paymentId); }
  catch (error) { return res.status(502).json({ paymentPending: true, message: `Could not verify payment with Razorpay yet: ${error.message}` }); }
  if (payment.order_id !== orderId || payment.amount !== purchase.value * 100 || payment.currency !== 'INR') return res.status(409).json({ message: 'The payment details do not match this gift card. Please contact the bakery before retrying.' });
  if (payment.status === 'authorized') {
    try {
      await razorpay.capturePayment(paymentId, payment.amount);
      payment = await razorpay.getPayment(paymentId);
    } catch (error) {
      // Razorpay may finish capture while the capture request is returning an error.
      try { payment = await razorpay.getPayment(paymentId); }
      catch { return res.status(502).json({ paymentPending: true, message: 'Payment is authorized but not confirmed yet. Check payment again in a moment; the gift card will not be issued until capture succeeds.' }); }
      if (payment.status !== 'captured') {
        console.error(`Razorpay capture failed for gift card purchase ${purchase._id}: ${error.message}`);
        return res.status(502).json({ paymentPending: true, message: 'Payment is authorized but could not be captured yet. Check again shortly; the gift card will not be issued until capture succeeds.' });
      }
    }
  }
  if (payment.status === 'failed') return res.status(402).json({ paymentFailed: true, message: 'Razorpay reports that this payment failed. No gift card was issued.' });
  if (payment.status !== 'captured') return res.status(409).json({ paymentPending: true, message: 'Razorpay has not confirmed a captured payment yet. Check again in a moment; no gift card has been issued.' });
  // The Razorpay order can be paid with any method enabled for the merchant account.
  // Older pending purchases are stored as "upi", so accept those while they finish.
  if (!['razorpay', 'upi'].includes(purchase.paymentMethod)) return res.status(409).json({ message: 'This gift card purchase is not awaiting a Razorpay payment.' });
  purchase.paymentId = paymentId;
  purchase.paymentProviderMethod = String(payment.method || '');
  purchase.status = 'paid';
  await purchase.save();
  const session = await mongoose.startSession();
  let card;
  let code;
  try {
    await session.withTransaction(async () => {
      purchase = await GiftCardPurchase.findById(purchaseId).select('+deliveryCodeEncrypted').session(session);
      if (!purchase) throw new Error('Gift card purchase was not found.');
      card = await GiftCard.findOne({ purchaseRef: String(purchase._id) }).session(session);
      if (!card) {
        code = generateGiftCardCode();
        [card] = await GiftCard.create([{ purchaseRef: String(purchase._id), codeHash: codeHash(code), codeLast4: code.slice(-4), value: purchase.value, balance: purchase.value, recipientName: purchase.recipientName, recipientEmail: purchase.recipientEmail, message: purchase.message, design: purchase.design, emailTemplate: purchase.emailTemplate, offerName: purchase.offerName, expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) }], { session });
        await GiftCardTransaction.create([{ giftCard: card._id, type: 'issued', amount: purchase.value, balanceAfter: purchase.value, note: 'Customer gift card purchase' }], { session });
        purchase.giftCard = card._id;
        purchase.deliveryCodeEncrypted = encryptGiftCode(code);
        purchase.emailDeliveryStatus = 'queued';
        await purchase.save({ session });
      } else {
        if (!purchase.deliveryCodeEncrypted) throw Object.assign(new Error('Your gift card was issued, but its delivery code could not be recovered. Please contact the bakery with your payment ID.'), { status: 503 });
        try { code = decryptGiftCode(purchase.deliveryCodeEncrypted); }
        catch { throw Object.assign(new Error('Your gift card is ready, but its secure delivery code could not be recovered. Please contact the bakery with your payment ID.'), { status: 503 }); }
        if (['pending', 'failed'].includes(purchase.emailDeliveryStatus)) {
          purchase.emailDeliveryStatus = 'queued';
          await purchase.save({ session });
        }
      }
    });
  } catch (error) {
    if (error.status === 503) return res.status(503).json({ message: error.message });
    throw error;
  } finally { await session.endSession(); }
  queueGiftCardEmail(purchase._id);
  return res.json({ message: 'Payment confirmed. Your gift card is purchased and the email is being sent to its recipient.', recipientEmail: purchase.recipientEmail, emailQueued: true });
};
exports.issueGiftCard = async (req, res) => {
  const value = Number(req.body.value !== undefined ? req.body.value : req.body.initialBalance);
  if (!Number.isSafeInteger(value) || value < 100 || value > 100000) return res.status(400).json({ message: 'Gift card value must be between ₹100 and ₹100,000.' });
  const code = generateGiftCardCode();
  const allowedDesigns = ['sweet-moments', 'cake-love', 'birthday-bliss', 'just-because', 'with-love', 'special-treat'];
  const design = allowedDesigns.includes(req.body.design) ? req.body.design : 'sweet-moments';
  const emailTemplate = giftEmailTemplates.includes(req.body.emailTemplate) ? req.body.emailTemplate : design;
  const recipientName = String(req.body.recipientName || '').trim().slice(0, 100);
  const recipientEmail = String(req.body.recipientEmail || '').trim().slice(0, 200);
  const message = String(req.body.message || '').trim().slice(0, 300);
  const card = await GiftCard.create({ codeHash: codeHash(code), codeLast4: code.slice(-4), value, balance: value, recipientName, recipientEmail, message, design, emailTemplate, expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), issuedBy: req.user._id });
  await GiftCardTransaction.create({ giftCard: card._id, type: 'issued', amount: value, balanceAfter: value, note: 'Gift card issued' });
  let emailed = false;
  if (card.recipientEmail && require('../services/emailService').isConfigured()) {
    try {
      emailed = (await emailPurchasedGiftCard({ recipientEmail, recipientName, message, design, emailTemplate, offerName: 'Cakes of Paradise Gift Card', value }, code)).sent;
    } catch (error) { console.error(`Gift card email failed: ${error.message}`); }
  }
  return res.status(201).json({ message: `Gift card issued${emailed ? ' and emailed' : ''}. Copy this code now; it is only shown once.`, code, value, emailed });
};
exports.listGiftCards = async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 6));
  const search = String(req.query.search || '').trim().slice(0, 80);
  const status = String(req.query.status || 'all');
  const sort = req.query.sort === 'oldest' ? { createdAt: 1 } : req.query.sort === 'value-high' ? { value: -1, createdAt: -1 } : { createdAt: -1 };
  const filter = {};
  if (search) {
    const codeSuffix = search.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(-4);
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      ...(codeSuffix ? [{ codeLast4: { $regex: codeSuffix, $options: 'i' } }] : [{ codeLast4: { $regex: escaped, $options: 'i' } }]),
      { recipientName: { $regex: escaped, $options: 'i' } },
      { recipientEmail: { $regex: escaped, $options: 'i' } },
    ];
  }
  const now = new Date();
  if (status === 'active') Object.assign(filter, { active: true, expiresAt: { $gte: now }, balance: { $gt: 0 } });
  else if (status === 'expired') filter.expiresAt = { $lt: now };
  else if (status === 'inactive') filter.active = false;
  else if (status === 'used') filter.balance = 0;
  const [giftCards, count, total, soldIds, activeCount, expiredCount] = await Promise.all([
    GiftCard.find(filter).sort(sort).skip((page - 1) * limit).limit(limit),
    GiftCard.countDocuments(filter),
    GiftCard.countDocuments(),
    GiftCardTransaction.distinct('giftCard', { type: 'redeemed' }),
    GiftCard.countDocuments({ active: true, expiresAt: { $gte: now }, balance: { $gt: 0 } }),
    GiftCard.countDocuments({ expiresAt: { $lt: now } }),
  ]);
  res.set('Cache-Control', 'no-store');
  return res.json({ giftCards, count, page, pages: Math.max(1, Math.ceil(count / limit)), limit, summary: { total, sold: soldIds.length, active: activeCount, expired: expiredCount } });
};

exports.getAdminGiftCard = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid gift card.' });
  const card = await GiftCard.findById(req.params.id);
  if (!card) return res.status(404).json({ message: 'Gift card not found.' });
  const transactions = await GiftCardTransaction.find({ giftCard: card._id }).sort({ createdAt: -1 }).limit(30).populate('order', 'orderNumber');
  return res.json({ giftCard: card, transactions });
};

exports.updateAdminGiftCard = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid gift card.' });
  const card = await GiftCard.findById(req.params.id);
  if (!card) return res.status(404).json({ message: 'Gift card not found.' });
  card.recipientName = String(req.body.recipientName || '').trim().slice(0, 100);
  card.recipientEmail = String(req.body.recipientEmail || '').trim().slice(0, 200);
  card.message = String(req.body.message || '').trim().slice(0, 300);
  await card.save();
  return res.json({ message: 'Gift card details updated.', giftCard: card });
};

exports.setGiftCardActive = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid gift card.' });
  const active = req.body.active === true;
  const card = await GiftCard.findById(req.params.id);
  if (!card) return res.status(404).json({ message: 'Gift card not found.' });
  if (active && (card.expiresAt < new Date() || card.balance <= 0)) return res.status(409).json({ message: 'Expired or fully redeemed cards cannot be reactivated.' });
  card.active = active;
  await card.save();
  return res.json({ message: active ? 'Gift card activated.' : 'Gift card revoked.', giftCard: card });
};

exports.listGiftCardActivity = async (req, res) => {
  const limit = Math.min(20, Math.max(1, Number.parseInt(req.query.limit, 10) || 6));
  const transactions = await GiftCardTransaction.find().sort({ createdAt: -1 }).limit(limit).populate('giftCard', 'codeLast4 value balance recipientName').populate('order', 'orderNumber');
  return res.json({ activity: transactions.map((item) => ({
    id: String(item._id), type: item.type, amount: item.amount, balanceAfter: item.balanceAfter,
    note: item.note, orderNumber: item.order?.orderNumber || '', createdAt: item.createdAt,
    codeLast4: item.giftCard?.codeLast4 || '', recipientName: item.giftCard?.recipientName || '',
  })) });
};
exports.resolveCheckoutBenefits = async (promoCode, giftCode, subtotal, deliveryFee = 0, loyaltyDiscount = 0, userId = null) => {
  const enteredCode = String(promoCode || '').trim().toUpperCase();
  const promo = enteredCode ? await findPromoByCode(enteredCode) : null;
  if (promo?.user && String(promo.user) !== String(userId || '')) throw new Error('That offer code belongs to a different account. Sign in to the account that received it.');
  let code = enteredCode;
  let referrer = !promo && code ? await User.findOne({ referralCode: code }).select('_id') : null;
  if (!enteredCode && !promo && userId) {
    const account = await User.findById(userId).select('referredBy referralCodeUsed');
    code = String(account?.referralCodeUsed || '').trim().toUpperCase();
    referrer = account?.referredBy ? await User.findById(account.referredBy).select('_id') : (code ? await User.findOne({ referralCode: code }).select('_id') : null);
    if (referrer && (await Order.exists({ user: userId }) || await ReferralClaim.exists({ referee: userId, status: { $in: ['pending', 'rewarded'] } }))) {
      code = '';
      referrer = null;
    }
  }
  if (code && !promo && !referrer) throw new Error('Referral code is invalid or expired.');
  if (referrer && (!userId || String(referrer._id) === String(userId) || await Order.exists({ user: userId }) || await ReferralClaim.exists({ referee: userId, status: { $in: ['pending', 'rewarded'] } }))) throw new Error('Referral codes are for a friend’s first order only.');
  const discount = promo ? calculateDiscount(promo, subtotal) : 0;
  if (enteredCode && !discount && !referrer) throw new Error(promoUnavailableReason(promo, subtotal));
  let giftCard = null;
  if (giftCode) {
    giftCard = await GiftCard.findOne({ codeHash: codeHash(giftCode), active: true });
    if (!giftCard || giftCard.balance < 1 || giftCard.expiresAt < new Date()) throw new Error('Gift card is invalid, expired, or has no balance.');
  }
  return { promo, discount, referral: referrer ? { referrer: referrer._id, code } : null, giftCard, giftAmount: Math.min(giftCard?.balance || 0, subtotal - discount - loyaltyDiscount + deliveryFee) };
};
exports.hashGiftCode = codeHash;
