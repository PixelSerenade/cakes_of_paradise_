const { sendEmail } = require('./emailService');
const { sendOrderConfirmation } = require('./notificationEmails');

const sendWhatsAppUpdate = async (order, statusLabel) => {
  const { WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_TEMPLATE_NAME, WHATSAPP_GRAPH_VERSION = 'v21.0' } = process.env;
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_TEMPLATE_NAME) return;
  const phone = String(order.customer.phone || '').replace(/\D/g, '');
  if (!phone) return;
  try {
    const response = await fetch(`https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST', headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'template', template: { name: WHATSAPP_TEMPLATE_NAME, language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en' }, components: [{ type: 'body', parameters: [{ type: 'text', text: String(order.customer.name).slice(0, 100) }, { type: 'text', text: order.orderNumber }, { type: 'text', text: statusLabel }, { type: 'text', text: new Date(order.customer.deliveryDate).toLocaleDateString('en-IN') }] }] } }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) console.error(`WhatsApp order update failed (${response.status}): ${await response.text()}`);
  } catch (error) { console.error(`WhatsApp order update failed: ${error.message}`); }
};

const orderConfirmation = (order) => Promise.all([
  sendOrderConfirmation(order),
  sendWhatsAppUpdate(order, 'placed'),
]);

const orderUpdate = (order) => Promise.all([
  ['confirmed', 'preparing', 'ready', 'shipped', 'out-for-delivery'].includes(order.status) ? sendWhatsAppUpdate(order, order.status.replaceAll('-', ' ')) : Promise.resolve(),
]);

module.exports = { orderConfirmation, orderUpdate, sendEmail };
