const crypto = require('crypto');
const NewsletterSubscriber = require('../models/NewsletterSubscriber');
const { sendNewsletterWelcome } = require('../services/notificationEmails');
const { escapeHtml } = require('../templates/emails/shared');

const validEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,63}$/.test(email) && email.length <= 254;
const tokenHash = (token) => crypto.createHash('sha256').update(token).digest('hex');
const validConsent = (value) => value === true || value === 'true' || value === 'on';

exports.subscribe = async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!validEmail(email)) return res.status(400).json({ message: 'Please enter a valid email address.' });
  if (!validConsent(req.body?.consent)) return res.status(400).json({ message: 'Please confirm that you agree to receive occasional bakery emails.' });

  let subscriber = await NewsletterSubscriber.findOne({ email }).select('+unsubscribeTokenHash');
  const alreadySubscribed = Boolean(subscriber?.isSubscribed && subscriber?.consentAt);
  if (alreadySubscribed && subscriber.welcomeEmailSentAt) {
    return res.json({ message: 'You’re already on the sweet list. ♡', alreadySubscribed: true });
  }

  if (!subscriber) {
    try {
      subscriber = await NewsletterSubscriber.create({ email, isSubscribed: true, consentAt: new Date(), consentSource: 'website newsletter form', subscribedAt: new Date() });
    } catch (error) {
      if (error.code !== 11000) throw error;
      subscriber = await NewsletterSubscriber.findOne({ email }).select('+unsubscribeTokenHash');
    }
  }
  if (!subscriber.isSubscribed || !subscriber.consentAt) {
    subscriber.isSubscribed = true;
    subscriber.consentAt = new Date();
    subscriber.consentSource = 'website newsletter form';
    subscriber.subscribedAt = new Date();
    subscriber.unsubscribedAt = null;
    subscriber.welcomeEmailSentAt = null;
    await subscriber.save();
  }

  if (subscriber.welcomeEmailSendingAt && Date.now() - subscriber.welcomeEmailSendingAt.getTime() < 15 * 60_000) {
    return res.status(202).json({ message: 'You’re on the sweet list! Your welcome note is on its way. ♡' });
  }

  // A new link is saved with a one-way digest before sending; only the link itself contains the token.
  const sendToken = crypto.randomBytes(32).toString('base64url');
  const sendStartedAt = new Date();
  const claim = await NewsletterSubscriber.findOneAndUpdate({
    _id: subscriber._id,
    isSubscribed: true,
    consentAt: { $ne: null },
    welcomeEmailSentAt: null,
    $or: [
      { welcomeEmailSendingAt: null },
      { welcomeEmailSendingAt: { $lt: new Date(Date.now() - 15 * 60_000) } },
    ],
  }, { $set: { unsubscribeTokenHash: tokenHash(sendToken), welcomeEmailSendingAt: sendStartedAt }, $addToSet: { unsubscribeTokenHashes: tokenHash(sendToken) } }, { new: true });
  if (!claim) return res.status(202).json({ message: 'Your subscription is saved. Your welcome note is on its way. ♡' });
  const result = await sendNewsletterWelcome(email, sendToken);
  await NewsletterSubscriber.updateOne({ _id: claim._id, welcomeEmailSendingAt: sendStartedAt }, {
    $set: { welcomeEmailSendingAt: null, ...(result.sent ? { welcomeEmailSentAt: new Date() } : {}) },
  });

  const message = result.sent
    ? 'You’re subscribed! A little welcome note is on its way. ♡'
    : 'You’re on the sweet list! We’ve saved your email preferences and will send your welcome note as soon as email delivery is available. ♡';
  return res.status(201).json({ message, emailSent: result.sent });
};

const unsubscribePage = (token, message = '') => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Newsletter preferences · Cakes of Paradise</title><style>body{margin:0;padding:24px;background:#f5f0e7;color:#49443e;font-family:Georgia,serif}.card{max-width:540px;margin:8vh auto;padding:42px 28px;text-align:center;background:#fffaf2;border:1px solid #e5d5ca;border-radius:20px;box-shadow:0 16px 40px #63594a12}.brand{font-size:27px;color:#78836d}.bow{margin:20px;color:#d99b98;font-size:32px}.card h1{font-weight:400;font-size:30px}.card p{line-height:1.7;color:#756b61}.button{padding:13px 26px;background:#87937b;color:white;border:0;border-radius:99px;font:600 13px Arial,sans-serif;cursor:pointer}</style></head><body><main class="card"><div class="brand">Cakes of Paradise</div><div class="bow" aria-hidden="true">✧ ୨୧ ✧</div><h1>Newsletter preferences</h1><p>${escapeHtml(message || 'Would you like to stop receiving occasional bakery news and sweet updates?')}</p><form method="post" action="/api/newsletter/unsubscribe/${encodeURIComponent(token)}"><button class="button" type="submit">Unsubscribe from bakery emails</button></form><p>Order and account emails will still reach you when needed.</p></main></body></html>`;

exports.unsubscribePage = async (req, res) => {
  const token = String(req.params.token || '');
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) return res.status(400).type('html').send(unsubscribePage('', 'This unsubscribe link is not valid. Please contact the bakery if you need help.'));
  const hash = tokenHash(token);
  const subscriber = await NewsletterSubscriber.findOne({ $or: [{ unsubscribeTokenHash: hash }, { unsubscribeTokenHashes: hash }], isSubscribed: true });
  if (!subscriber) return res.status(200).type('html').send(unsubscribePage('', 'This link has already been used, or it has expired. Your email preferences are up to date.'));
  return res.type('html').send(unsubscribePage(token));
};

exports.unsubscribe = async (req, res) => {
  const token = String(req.params.token || '');
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) return res.status(400).json({ message: 'This unsubscribe link is not valid.' });
  const subscriber = await NewsletterSubscriber.findOneAndUpdate(
    { $or: [{ unsubscribeTokenHash: tokenHash(token) }, { unsubscribeTokenHashes: tokenHash(token) }], isSubscribed: true },
    { $set: { isSubscribed: false, unsubscribedAt: new Date(), welcomeEmailSendingAt: null, unsubscribeTokenHashes: [] }, $unset: { unsubscribeTokenHash: 1 } },
    { new: true },
  );
  if (!subscriber) return res.status(200).type('html').send(unsubscribePage('', 'You are already unsubscribed. No more newsletter messages will be sent.'));
  return res.status(200).type('html').send(unsubscribePage('', 'You’re unsubscribed. We’ll miss you, but you can join the sweet list again any time.'));
};
