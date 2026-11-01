const Order = require('../models/Order');
const Review = require('../models/Review');
const User = require('../models/User');
const Product = require('../models/Product');
const CakeEnquiry = require('../models/CakeEnquiry');
const { paidRevenueMatch, productSalesPipeline, salesSummaryPipeline } = require('../utils/orderMetrics');

exports.getSalesInsights = async (req, res) => {
  const now = new Date();
  const start = req.query.from ? new Date(`${req.query.from}T00:00:00+05:30`) : new Date(`${now.toISOString().slice(0, 7)}-01T00:00:00+05:30`);
  const end = req.query.to ? new Date(`${req.query.to}T23:59:59.999+05:30`) : now;
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return res.status(400).json({ message: 'Choose a valid date range.' });

  const orderWindow = { createdAt: { $gte: start, $lte: end } };
  let topCakesWindow = null;
  if (req.query.cakesFrom || req.query.cakesTo) {
    const cakesStart = req.query.cakesFrom ? new Date(`${req.query.cakesFrom}T00:00:00+05:30`) : null;
    const cakesEnd = req.query.cakesTo ? new Date(`${req.query.cakesTo}T23:59:59.999+05:30`) : new Date();
    if ((cakesStart && Number.isNaN(cakesStart.getTime())) || Number.isNaN(cakesEnd.getTime()) || (cakesStart && cakesStart > cakesEnd)) return res.status(400).json({ message: 'Choose a valid top-selling cakes date range.' });
    topCakesWindow = { createdAt: { ...(cakesStart ? { $gte: cakesStart } : {}), $lte: cakesEnd } };
  }
  let comparisonWindow = null;
  if (req.query.compareFrom || req.query.compareTo) {
    if (!req.query.compareFrom || !req.query.compareTo) return res.status(400).json({ message: 'Choose both dates for the comparison period.' });
    const compareStart = new Date(`${req.query.compareFrom}T00:00:00+05:30`);
    const compareEnd = new Date(`${req.query.compareTo}T23:59:59.999+05:30`);
    if (Number.isNaN(compareStart.getTime()) || Number.isNaN(compareEnd.getTime()) || compareStart > compareEnd) return res.status(400).json({ message: 'Choose a valid comparison date range.' });
    comparisonWindow = { createdAt: { $gte: compareStart, $lte: compareEnd } };
  }

  const paidRevenueWindow = paidRevenueMatch(orderWindow);
  const [summary, topCakes, comparisonSummary, comparisonTopCakes, upcoming, feedback, recentReviews, revenueByDay, orderStatuses, customerCount, productCount, newEnquiryCount, wishlistItems, topWishlisted] = await Promise.all([
    Order.aggregate(salesSummaryPipeline(orderWindow)),
    Order.aggregate([...productSalesPipeline(topCakesWindow || {}), { $limit: 8 }]),
    comparisonWindow ? Order.aggregate(salesSummaryPipeline(comparisonWindow)) : Promise.resolve([]),
    comparisonWindow ? Order.aggregate([...productSalesPipeline(comparisonWindow), { $limit: 8 }]) : Promise.resolve([]),
    Order.find({ status: { $nin: ['completed', 'cancelled'] }, 'customer.deliveryDate': { $gte: new Date(), $lte: new Date(Date.now() + 14 * 86400000) } }).sort({ 'customer.deliveryDate': 1 }).limit(12).select('orderNumber customer.name customer.deliveryDate customer.deliveryTime status paymentStatus'),
    Review.aggregate([{ $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } }]),
    Review.find().sort({ createdAt: -1 }).limit(5).select('customerName rating comment productId createdAt'),
    Order.aggregate([{ $match: paidRevenueWindow }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } }, revenue: { $sum: '$total' }, orders: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    Order.aggregate([{ $match: orderWindow }, { $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    User.countDocuments({ role: 'user' }),
    Product.countDocuments({}),
    CakeEnquiry.countDocuments({ status: 'new' }),
    User.aggregate([{ $match: { role: 'user' } }, { $project: { favoriteCount: { $size: { $ifNull: ['$favoriteProducts', []] } } } }, { $group: { _id: null, total: { $sum: '$favoriteCount' } } }]),
    User.aggregate([{ $match: { role: 'user' } }, { $unwind: '$favoriteProducts' }, { $group: { _id: '$favoriteProducts', count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }, { $limit: 50 }]),
  ]);

  res.set('Cache-Control', 'no-store');
  return res.json({
    summary: summary[0] || { orders: 0, pendingOrders: 0, completedOrders: 0, cancelledOrders: 0, revenue: 0, paidOrders: 0 },
    topCakes,
    comparison: { summary: comparisonSummary[0] || { orders: 0, pendingOrders: 0, completedOrders: 0, cancelledOrders: 0, revenue: 0, paidOrders: 0 }, topCakes: comparisonTopCakes },
    revenueByDay,
    orderStatuses,
    customerCount,
    dashboardCounts: { products: productCount, newEnquiries: newEnquiryCount, wishlistItems: wishlistItems[0]?.total || 0 },
    topWishlisted,
    upcoming,
    feedback: feedback[0] || { average: 0, count: 0 },
    recentReviews,
  });
};
