const User = require('../models/User');
const ReminderLog = require('../models/ReminderLog');
const PromoCode = require('../models/PromoCode');
const crypto = require('crypto');
const { sendEmail } = require('./orderEmail');
const { isConfigured } = require('./emailService');
const { absoluteUrl } = require('../templates/emails/shared');

const partsInIndia = (date) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const value = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return { monthDay: `${value.month}-${value.day}`, year: Number(value.year) };
};
const shiftDays = (date, days) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

const claimReminder = async (user, occasion, year) => {
  try {
    return await ReminderLog.create({ user: user._id, occasion, year, status: 'processing' });
  } catch (error) {
    if (error.code !== 11000) throw error;
    return ReminderLog.findOneAndUpdate({ user: user._id, occasion, year, status: 'failed' }, { $set: { status: 'processing' } }, { new: true });
  }
};

const ensureReminderCoupon = async (user, log, occasion, priorLog) => {
  if (log.couponCode) return log.couponCode;
  if (priorLog?.couponCode) {
    log.couponCode = priorLog.couponCode;
    await log.save();
    return log.couponCode;
  }
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = `SWEET${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    try {
      await PromoCode.create({ code, user: user._id, description: `10% occasion reminder offer for ${occasion.personName}`.slice(0, 160), type: 'percent', value: 10, minimumSubtotal: 500, maximumDiscount: 300, endsAt: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), usageLimit: 1 });
      log.couponCode = code;
      await log.save();
      return code;
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }
  throw new Error('Could not issue the occasion reminder offer code.');
};

const reminderEmail = ({ user, reminder, stage, couponCode }) => {
  const today = stage === 'today';
  const relation = reminder.relationship && !['someone special', 'other'].includes(reminder.relationship.toLowerCase()) ? reminder.relationship.toLowerCase() : '';
  const title = reminder.title.toLowerCase();
  const subject = today ? `Today is ${reminder.personName}’s special day ♡` : `A sweet reminder for ${reminder.personName} ♡`;
  const person = `${reminder.personName}${relation ? `, your ${relation}` : ''}`;
  const article = /^[aeiou]/i.test(title) ? 'an' : 'a';
  const eventLine = today
    ? `${person} has ${article} ${title} today.`
    : `${person} has ${article} ${title} coming up in about a week.`;
  const hasPublicSite = Boolean(process.env.PUBLIC_SITE_URL || process.env.APP_BASE_URL);
  const giftLink = hasPublicSite ? absoluteUrl('/gift-cards.html') : '';
  const giftLine = today
    ? `Would you like to surprise ${reminder.personName} with a gift card?${giftLink ? ` Choose a card and enter their email address here: ${giftLink}` : ' Visit the Cakes of Paradise gift cards page to choose a card and enter their email address.'}`
    : `If you would like to send a little surprise, visit the Cakes of Paradise gift cards page${giftLink ? `: ${giftLink}` : ''}.`;
  const text = `Hi ${user.name},\n\nA little reminder: ${eventLine}\n\n${giftLine}\n\nCelebrate with 10% off your cake order using ${couponCode}. The offer applies to orders of ₹500 or more, saves up to ₹300, and can be used once by your account. It expires in 21 days. Enter the code in the discount box at checkout.\n\nYou can update this reminder in your account.\n\nWith love, Cakes of Paradise`;
  const headline = today ? `${escapeHtml(reminder.personName)}’s ${escapeHtml(title)} is today ♡` : `${escapeHtml(reminder.personName)}’s ${escapeHtml(title)} is coming up ♡`;
  const giftAction = giftLink ? `<p style="margin:22px 0"><a href="${escapeHtml(giftLink)}" style="display:inline-block;padding:13px 24px;border-radius:999px;background:#78836d;color:#fff;text-decoration:none;font:600 13px Arial,sans-serif">Choose a gift card →</a></p>` : `<p style="font-size:13px;color:#514940">Visit the Cakes of Paradise gift cards page to choose a card.</p>`;
  const html = `<!doctype html><html><body style="margin:0;padding:28px 12px;background:#f5f0e7;color:#514940;font-family:Georgia,serif"><main style="max-width:540px;margin:auto;padding:34px 30px;background:#fffaf2;border:1px solid #e5d5ca;border-radius:20px;text-align:center"><div style="font-size:25px;font-style:italic;color:#78836d">Cakes of Paradise</div><div style="margin:14px;color:#b98c75;font-size:20px">✧　♡　୨୧　♡　✧</div><p style="font:11px Arial,sans-serif;letter-spacing:2px;color:#89937b">A LITTLE REMINDER, WITH LOVE</p><h1 style="font-size:30px;font-weight:400">${headline}</h1><p style="font-size:16px;line-height:1.65;color:#514940">Hi ${escapeHtml(user.name)}, ${escapeHtml(eventLine)}</p><section style="margin:24px 0;padding:22px;background:#e8ecdf;border-radius:16px"><p style="margin:0 0 8px;font:11px Arial,sans-serif;letter-spacing:1px;color:#65715e">A LITTLE SOMETHING FOR THE CELEBRATION</p><strong style="font-size:25px;color:#65715e">10% off your cake order</strong><p style="margin:10px 0 5px;font:13px Arial,sans-serif;color:#514940">Use this personal code at checkout</p><div style="display:inline-block;margin:8px;padding:12px 18px;border:1px dashed #89937b;border-radius:9px;background:#fffaf2;font:700 20px Arial,sans-serif;letter-spacing:2px">${escapeHtml(couponCode)}</div><p style="margin:7px 0 0;font:12px Arial,sans-serif;color:#514940">Min. order ₹500 · Save up to ₹300 · One use · Expires in 21 days</p></section><p style="font-size:15px;line-height:1.6;color:#514940">${escapeHtml(today ? `Would you like to surprise ${reminder.personName} with a gift card?` : `You can also send a gift card to ${reminder.personName}.`)}</p>${giftAction}<p style="font-size:13px;color:#514940">You can update this reminder in your account.</p><p style="margin-top:26px;color:#78836d;font-style:italic">With love, Cakes of Paradise ♡</p></main></body></html>`;
  return { subject, text, html };
};

const runOccasionReminderSweep = async (referenceDate = new Date()) => {
  if (!isConfigured()) return { skipped: 'email_not_configured', sent: 0, failed: 0 };
  const today = partsInIndia(referenceDate);
  const week = partsInIndia(shiftDays(referenceDate, 7));
  const targetDays = [...new Set([today.monthDay, week.monthDay])];
  const users = await User.find({ occasions: { $elemMatch: { dateMonthDay: { $in: targetDays }, reminderOptIn: true, personName: { $nin: ['', null] } } } }).select('name email occasions');
  let sent = 0;
  let failed = 0;
  for (const user of users) {
    const reminders = (user.occasions || []).filter((item) => item.reminderOptIn && item.personName && targetDays.includes(item.dateMonthDay));
    for (const item of reminders) {
      const isToday = item.dateMonthDay === today.monthDay;
      const stage = isToday ? 'today' : 'week';
      const year = isToday ? today.year : week.year;
      const baseKey = `occasion-${item._id}`;
      const key = `${baseKey}-${stage}`;
      const reminder = { key, baseKey, title: item.title, personName: item.personName, relationship: item.relationship || 'someone special' };
      const log = await claimReminder(user, reminder.key, year);
      if (!log) continue;
      try {
        const priorLog = stage === 'today' ? await ReminderLog.findOne({ user: user._id, occasion: `${baseKey}-week`, year, status: 'sent' }) : null;
        const couponCode = await ensureReminderCoupon(user, log, reminder, priorLog);
        const message = reminderEmail({ user, reminder, stage, couponCode });
        const delivered = await sendEmail(user.email, message.subject, { text: message.text, html: message.html });
        if (!delivered) throw new Error('Email provider did not confirm delivery.');
        await ReminderLog.updateOne({ _id: log._id }, { $set: { status: 'sent', sentAt: new Date() } });
        sent += 1;
      } catch (error) {
        await ReminderLog.updateOne({ _id: log._id }, { $set: { status: 'failed' } });
        failed += 1;
        console.error(`Occasion reminder failed for user ${user._id}: ${error.message}`);
      }
    }
  }
  return { sent, failed };
};

const startOccasionReminderScheduler = () => {
  void runOccasionReminderSweep().catch((error) => console.error(`Occasion reminder sweep failed: ${error.message}`));
  const timer = setInterval(() => void runOccasionReminderSweep().catch((error) => console.error(`Occasion reminder sweep failed: ${error.message}`)), 60 * 60 * 1000);
  timer.unref?.();
};

module.exports = { startOccasionReminderScheduler, runOccasionReminderSweep, reminderEmail, partsInIndia };
