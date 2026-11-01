// Isolated end-to-end checks for order/payment transitions. Uses a dedicated
// database and an in-process Razorpay test double; it never contacts the gateway.
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const testDatabase = process.env.ORDER_FLOW_TEST_DB || '';
if (!/^cakes_flow_test_[a-z0-9_]+$/i.test(testDatabase)) throw new Error('Set ORDER_FLOW_TEST_DB to a unique cakes_flow_test_* database name.');
if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');
// MongoDB connection strings may contain multiple hosts, which the WHATWG URL
// parser rejects. Replace only the database path and keep the auth, host list,
// and query options intact.
const originalMongoUri = process.env.MONGODB_URI;
const protocolEnd = originalMongoUri.indexOf('://');
if (protocolEnd < 0 || !/^mongodb(?:\+srv)?:\/\//i.test(originalMongoUri)) throw new Error('MONGODB_URI must be a valid MongoDB connection string.');
const authorityStart = protocolEnd + 3;
const firstPathSlash = originalMongoUri.indexOf('/', authorityStart);
const firstQuery = originalMongoUri.indexOf('?', authorityStart);
const hasDatabasePath = firstPathSlash >= 0 && (firstQuery < 0 || firstPathSlash < firstQuery);
const queryStart = hasDatabasePath ? originalMongoUri.indexOf('?', firstPathSlash) : firstQuery;
const uriPrefix = hasDatabasePath ? originalMongoUri.slice(0, firstPathSlash) : originalMongoUri.slice(0, queryStart < 0 ? originalMongoUri.length : queryStart);
const uriQuery = queryStart < 0 ? '' : originalMongoUri.slice(queryStart);
process.env.MONGODB_URI = `${uriPrefix}/${testDatabase}${uriQuery}`;
process.env.RAZORPAY_KEY_ID = 'rzp_test_isolated_flow';
process.env.RAZORPAY_KEY_SECRET = 'isolated-test-secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'isolated-test-webhook';
process.env.RESEND_API_KEY = '';
process.env.ORDER_EMAIL_FROM = '';
process.env.WHATSAPP_TOKEN = '';
process.env.WHATSAPP_PHONE_NUMBER_ID = '';
process.env.WHATSAPP_TEMPLATE_NAME = '';

const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const razorpay = require('../services/razorpay');
const { isSaleEligible } = require('../utils/orderMetrics');
const { app } = require('../server');

let providerOrderId = '';
let refundId = '';
let refundStartCount = 0;
razorpay.createOrder = async (amount) => {
  providerOrderId = `order_test_${Date.now()}`;
  return { id: providerOrderId, amount: amount * 100, currency: 'INR' };
};
razorpay.verifyCheckoutSignature = () => true;
razorpay.getPayment = async (paymentId) => ({
  id: paymentId,
  order_id: providerOrderId,
  amount: 70000,
  status: paymentId === 'pay_test_failed' ? 'failed' : 'captured',
});
razorpay.refundPayment = async () => {
  refundStartCount += 1;
  refundId = `rfnd_test_${Date.now()}`;
  return { id: refundId, status: 'pending' };
};
razorpay.getRefund = async (id) => ({ id, status: 'pending' });
razorpay.verifyWebhookSignature = () => true;

const activeStatuses = ['placed', 'confirmed', 'preparing', 'ready', 'out-for-delivery'];
let server;
let baseUrl;
let adminToken;
let customerToken;
let customerId;
let productSlug = 'isolated-flow-test-cake';

const api = async (path, { method = 'GET', token = adminToken, body } = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  return { status: response.status, data };
};

const dateInFuture = (days = 4) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const checkoutPayload = (paymentMethod, deliveryType) => ({
  items: [{ productId: productSlug, size: '1 kg', flavor: 'Vanilla', quantity: 1 }],
  paymentMethod,
  customer: {
    name: 'Payment Flow Test Customer', phone: '9876543210', deliveryType,
    address: deliveryType === 'pickup' ? '' : 'Test address, Surathkal',
    area: deliveryType === 'pickup' ? '' : 'Surathkal', city: deliveryType === 'pickup' ? '' : 'Mangaluru',
    postalCode: deliveryType === 'pickup' ? '' : '575014', deliveryDate: dateInFuture(), deliveryTime: '12:00', notes: '',
  },
});

const must = (condition, message) => { if (!condition) throw new Error(message); };
const createOrder = async (paymentMethod, deliveryType) => {
  const result = await api('/api/orders', { method: 'POST', token: customerToken, body: checkoutPayload(paymentMethod, deliveryType) });
  assert.equal(result.status, 201, `Create ${paymentMethod} order failed: ${result.data.message}`);
  return result.data.order;
};
const setStatus = async (order, status, extra = {}) => {
  const result = await api(`/api/orders/admin/${encodeURIComponent(order.orderNumber)}/status`, { method: 'PATCH', body: { status, ...extra } });
  assert.equal(result.status, 200, `Set ${status} failed: ${result.data.message}`);
  return result.data.order;
};

const assertDashboardMatchesDatabase = async (label) => {
  const today = new Date().toISOString().slice(0, 10);
  const from = `${today.slice(0, 7)}-01`;
  const result = await api(`/api/admin/insights?from=${from}&to=${today}`);
  assert.equal(result.status, 200, `Dashboard request failed: ${result.data.message}`);
  const start = new Date(`${from}T00:00:00.000+05:30`);
  const end = new Date(`${today}T23:59:59.999+05:30`);
  const orders = await Order.find({ createdAt: { $gte: start, $lte: end } }).lean();
  const expected = {
    orders: orders.length,
    pendingOrders: orders.filter((order) => activeStatuses.includes(order.status)).length,
    completedOrders: orders.filter(isSaleEligible).length,
    cancelledOrders: orders.filter((order) => order.status === 'cancelled').length,
    revenue: orders.filter(isSaleEligible).reduce((sum, order) => sum + Number(order.total || 0), 0),
  };
  const actual = result.data.summary;
  for (const key of Object.keys(expected)) assert.equal(Number(actual[key] || 0), expected[key], `${label}: dashboard ${key} does not match database records.`);
  const completed = await api('/api/orders/admin/completed');
  assert.equal(completed.status, 200);
  assert.equal(completed.data.count, expected.completedOrders, `${label}: completed list does not match the database rule.`);
  console.log(`${label}: ${JSON.stringify(expected)}`);
};

const main = async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  const passwordHash = await bcrypt.hash('FlowTest1!', 10);
  const admin = await User.create({ name: 'Flow Test Admin', email: `flow-admin-${Date.now()}@example.test`, password: passwordHash, role: 'admin' });
  const customer = await User.create({ name: 'Flow Test Customer', email: `flow-customer-${Date.now()}@example.test`, password: passwordHash, role: 'user' });
  customerId = customer._id;
  adminToken = jwt.sign({ userId: admin._id, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  customerToken = jwt.sign({ userId: customer._id, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  await Product.create({ slug: productSlug, name: 'Isolated Flow Test Cake', category: 'Birthday Cakes', description: 'Temporary isolated test product.', image: '/images/test-cake.jpg', flavors: ['Vanilla'], sizes: [{ name: '1 kg', price: 700 }], stock: 20, available: true });
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const pickup = await createOrder('pay-at-pickup', 'pickup');
  assert.equal(pickup.paymentStatus, 'unpaid');
  await assertDashboardMatchesDatabase('pickup · Unpaid');
  await setStatus(pickup, 'confirmed');
  await assertDashboardMatchesDatabase('pickup · Confirmed');
  let payment = await api(`/api/orders/admin/${encodeURIComponent(pickup.orderNumber)}/payment/paid`, { method: 'PATCH' });
  assert.equal(payment.status, 200);
  let stored = await Order.findById(pickup._id).lean();
  assert.equal(stored.paymentStatus, 'paid');
  assert.ok(stored.paidAt);
  assert.equal(stored.paidBy, 'Flow Test Admin');
  await assertDashboardMatchesDatabase('pickup · Paid');
  await setStatus(pickup, 'completed');
  await assertDashboardMatchesDatabase('pickup · Completed and Paid');
  await setStatus(pickup, 'cancelled', { confirmOfflineRefund: true });
  await assertDashboardMatchesDatabase('pickup · Cancelled / Refund Due');
  const offlineRefund = await api(`/api/orders/admin/${encodeURIComponent(pickup.orderNumber)}/refund`, { method: 'POST', body: { confirmOfflineRefund: true } });
  assert.equal(offlineRefund.status, 200);
  stored = await Order.findById(pickup._id).lean();
  assert.equal(stored.paymentStatus, 'refunded');
  await assertDashboardMatchesDatabase('pickup · Refunded');

  const delivery = await createOrder('pay-on-delivery', 'delivery');
  assert.equal(delivery.paymentStatus, 'unpaid');
  await assertDashboardMatchesDatabase('delivery · Unpaid');
  await setStatus(delivery, 'confirmed');
  await assertDashboardMatchesDatabase('delivery · Confirmed');
  payment = await api(`/api/orders/admin/${encodeURIComponent(delivery.orderNumber)}/payment/paid`, { method: 'PATCH' });
  assert.equal(payment.status, 200);
  stored = await Order.findById(delivery._id).lean();
  assert.equal(stored.paidBy, 'Flow Test Admin');
  await assertDashboardMatchesDatabase('delivery · Paid');
  await setStatus(delivery, 'completed');
  await assertDashboardMatchesDatabase('delivery · Completed and Paid');
  await setStatus(delivery, 'cancelled', { confirmOfflineRefund: true });
  await assertDashboardMatchesDatabase('delivery · Cancelled / Refund Due');
  const deliveryRefund = await api(`/api/orders/admin/${encodeURIComponent(delivery.orderNumber)}/refund`, { method: 'POST', body: { confirmOfflineRefund: true } });
  assert.equal(deliveryRefund.status, 200);
  await assertDashboardMatchesDatabase('delivery · Refunded');

  const online = await createOrder('razorpay', 'pickup');
  assert.equal(online.paymentStatus, 'unpaid');
  await assertDashboardMatchesDatabase('online · Unpaid');
  const failed = await api(`/api/orders/${encodeURIComponent(online.orderNumber)}/payment/verify`, { method: 'POST', token: customerToken, body: { razorpay_order_id: providerOrderId, razorpay_payment_id: 'pay_test_failed', razorpay_signature: 'test-signature' } });
  assert.equal(failed.status, 409);
  stored = await Order.findById(online._id).lean();
  assert.equal(stored.paymentStatus, 'unpaid');
  assert.equal(stored.status, 'placed');
  await assertDashboardMatchesDatabase('online · Failed attempt remains Unpaid');
  const success = await api(`/api/orders/${encodeURIComponent(online.orderNumber)}/payment/verify`, { method: 'POST', token: customerToken, body: { razorpay_order_id: providerOrderId, razorpay_payment_id: 'pay_test_success', razorpay_signature: 'test-signature' } });
  assert.equal(success.status, 200);
  stored = await Order.findById(online._id).lean();
  assert.equal(stored.paymentStatus, 'paid');
  assert.equal(stored.status, 'confirmed');
  await assertDashboardMatchesDatabase('online · Verified and Confirmed');
  const duplicate = await api(`/api/orders/${encodeURIComponent(online.orderNumber)}/payment/verify`, { method: 'POST', token: customerToken, body: { razorpay_order_id: providerOrderId, razorpay_payment_id: 'pay_test_duplicate', razorpay_signature: 'test-signature' } });
  assert.equal(duplicate.status, 409);
  const samePaymentRetry = await api(`/api/orders/${encodeURIComponent(online.orderNumber)}/payment/verify`, { method: 'POST', token: customerToken, body: { razorpay_order_id: providerOrderId, razorpay_payment_id: 'pay_test_success', razorpay_signature: 'test-signature' } });
  assert.equal(samePaymentRetry.status, 200);
  await assertDashboardMatchesDatabase('online · Duplicate rejected; same verification idempotent');
  await setStatus(online, 'completed');
  await assertDashboardMatchesDatabase('online · Completed and Paid');
  await setStatus(online, 'cancelled');
  stored = await Order.findById(online._id).lean();
  assert.equal(stored.paymentStatus, 'refund-due');
  assert.equal(stored.refundId, refundId);
  await assertDashboardMatchesDatabase('online · Cancelled / Refund Due');
  const refundCheck = await api(`/api/orders/admin/${encodeURIComponent(online.orderNumber)}/refund`, { method: 'POST', body: {} });
  assert.equal(refundCheck.status, 200);
  assert.match(refundCheck.data.message, /still pending/i);
  assert.equal(refundStartCount, 1, 'Checking a pending refund must not start a duplicate gateway refund.');
  const webhook = await api('/api/payments/razorpay/webhook', { method: 'POST', token: '', body: { event: 'refund.processed', payload: { refund: { entity: { id: refundId } } } } });
  assert.equal(webhook.status, 200);
  stored = await Order.findById(online._id).lean();
  assert.equal(stored.paymentStatus, 'refunded');
  await assertDashboardMatchesDatabase('online · Refund webhook confirmed');

  const userPaidResponse = await api(`/api/orders/admin/${encodeURIComponent(online.orderNumber)}/payment/paid`, { method: 'PATCH', token: customerToken });
  assert.equal(userPaidResponse.status, 403, 'Non-admin must not mark payment as received.');
  console.log(`Isolated test database: ${testDatabase}`);
  console.log(`Test customer id: ${String(customerId)}`);
};

main().then(async () => {
  server?.close();
  await mongoose.disconnect();
  process.exit(0);
}).catch(async (error) => {
  console.error(`Order flow test failed: ${error.stack || error.message}`);
  server?.close();
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
