const User = require('../models/User');
const Product = require('../models/Product');
const { withCategoryMatchedImage } = require('../utils/productImages');
const Order = require('../models/Order');
const LoyaltyTransaction = require('../models/LoyaltyTransaction');
const crypto = require('crypto');
const StorePolicy = require('../models/StorePolicy');
const { getReferralRewards } = require('../utils/referralRewards');

const ensureReferralCode = async (user) => {
  if (user.referralCode) return user.referralCode;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = `CAKE${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    try {
      const updated = await User.findOneAndUpdate({ _id: user._id, $or: [{ referralCode: { $exists: false } }, { referralCode: '' }] }, { $set: { referralCode: code } }, { new: true });
      if (updated?.referralCode) return updated.referralCode;
      const current = await User.findById(user._id).select('referralCode');
      if (current?.referralCode) return current.referralCode;
    } catch (error) { if (error.code !== 11000) throw error; }
  }
  throw new Error('Could not create a referral code. Please try again.');
};

exports.getAccount = async (req, res) => {
  const [user, loyaltyHistory, orders, policy] = await Promise.all([
    User.findById(req.user._id).select('name email phone dateOfBirth savedAddresses favoriteProducts loyaltyPoints giftWalletBalance birthdayMonthDay anniversaryMonthDay birthdayReminderOptIn anniversaryReminderOptIn occasions referralCode referralCodeUsed'),
    LoyaltyTransaction.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(20).populate('order', 'orderNumber').select('kind points note createdAt order'),
    Order.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(20).select('orderNumber status total createdAt items'),
    StorePolicy.findById('default').select('referralFriendPoints referralOwnerPoints'),
  ]);
  const referralCode = await ensureReferralCode(user);
  const referralRewards = getReferralRewards(policy);
  return res.json({ user: { ...user.toObject(), referralCode }, referralPolicy: { referralFriendPoints: referralRewards.customerPoints, referralOwnerPoints: referralRewards.referrerPoints }, loyaltyHistory: loyaltyHistory.map((item) => ({ kind: item.kind, points: item.points, note: item.note, orderNumber: item.order?.orderNumber || '', createdAt: item.createdAt })), orders });
};

exports.updatePreferences = async (req, res) => {
  const normalizeDate = (value) => {
    if (!value) return '';
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [, month, day] = value.split('-');
    const check = new Date(Date.UTC(2000, Number(month) - 1, Number(day)));
    if (check.getUTCMonth() !== Number(month) - 1 || check.getUTCDate() !== Number(day)) return null;
    return `${month}-${day}`;
  };
  if (Array.isArray(req.body.occasions)) {
    if (req.body.occasions.length > 20) return res.status(400).json({ message: 'You can save up to 20 occasions.' });
    const occasions = [];
    for (const item of req.body.occasions) {
      if (!item || typeof item.title !== 'string' || !item.title.trim() || item.title.trim().length > 60 || typeof item.personName !== 'string' || !item.personName.trim() || item.personName.trim().length > 100 || typeof item.relationship !== 'string' || !item.relationship.trim() || item.relationship.trim().length > 30 || typeof item.reminderOptIn !== 'boolean') return res.status(400).json({ message: 'Add the person’s name, relationship, occasion, and reminder choice.' });
      const dateMonthDay = normalizeDate(item.date);
      if (!dateMonthDay) return res.status(400).json({ message: 'Enter a valid date for every occasion.' });
      if (item.id !== undefined && (typeof item.id !== 'string' || !/^[a-f\d]{24}$/i.test(item.id))) return res.status(400).json({ message: 'An occasion identifier was invalid. Reload and try again.' });
      occasions.push({ ...(item.id ? { _id: item.id } : {}), personName: item.personName.trim(), relationship: item.relationship.trim(), title: item.title.trim(), dateMonthDay, reminderOptIn: item.reminderOptIn });
    }
    const user = await User.findByIdAndUpdate(req.user._id, { $set: { occasions, birthdayMonthDay: '', anniversaryMonthDay: '', birthdayReminderOptIn: false, anniversaryReminderOptIn: false } }, { new: true, runValidators: true }).select('occasions');
    return res.json({ message: 'Reminder preferences saved.', preferences: user });
  }
  // Keep the original endpoint payload working for older storefront clients.
  const birthday = normalizeDate(req.body.birthday);
  const anniversary = normalizeDate(req.body.anniversary);
  if (birthday === null || anniversary === null || typeof req.body.birthdayReminderOptIn !== 'boolean' || typeof req.body.anniversaryReminderOptIn !== 'boolean') return res.status(400).json({ message: 'Enter valid dates and choose reminder consent for each occasion.' });
  const user = await User.findByIdAndUpdate(req.user._id, { $set: { birthdayMonthDay: birthday, anniversaryMonthDay: anniversary, birthdayReminderOptIn: req.body.birthdayReminderOptIn, anniversaryReminderOptIn: req.body.anniversaryReminderOptIn } }, { new: true }).select('birthdayMonthDay anniversaryMonthDay birthdayReminderOptIn anniversaryReminderOptIn');
  return res.json({ message: 'Reminder preferences saved.', preferences: user });
};

exports.addAddress = async (req, res) => {
  const { address, area, city, postalCode, phone, recipientName, label } = req.body;
  if (typeof address !== 'string' || address.trim().length < 8 || address.length > 400 || typeof area !== 'string' || !area.trim() || area.length > 80 || typeof city !== 'string' || !city.trim() || city.length > 80 || typeof postalCode !== 'string' || !/^\d{6}$/.test(postalCode.trim())) return res.status(400).json({ message: 'Enter a full address, area, city, and 6-digit PIN code.' });
  if (phone !== undefined && (typeof phone !== 'string' || phone.length > 24)) return res.status(400).json({ message: 'Enter a valid phone number.' });
  const user = await User.findById(req.user._id);
  user.savedAddresses ||= [];
  const normalizedAddress = { address: address.trim(), area: area.trim(), city: city.trim(), postalCode: postalCode.trim(), phone: String(phone || '').trim(), recipientName: String(recipientName || '').trim().slice(0, 100), label: String(label || '').trim().slice(0, 40) };
  const normalize = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const duplicate = user.savedAddresses.some((saved) => ['address', 'area', 'city', 'postalCode'].every((field) => normalize(saved[field]) === normalize(normalizedAddress[field])));
  if (duplicate) return res.json({ addresses: user.savedAddresses, message: 'This address is already saved.' });
  if (user.savedAddresses.length >= 10) return res.status(400).json({ message: 'You can save up to 10 addresses.' });
  user.savedAddresses.push(normalizedAddress);
  await user.save();
  return res.status(201).json({ addresses: user.savedAddresses, message: 'Address saved to your account.' });
};

exports.deleteAddress = async (req, res) => {
  const user = await User.findById(req.user._id);
  user.savedAddresses = user.savedAddresses.filter((address) => String(address._id) !== req.params.addressId);
  await user.save();
  return res.json({ addresses: user.savedAddresses });
};

exports.toggleFavorite = async (req, res) => {
  const slug = String(req.params.productId || '');
  if (!await Product.exists({ slug })) return res.status(404).json({ message: 'Cake not found.' });
  const user = await User.findById(req.user._id);
  const index = user.favoriteProducts.indexOf(slug);
  if (index >= 0) user.favoriteProducts.splice(index, 1);
  else user.favoriteProducts.push(slug);
  await user.save();
  return res.json({ favoriteProducts: user.favoriteProducts, isFavorite: index < 0 });
};

// Cart contents are stored on the authenticated customer record. Product names,
// images, and prices are always hydrated from the catalogue when returned.
exports.getCart = async (req, res) => {
  const user = await User.findById(req.user._id).select('cart');
  const items = user?.cart || [];
  const productIds = [...new Set(items.map((line) => line.productId))];
  const products = await Product.find({ slug: { $in: productIds }, available: true }).lean();
  const bySlug = new Map(products.map((product) => [product.slug, product]));
  const lines = items.flatMap((line) => {
    const product = bySlug.get(line.productId);
    const size = product?.sizes?.find((item) => item.name === line.size);
    if (!product || !size || !product.flavors.includes(line.flavor)) return [];
    return [{ productId: product.slug, name: product.name, category: product.category, image: withCategoryMatchedImage(product).image, flavor: line.flavor, size: line.size, cakeMessage: line.cakeMessage || '', price: size.price, quantity: line.quantity }];
  });
  return res.json({ cart: lines });
};

exports.replaceCart = async (req, res) => {
  if (!Array.isArray(req.body.cart) || req.body.cart.length > 50) return res.status(400).json({ message: 'Cart must contain up to 50 cake options.' });
  const combined = new Map();
  for (const line of req.body.cart) {
    if (!line || typeof line.productId !== 'string' || typeof line.size !== 'string' || typeof line.flavor !== 'string' || line.cakeMessage !== undefined && (typeof line.cakeMessage !== 'string' || line.cakeMessage.length > 50) || !Number.isInteger(Number(line.quantity)) || Number(line.quantity) < 1 || Number(line.quantity) > 10) return res.status(400).json({ message: 'Each cart item needs a cake, size, flavor, optional cake message up to 50 characters, and quantity from 1 to 10.' });
    const cakeMessage = String(line.cakeMessage || '').trim();
    const key = `${line.productId}\u0000${line.size}\u0000${line.flavor}\u0000${cakeMessage}`;
    const previous = combined.get(key);
    combined.set(key, { productId: line.productId.trim(), size: line.size.trim(), flavor: previous?.flavor || line.flavor.trim(), cakeMessage, quantity: Math.min(10, (previous?.quantity || 0) + Number(line.quantity)) });
  }
  const saved = [...combined.values()];
  const products = await Product.find({ slug: { $in: [...new Set(saved.map((line) => line.productId))] }, available: true }).lean();
  const bySlug = new Map(products.map((product) => [product.slug, product]));
  for (const line of saved) {
    const product = bySlug.get(line.productId);
    if (!product || !product.sizes.some((item) => item.name === line.size) || !product.flavors.includes(line.flavor)) return res.status(400).json({ message: 'A cake, size, or flavor in your cart is no longer available. Refresh and try again.' });
  }
  await User.updateOne({ _id: req.user._id }, { $set: { cart: saved } }, { runValidators: true });
  const cart = saved.map((line) => {
    const product = bySlug.get(line.productId);
    return { ...line, name: product.name, category: product.category, image: withCategoryMatchedImage(product).image, price: product.sizes.find((item) => item.name === line.size).price };
  });
  return res.json({ message: 'Cart saved to your account.', cart });
};
