const mongoose = require('mongoose');
const User = require('../models/User');
const Order = require('../models/Order');
const Review = require('../models/Review');
const CakeEnquiry = require('../models/CakeEnquiry');
let bcrypt;
try {
  bcrypt = require('bcrypt');
  if (!bcrypt.hash) throw new Error();
} catch {
  bcrypt = require('bcryptjs');
}
const { isValidPassword, passwordPolicyMessage } = require('../utils/passwordPolicy');
const { withCategoryMatchedImage } = require('../utils/productImages');

exports.listEnquiries = async (req, res) => {
  const enquiries = await CakeEnquiry.find().sort({ createdAt: -1 }).limit(200).lean();
  return res.json({ enquiries });
};

exports.listCustomers = async (req, res) => {
  const search = String(req.query.search || '').trim().slice(0, 80);
  const filter = { role: 'user' };
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { name: { $regex: escaped, $options: 'i' } },
      { email: { $regex: escaped, $options: 'i' } },
      { phone: { $regex: escaped, $options: 'i' } },
    ];
  }
  const customers = await User.find(filter).sort({ createdAt: -1 }).limit(100).select('name email phone createdAt loyaltyPoints');
  const orderCounts = await Order.aggregate([
    { $match: { user: { $in: customers.map((customer) => customer._id) } } },
    { $group: { _id: '$user', orders: { $sum: 1 } } },
  ]);
  const countByUser = new Map(orderCounts.map((entry) => [String(entry._id), entry.orders]));
  return res.json({ customers: customers.map((customer) => ({
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone || '',
    createdAt: customer.createdAt,
    loyaltyPoints: customer.loyaltyPoints || 0,
    orderCount: countByUser.get(String(customer._id)) || 0,
  })) });
};

exports.createCustomer = async (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 100);
  const email = String(req.body.email || '').trim().toLowerCase();
  const phone = String(req.body.phone || '').trim().slice(0, 24);
  const password = String(req.body.password || '');
  if (!name) return res.status(400).json({ message: 'Enter the customer’s name.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,63}$/.test(email)) return res.status(400).json({ message: 'Enter a valid email address.' });
  if (!isValidPassword(password)) return res.status(400).json({ message: passwordPolicyMessage });
  if (phone && !/^[+\d][\d\s().-]{5,23}$/.test(phone)) return res.status(400).json({ message: 'Enter a valid phone number, or leave it blank.' });
  if (await User.exists({ email })) return res.status(409).json({ message: 'An account already uses this email address.' });

  const customer = await User.create({ name, email, phone, password: await bcrypt.hash(password, 10), role: 'user' });
  return res.status(201).json({
    message: 'Customer account created. Share the temporary password with them privately.',
    customer: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone || '', createdAt: customer.createdAt, loyaltyPoints: customer.loyaltyPoints || 0, orderCount: 0 },
  });
};

exports.deleteCustomer = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.userId)) return res.status(400).json({ message: 'Choose a valid customer account.' });
  const customer = await User.findOne({ _id: req.params.userId, role: 'user' });
  if (!customer) return res.status(404).json({ message: 'Customer account not found.' });

  const activeOrder = await Order.exists({ user: customer._id, status: { $nin: ['completed', 'cancelled'] } });
  if (activeOrder) return res.status(409).json({ message: 'This customer has an active order. Finish or cancel it before removing the account.' });

  // Keep financial/order history for the bakery while removing identifiable customer details.
  await Order.updateMany({ user: customer._id }, { $set: {
    'customer.name': 'Former customer',
    'customer.email': '',
    'customer.phone': '',
    'customer.address': 'Removed with customer account',
    'customer.area': '',
    'customer.postalCode': '',
  } });
  await Review.deleteMany({ user: customer._id });
  await User.deleteOne({ _id: customer._id, role: 'user' });
  return res.json({ message: 'Customer account removed. Historical orders remain with personal details anonymized.' });
};

