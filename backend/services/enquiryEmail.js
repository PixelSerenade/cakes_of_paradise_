const { sendEmailMessage, isConfigured } = require('./emailService');
const { sendEnquiryConfirmation } = require('./notificationEmails');

const sendEnquiryNotification = async (enquiry) => {
  const recipient = process.env.ENQUIRY_NOTIFICATION_TO;
  let sent = false;
  if (recipient && isConfigured()) {
    try {
      await sendEmailMessage({
        to: recipient,
        replyTo: enquiry.email,
        subject: `${enquiry.type === 'contact' ? 'Website contact message' : 'Custom cake enquiry'} from ${enquiry.name}`,
        text: `Enquiry ${String(enquiry._id).slice(-10)}\nName: ${enquiry.name}\nEmail: ${enquiry.email}\nPhone: ${enquiry.phone || 'Not provided'}${enquiry.type === 'contact' ? '' : `\nOccasion: ${enquiry.occasion}\nCake size: ${enquiry.cakeSize}`}\n\n${enquiry.details || 'No additional note'}`,
      });
      sent = true;
    } catch (error) { console.error(`Bakery enquiry notification failed (${error.code || error.name || 'provider error'}).`); }
  }
  const customerResult = await sendEnquiryConfirmation(enquiry);
  const status = !recipient || !isConfigured() ? 'not_configured' : sent ? 'sent' : 'failed';
  return { status, sent, customerEmailSent: customerResult.sent };
};

module.exports = { sendEnquiryNotification };
