const nodemailer = require('nodemailer');

const validEmail = (value) => typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,63}$/.test(value);
const configuredValue = (value) => Boolean(value && !/replace|your[-_ ]/i.test(value));

const getMailConfig = () => {
  const host = process.env.BREVO_SMTP_HOST || process.env.SMTP_HOST;
  const user = process.env.BREVO_SMTP_USER || process.env.SMTP_USER;
  const pass = process.env.BREVO_SMTP_KEY || process.env.SMTP_PASS;
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  const from = (configuredValue(process.env.EMAIL_FROM) && process.env.EMAIL_FROM) ||
    (configuredValue(process.env.ORDER_EMAIL_FROM) && process.env.ORDER_EMAIL_FROM) ||
    (gmailUser ? `Cakes of Paradise <${gmailUser}>` : (user ? `Cakes of Paradise <${user}>` : ''));

  if (configuredValue(host) && configuredValue(user) && configuredValue(pass)) {
    const port = Number(process.env.BREVO_SMTP_PORT || process.env.SMTP_PORT || 587);
    return {
      kind: 'smtp', from,
      transport: nodemailer.createTransport({
        host,
        port: Number.isInteger(port) ? port : 587,
        secure: String(process.env.BREVO_SMTP_SECURE || process.env.SMTP_SECURE || (port === 465)).toLowerCase() === 'true',
        auth: { user, pass },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 15_000,
      }),
    };
  }

  if (configuredValue(gmailUser) && configuredValue(gmailPass)) {
    return {
      kind: 'smtp', from: from || `Cakes of Paradise <${gmailUser}>`,
      transport: nodemailer.createTransport({
        service: 'gmail',
        auth: { user: gmailUser, pass: gmailPass.replace(/\s/g, '') },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 15_000,
      }),
    };
  }

  if (configuredValue(process.env.RESEND_API_KEY) && configuredValue(from)) {
    return { kind: 'resend', from, apiKey: process.env.RESEND_API_KEY };
  }
  return null;
};

const isConfigured = () => Boolean(getMailConfig());

const sendEmailMessage = async ({ to, subject, text = '', html = '', replyTo, headers }) => {
  if (!validEmail(to)) throw new Error('A valid recipient email address is required.');
  if (typeof subject !== 'string' || !subject.trim() || subject.length > 180) throw new Error('A valid email subject is required.');
  const mail = getMailConfig();
  if (!mail) return { sent: false, configured: false };

  if (mail.kind === 'smtp') {
    await mail.transport.sendMail({ from: mail.from, to, subject, text, html, ...(replyTo ? { replyTo } : {}), ...(headers ? { headers } : {}) });
    return { sent: true, configured: true };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${mail.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: mail.from, to: [to], subject, text, html, ...(replyTo ? { reply_to: replyTo } : {}), ...(headers ? { headers } : {}) }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Email provider rejected the message (${response.status}).`);
  return { sent: true, configured: true };
};

const sendEmail = async (to, subject, message) => {
  const text = typeof message === 'string' ? message : (message && typeof message.text === 'string' ? message.text : '');
  const html = typeof message === 'object' && message ? message.html || '' : '';
  return (await sendEmailMessage({ to, subject, text, html })).sent;
};

module.exports = { isConfigured, sendEmailMessage, sendEmail, validEmail };
