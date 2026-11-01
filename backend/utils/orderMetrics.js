// A sale is recognized only after both fulfilment and payment are complete.
// Keep this rule shared by the dashboard, date reports, and completed-order list.
const isSaleEligible = (order) => order?.status === 'completed' && order?.paymentStatus === 'paid';

const saleMatch = (window = {}) => ({ ...window, status: 'completed', paymentStatus: 'paid' });
const saleEligibleExpression = { $and: [{ $eq: ['$status', 'completed'] }, { $eq: ['$paymentStatus', 'paid'] }] };

// New orders store a per-unit price. Older records may have kept the same
// snapshot as `price`, or stored an already-calculated line amount instead.
// Only use values recorded on the order; today's catalogue price is not a
// trustworthy substitute for historical revenue.
const itemRevenueExpression = {
  $ifNull: [
    '$items.lineTotal',
    '$items.totalPrice',
    { $multiply: [{ $ifNull: ['$items.unitPrice', '$items.price'] }, '$items.quantity'] },
  ],
};

// Keep storefront bestsellers and admin top-selling reports on the same product
// identity and the same definition of a sale.
const productSalesPipeline = (window = {}) => [
  { $match: saleMatch(window) },
  { $unwind: '$items' },
  // Older orders may not have retained a line price. Pull the current price
  // for the exact size as a clearly marked estimate in that case.
  { $lookup: {
    from: 'products',
    let: { productSlug: '$items.productId', itemSize: '$items.size' },
    pipeline: [
      { $match: { $expr: { $eq: ['$slug', '$$productSlug'] } } },
      { $unwind: '$sizes' },
      { $match: { $expr: { $eq: ['$sizes.name', '$$itemSize'] } } },
      { $project: { _id: 0, unitPrice: '$sizes.price' } },
      { $limit: 1 },
    ],
    as: 'catalogPrice',
  } },
  { $set: { currentUnitPrice: { $arrayElemAt: ['$catalogPrice.unitPrice', 0] } } },
  { $group: {
    _id: '$items.productId',
    name: { $first: '$items.name' },
    units: { $sum: '$items.quantity' },
    sales: { $sum: { $ifNull: [itemRevenueExpression, 0] } },
    pricedUnits: { $sum: { $cond: [{ $ne: [itemRevenueExpression, null] }, '$items.quantity', 0] } },
    estimatedSales: { $sum: { $cond: [
      { $and: [{ $eq: [itemRevenueExpression, null] }, { $ne: ['$currentUnitPrice', null] }] },
      { $multiply: ['$currentUnitPrice', '$items.quantity'] }, 0,
    ] } },
    estimatedUnits: { $sum: { $cond: [
      { $and: [{ $eq: [itemRevenueExpression, null] }, { $ne: ['$currentUnitPrice', null] }] },
      '$items.quantity', 0,
    ] } },
    unpricedUnits: { $sum: { $cond: [
      { $and: [{ $eq: [itemRevenueExpression, null] }, { $eq: ['$currentUnitPrice', null] }] },
      '$items.quantity', 0,
    ] } },
  } },
  { $project: {
    name: 1,
    units: 1,
    sales: { $cond: [{ $eq: ['$unpricedUnits', 0] }, { $add: ['$sales', '$estimatedSales'] }, null] },
    salesIsEstimated: { $gt: ['$estimatedUnits', 0] },
  } },
  { $sort: { units: -1, _id: 1 } },
];

const salesSummaryPipeline = (window) => [
  { $match: window },
  { $group: {
    _id: null,
    orders: { $sum: 1 },
    pendingOrders: { $sum: { $cond: [{ $in: ['$status', ['placed', 'confirmed', 'preparing', 'ready', 'shipped', 'out-for-delivery']] }, 1, 0] } },
    completedOrders: { $sum: { $cond: [saleEligibleExpression, 1, 0] } },
    cancelledOrders: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
    revenue: { $sum: { $cond: [saleEligibleExpression, '$total', 0] } },
    paidOrders: { $sum: { $cond: [saleEligibleExpression, 1, 0] } },
  } },
];

module.exports = { isSaleEligible, saleMatch, productSalesPipeline, salesSummaryPipeline };