exports.listReviews = async (req, res) => {
  const Product = require('../models/Product');
  const status = String(req.query.status || 'all');
  const search = String(req.query.search || '').trim().slice(0, 100);
  const rating = Number(req.query.rating || 0);
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 7));
  if (!['all', 'published', 'hidden'].includes(status)) return res.status(400).json({ message: 'Choose Published or Hidden reviews.' });
  if (req.query.rating && (!Number.isInteger(rating) || rating < 1 || rating > 5)) return res.status(400).json({ message: 'Choose a rating from 1 to 5.' });

  const products = await Product.find({}).select('slug name image images').lean();
  const productMap = new Map(products.map(p => [p.slug, p]));
  const filter = {};
  if (status === 'published') filter.status = { $in: ['published', 'approved'] };
  if (status === 'hidden') filter.status = { $in: ['hidden', 'pending', 'rejected'] };
  if (rating) filter.rating = rating;
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matchingProducts = products.filter(p => p.name?.toLowerCase().includes(search.toLowerCase())).map(p => p.slug);
    filter.$or = [
      { customerName: { $regex: escaped, $options: 'i' } },
      { customerEmail: { $regex: escaped, $options: 'i' } },
      { comment: { $regex: escaped, $options: 'i' } },
      { productId: { $in: matchingProducts } },
    ];
  }
  const [total, matchedTotal, positiveCount, hiddenCount, publishedSummary, pageRows, recentRows, highestGroups] = await Promise.all([
    Review.countDocuments(),
    Review.countDocuments(filter),
    Review.countDocuments({ rating: { $gte: 4 }, status: { $in: ['published', 'approved'] } }),
    Review.countDocuments({ status: { $in: ['hidden', 'pending', 'rejected'] } }),
    Review.aggregate([{ $match: { status: { $in: ['published', 'approved'] } } }, { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } }]),
    Review.find(filter).sort({ reviewDate: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('user', 'name email').lean(),
    Review.find().sort({ reviewDate: -1, createdAt: -1 }).limit(5).populate('user', 'name email').lean(),
    Review.aggregate([
      { $match: { status: { $in: ['published', 'approved'] } } },
      { $group: { _id: '$productId', average: { $avg: '$rating' }, count: { $sum: 1 } } },
      { $sort: { average: -1, count: -1 } }, { $limit: 5 },
    ]),
  ]);
  const formatReview = (r) => {
    const product = productMap.get(r.productId);
    const normalizedStatus = r.status === 'approved' ? 'published' : ['hidden', 'pending', 'rejected'].includes(r.status) ? 'hidden' : r.status;
    const imageProduct = withCategoryMatchedImage(product);
    return { ...r, customerEmail: r.customerEmail || r.user?.email || '', productName: product?.name || r.productId, productImage: imageProduct?.images?.[0] || imageProduct?.image || '', status: normalizedStatus };
  };
  const highestRatedCakes = highestGroups.map(group => {
    const product = withCategoryMatchedImage(productMap.get(group._id));
    return {
      productId: group._id,
      productName: product?.name || group._id,
      productImage: product?.images?.[0] || product?.image || '',
      averageRating: Number(group.average.toFixed(1)),
      reviewCount: group.count,
    };
  });
  return res.json({
    reviews: pageRows.map(formatReview),
    stats: { totalReviews: total, positiveReviews: positiveCount, averageRating: Number((publishedSummary[0]?.average || 0).toFixed(1)), hiddenReviews: hiddenCount },
    recentReviews: recentRows.map(formatReview),
    highestRatedCakes,
    pagination: { page, limit, total: matchedTotal, pages: Math.max(1, Math.ceil(matchedTotal / limit)) },
  });
};

exports.updateReviewStatus = async (req, res) => {
  const { status } = req.body;
  if (!['published', 'hidden'].includes(status)) {
    return res.status(400).json({ message: 'Choose Published or Hidden.' });
  }
  const review = await Review.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!review) return res.status(404).json({ message: 'Review not found.' });
  return res.json({ message: `Review ${status === 'published' ? 'published' : 'hidden'} successfully.`, review });
};

