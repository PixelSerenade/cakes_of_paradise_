const Order = require('../models/Order');
const { sendEmailMessage } = require('./emailService');
const welcomeTemplate = require('../templates/emails/welcome');
const newsletterTemplate = require('../templates/emails/newsletterWelcome');
const orderConfirmationTemplate = require('../templates/emails/orderConfirmation');
const paymentConfirmationTemplate = require('../templates/emails/paymentConfirmation');
const orderShippedTemplate = require('../templates/emails/orderShipped');
const enquiryTemplate = require('../templates/emails/customCakeEnquiry');
const contactMessageTemplate = require('../templates/emails/contactMessage');

const logDeliveryError = (event, error) => console.error(`${event} email delivery failed (${error?.code || error?.name || 'provider error'}).`);

const sendTemplate = async (to, template, extra = {}) => {
  try {
    const message = template;
    return await sendEmailMessage({ to, ...message, ...extra });
  } catch (error) {
    logDeliveryError('Customer notification', error);
    return { sent: false, configured: true, error: true };
  }
};

const sendOrderEvent = async (order, event, templateFactory) => {
  const statusField = `${event}EmailStatus`;
  const sentField = `${event}EmailSentAt`;
  const startedField = `${event}EmailStartedAt`;
  const now = new Date();
  const staleBefore = new Date(now.getTime() - 15 * 60_000);
  let claimed;
  try {
    claimed = await Order.findOneAndUpdate({
      _id: order._id,
      $or: [
        { [statusField]: { $exists: false } },
        { [statusField]: { $in: ['pending', 'failed', 'not_configured'] } },
        { [statusField]: 'sending', [startedField]: { $lt: staleBefore } },
      ],
    }, { $set: { [statusField]: 'sending', [startedField]: now } }, { new: true });
  } catch (error) {
    logDeliveryError('Order event claim', error);
    return { sent: false, configured: false };
  }
  if (!claimed) return { sent: false, configured: true, duplicate: true };

  const message = templateFactory(claimed);
  const result = await sendTemplate(claimed.customer?.email, message);
  const finalStatus = result.sent ? 'sent' : result.configured ? 'failed' : 'not_configured';
  await Order.updateOne({ _id: claimed._id, [statusField]: 'sending' }, {
    $set: {
      [statusField]: finalStatus,
      ...(result.sent ? { [sentField]: new Date() } : {}),
    },
    $unset: { [startedField]: 1 },
  }).catch((error) => logDeliveryError('Order email status update', error));
  return result;
};

const sendRegisteredWelcome = async (user) => sendTemplate(user.email, welcomeTemplate(user));
const sendNewsletterWelcome = async (email, unsubscribeToken) => {
  const message = newsletterTemplate({ email, unsubscribeToken });
  return sendTemplate(email, message, { headers: message.headers });
};
const sendOrderConfirmation = (order) => sendOrderEvent(order, 'orderConfirmation', orderConfirmationTemplate);
const sendPaymentConfirmation = (order) => sendOrderEvent(order, 'paymentConfirmation', paymentConfirmationTemplate);
const sendOrderShipped = (order) => sendOrderEvent(order, 'orderShipped', orderShippedTemplate);
const sendEnquiryConfirmation = (enquiry) => sendTemplate(enquiry.email, enquiry.type === 'contact' ? contactMessageTemplate(enquiry) : enquiryTemplate(enquiry));

module.exports = { sendRegisteredWelcome, sendNewsletterWelcome, sendOrderConfirmation, sendPaymentConfirmation, sendOrderShipped, sendEnquiryConfirmation };
