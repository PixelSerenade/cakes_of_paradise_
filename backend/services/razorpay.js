const crypto = require('crypto');

const isConfigured = () => Boolean(
  process.env.RAZORPAY_KEY_ID?.startsWith('rzp_test_') && process.env.RAZORPAY_KEY_SECRET &&
  !process.env.RAZORPAY_KEY_ID.includes('replace') && !process.env.RAZORPAY_KEY_SECRET.includes('replace'),
);

const unavailableReason = () => process.env.RAZORPAY_KEY_ID && !process.env.RAZORPAY_KEY_ID.startsWith('rzp_test_')
  ? 'Online payments are restricted to Razorpay test keys. Replace the live key with an rzp_test_ key before checkout.'
  : 'Razorpay test credentials are not configured.';

const razorpayRequest = async (endpoint, body) => {
  const response = await fetch(`https://api.razorpay.com/v1/${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.description || 'The payment provider could not create the checkout.');
  return data;
};

const createOrder = (amountInRupees, receipt, customer) => razorpayRequest('orders', {
  amount: amountInRupees * 100,
  currency: 'INR',
  receipt,
  notes: { customer_email: customer.email },
});

const verifyCheckoutSignature = (orderId, paymentId, signature) => {
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`).digest('hex');
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(String(signature || ''));
  return expectedBuffer.length === receivedBuffer.length && crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
};

const getPayment = async (paymentId) => {
  const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')}`,
    },
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.description || 'Could not verify payment status.');
  return data;
};

const refundPayment = async (paymentId, amountInRupees) => razorpayRequest(`payments/${encodeURIComponent(paymentId)}/refund`, {
  amount: amountInRupees * 100,
  notes: { source: 'Cakes of Paradise order cancellation' },
});

const getRefund = async (refundId) => {
  const response = await fetch(`https://api.razorpay.com/v1/refunds/${encodeURIComponent(refundId)}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')}` },
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.description || 'Could not verify refund status.');
  return data;
};

const getPaymentsForOrder = async (orderId) => {
  const response = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}/payments`, {
    headers: { Authorization: `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')}` },
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.description || 'Could not verify order payments.');
  return data.items || [];
};

const verifyWebhookSignature = (rawBody, signature) => {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET || !rawBody) return false;
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(String(signature || ''));
  return expectedBuffer.length === receivedBuffer.length && crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
};

module.exports = { isConfigured, unavailableReason, createOrder, verifyCheckoutSignature, getPayment, getPaymentsForOrder, refundPayment, getRefund, verifyWebhookSignature };