exports.updateReview = async (req, res) => {
  const Product = require('../models/Product');
  const review = await Review.findById(req.params.id);
  if (!review) return res.status(404).json({ message: 'Review not found.' });
  const productId = typeof req.body.productId === 'string' ? req.body.productId.trim() : '';
  const customerName = typeof req.body.customerName === 'string' ? req.body.customerName.trim() : '';
  const customerEmail = typeof req.body.customerEmail === 'string' ? req.body.customerEmail.trim().toLowerCase() : '';
  const rating = Number(req.body.rating);
  const comment = typeof req.body.reviewText === 'string' ? req.body.reviewText.trim() : '';
  const date = typeof req.body.reviewDate === 'string' ? req.body.reviewDate : '';
  if (!productId || !customerName || customerName.length > 80 || (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) || !Number.isInteger(rating) || rating < 1 || rating > 5 || comment.length < 2 || comment.length > 600) {
    return res.status(400).json({ message: 'Enter a customer name and valid email, choose a cake and 1–5 stars, and write a review under 600 characters.' });
  }
  if (date) {
    const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00.000Z`) : null;
    if (!parsedDate || parsedDate.toISOString().slice(0, 10) !== date) return res.status(400).json({ message: 'Choose a valid review date.' });
    review.reviewDate = new Date(`${date}T12:00:00+05:30`);
  }
  if (!await Product.exists({ slug: productId })) return res.status(404).json({ message: 'Cake not found.' });
  if (req.body.status !== undefined && !['published', 'hidden'].includes(req.body.status)) return res.status(400).json({ message: 'Choose Published or Hidden.' });
  review.productId = productId;
  review.customerName = customerName;
  review.customerEmail = customerEmail;
  review.rating = rating;
  review.comment = comment;
  if (req.body.status) review.status = req.body.status;
  else if (review.status === 'approved') review.status = 'published';
  else if (['pending', 'rejected'].includes(review.status)) review.status = 'hidden';
  await review.save();
  return res.json({ message: 'Review changes saved.', review });
};

exports.deleteReview = async (req, res) => {
  const review = await Review.findByIdAndDelete(req.params.id);
  if (!review) return res.status(404).json({ message: 'Review not found.' });
  return res.json({ message: 'Review deleted successfully.' });
};

exports.addManualReview = async (req, res) => {
  const Product = require('../models/Product');
  const productId = typeof req.body.productId === 'string' ? req.body.productId.trim() : '';
  const customerFirstName = typeof req.body.customerFirstName === 'string' ? req.body.customerFirstName.trim() : typeof req.body.customerName === 'string' ? req.body.customerName.trim() : '';
  const customerEmail = typeof req.body.customerEmail === 'string' ? req.body.customerEmail.trim().toLowerCase() : '';
  const rating = Number(req.body.rating);
  const text = typeof req.body.reviewText === 'string' ? req.body.reviewText.trim() : typeof req.body.comment === 'string' ? req.body.comment.trim() : '';
  const date = req.body.reviewDate;
  const permissionGiven = req.body.permissionGiven === true || req.body.permissionGiven === 'true';

  const parsedDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00.000Z`) : null;
  if (!productId || !customerFirstName || customerFirstName.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail) || !Number.isInteger(rating) || rating < 1 || rating > 5 || !text || text.length < 2 || text.length > 600 || (date && (!parsedDate || parsedDate.toISOString().slice(0, 10) !== date))) {
    return res.status(400).json({ message: 'Enter a customer name and valid email, choose a cake and 1–5 stars, and add review text under 600 characters.' });
  }
  if (!permissionGiven) {
    return res.status(400).json({ message: 'Customer permission to publish is required.' });
  }
  const numRating = Number(rating);
  if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
    return res.status(400).json({ message: 'Rating must be between 1 and 5 stars.' });
  }
  const productExists = await Product.exists({ slug: productId });
  if (!productExists) return res.status(404).json({ message: 'Cake not found.' });

  const review = await Review.create({
    productId,
    customerName: customerFirstName,
    customerEmail,
    rating: numRating,
    comment: text,
    ...(date ? { reviewDate: new Date(`${date}T12:00:00+05:30`) } : {}),
    status: 'published',
    source: 'manual',
    permissionGiven: true,
    addedBy: req.user._id,
  });
  return res.status(201).json({ message: 'Manual feedback review published successfully.', review });
};

exports.updateManualReview = async (req, res) => {
  const Product = require('../models/Product');
  const review = await Review.findOne({ _id: req.params.id, source: 'manual' });
  if (!review) return res.status(404).json({ message: 'Manual review not found.' });
  const productId = typeof req.body.productId === 'string' ? req.body.productId.trim() : '';
  const customerName = typeof req.body.customerName === 'string' ? req.body.customerName.trim() : typeof req.body.customerFirstName === 'string' ? req.body.customerFirstName.trim() : '';
  const customerEmail = typeof req.body.customerEmail === 'string' ? req.body.customerEmail.trim().toLowerCase() : '';
  const rating = Number(req.body.rating);
  const comment = typeof req.body.reviewText === 'string' ? req.body.reviewText.trim() : '';
  const date = typeof req.body.reviewDate === 'string' ? req.body.reviewDate : '';
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00.000Z`) : null;
  if (!productId || !customerName || customerName.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail) || !Number.isInteger(rating) || rating < 1 || rating > 5 || !comment || comment.length < 2 || comment.length > 600 || req.body.permissionGiven !== true || (date && (!parsedDate || parsedDate.toISOString().slice(0, 10) !== date))) return res.status(400).json({ message: 'Complete the customer details, rating and review text, and confirm customer permission.' });
  if (!await Product.exists({ slug: productId })) return res.status(404).json({ message: 'Cake not found.' });
  review.productId = productId;
  review.customerName = customerName;
  review.customerEmail = customerEmail;
  review.rating = rating;
  review.comment = comment;
  if (date) review.reviewDate = new Date(`${date}T12:00:00+05:30`);
  review.permissionGiven = true;
  if (req.body.status && !['published', 'hidden'].includes(req.body.status)) return res.status(400).json({ message: 'Choose Published or Hidden.' });
  review.status = req.body.status || (['hidden', 'pending', 'rejected'].includes(review.status) ? 'hidden' : 'published');
  await review.save();
  return res.json({ message: 'Manual review updated successfully.', review });
};
