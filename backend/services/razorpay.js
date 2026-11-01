const crypto = require('crypto');

const isConfigured = () => Boolean(
  /^(rzp_test_|rzp_live_)/.test(process.env.RAZORPAY_KEY_ID || '') && process.env.RAZORPAY_KEY_SECRET &&
  !process.env.RAZORPAY_KEY_ID.includes('replace') && !process.env.RAZORPAY_KEY_SECRET.includes('replace'),
);

const unavailableReason = () => 'Valid Razorpay API credentials are not configured.';

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

const toPaise = (amountInRupees) => {
  const amount = Number(amountInRupees);
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Payment amount is invalid.');
  return Math.round(amount * 100);
};

const createOrder = (amountInRupees, receipt, customer) => razorpayRequest('orders', {
  amount: toPaise(amountInRupees),
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

const capturePayment = (paymentId, amountInPaise) => {
  const amount = Number(amountInPaise);
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Payment capture amount is invalid.');
  return razorpayRequest(`payments/${encodeURIComponent(paymentId)}/capture`, { amount, currency: 'INR' });
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

module.exports = { isConfigured, unavailableReason, createOrder, verifyCheckoutSignature, getPayment, capturePayment, getPaymentsForOrder, refundPayment, getRefund, verifyWebhookSignature, toPaise };
