const crypto = require('crypto');
const PromoCampaign = require('../models/PromoCampaign');
const PromoCode = require('../models/PromoCode');
const NewsletterSubscriber = require('../models/NewsletterSubscriber');
const { sendEmailMessage, isConfigured } = require('./emailService');
const { absoluteUrl, escapeHtml, money } = require('../templates/emails/shared');

const digest = (token) => crypto.createHash('sha256').update(token).digest('hex');
const promoCampaignEmail = (campaign, token) => {
  const event = escapeHtml(campaign.eventName);
  const code = escapeHtml(campaign.code);
  const expiry = new Date(campaign.endsAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
  const savingsCap = Number(campaign.maximumDiscount) > 0 ? `Save up to ${money(campaign.maximumDiscount)}` : 'No discount cap';
  const unsubscribeUrl = absoluteUrl(`/api/newsletter/unsubscribe/${encodeURIComponent(token)}`);
  const text = `A little ${campaign.eventName} sweetness from Cakes of Paradise! Enjoy ${campaign.discountPercent}% off your next cake order with code ${campaign.code}. Minimum order ${money(campaign.minimumSubtotal)}; ${savingsCap}. Use by ${expiry}. Enter the code at checkout.\n\nUnsubscribe from bakery emails: ${unsubscribeUrl}`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${event} sweetness · Cakes of Paradise</title></head><body style="margin:0;padding:28px 12px;background:#f5f0e7;color:#49443e;font-family:Georgia,'Times New Roman',serif"><main style="max-width:560px;margin:auto;padding:34px 30px;background:#fffaf2;border:1px solid #e5d5ca;border-radius:22px;text-align:center"><div style="font-size:29px;font-style:italic;color:#78836d">Cakes of Paradise</div><div style="margin:14px;color:#c88983;font-size:22px">✧　♡　✧</div><p style="font:10px Arial,sans-serif;letter-spacing:2px;color:#89937b">A FESTIVE TREAT, WITH LOVE</p><h1 style="font-weight:400;font-size:32px;color:#51443b">A little ${event} sweetness ♡</h1><p style="font-size:16px;line-height:1.65;color:#756b61">Celebrate with ${campaign.discountPercent}% off your next cake order.</p><section style="margin:24px 0;padding:24px;background:#e8ecdf;border:1px solid #d5ddca;border-radius:17px"><div style="font:11px Arial,sans-serif;letter-spacing:1px;color:#65715e">YOUR FESTIVE CODE</div><div style="display:inline-block;margin:14px 0;padding:13px 20px;border:1px dashed #89937b;border-radius:10px;background:#fffaf2;font:700 22px Arial,sans-serif;letter-spacing:2px;color:#51443b">${code}</div><p style="margin:0;color:#51443b;font:13px/1.7 Arial,sans-serif">Minimum order ${money(campaign.minimumSubtotal)} · ${escapeHtml(savingsCap)}<br>Use by ${escapeHtml(expiry)}</p></section><a href="${escapeHtml(absoluteUrl('/shop.html'))}" style="display:inline-block;padding:13px 25px;border-radius:999px;background:#78836d;color:white;text-decoration:none;font:600 13px Arial,sans-serif">Find your celebration cake →</a><p style="margin:26px 0 0;color:#8a8176;font-size:13px">Baked with love, Cakes of Paradise ♡</p><p style="margin:18px 0 0;font:11px/1.6 Arial,sans-serif;color:#92887d">You’re receiving this because you opted in to occasional bakery emails.<br><a href="${escapeHtml(unsubscribeUrl)}" style="color:#65715e">Unsubscribe from bakery emails</a></p></main></body></html>`;
  return { subject: `${campaign.eventName} sweetness · ${campaign.discountPercent}% off cakes ♡`, text, html, headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } };
};

let sweepRunning = false;
const runPromoCampaignSweep = async (now = new Date()) => {
  if (sweepRunning || !isConfigured()) return { sent: 0, failed: 0, skipped: true };
  sweepRunning = true;
  let sent = 0;
  let failed = 0;
  try {
    while (true) {
      const staleBefore = new Date(now.getTime() - 10 * 60_000);
      const campaign = await PromoCampaign.findOneAndUpdate({
        $or: [
          { status: 'scheduled', sendAt: { $lte: now } },
          { status: 'sending', updatedAt: { $lte: staleBefore } },
        ],
      }, { $set: { status: 'sending', lastError: '' }, $inc: { attempts: 1 } }, { new: true, sort: { sendAt: 1 } });
      if (!campaign) break;
      const promo = await PromoCode.findById(campaign.promoCode);
      if (!promo) {
        await PromoCampaign.updateOne({ _id: campaign._id }, { $set: { status: 'failed', lastError: 'The linked discount code could not be found.' } });
        continue;
      }
      const sentIds = new Set(campaign.sentSubscriberIds.map(String));
      const subscribers = await NewsletterSubscriber.find({ isSubscribed: true, consentAt: { $ne: null }, _id: { $nin: [...sentIds] } }).select('email');
      let campaignFailures = 0;
      for (const subscriber of subscribers) {
        const token = crypto.randomBytes(32).toString('base64url');
        const tokenDigest = digest(token);
        const eligible = await NewsletterSubscriber.updateOne({ _id: subscriber._id, isSubscribed: true, consentAt: { $ne: null } }, {
          $set: { unsubscribeTokenHash: tokenDigest }, $addToSet: { unsubscribeTokenHashes: tokenDigest },
        });
        if (!eligible.matchedCount) continue;
        try {
          const message = promoCampaignEmail(campaign, token);
          const result = await sendEmailMessage({ to: subscriber.email, ...message });
          if (!result.sent) throw new Error('Email delivery is not configured.');
          await PromoCampaign.updateOne({ _id: campaign._id }, { $addToSet: { sentSubscriberIds: subscriber._id }, $inc: { sentCount: 1 } });
          sent += 1;
        } catch (error) {
          campaignFailures += 1;
          failed += 1;
          console.error(`Festival promotion email failed for a subscribed customer: ${error.message}`);
        }
      }
      if (!campaignFailures) {
        await PromoCampaign.updateOne({ _id: campaign._id }, { $set: { status: 'sent', lastError: '' } });
      } else if (campaign.attempts >= 5) {
        await PromoCampaign.updateOne({ _id: campaign._id }, { $set: { status: 'failed', lastError: `${campaignFailures} email(s) failed after five attempts.` } });
      } else {
        await PromoCampaign.updateOne({ _id: campaign._id }, { $set: { status: 'scheduled', sendAt: new Date(Date.now() + 30 * 60_000), lastError: `${campaignFailures} email(s) will be retried.` } });
      }
    }
  } finally { sweepRunning = false; }
  return { sent, failed };
};

const startPromoCampaignScheduler = () => {
  const sweep = () => void runPromoCampaignSweep().catch((error) => console.error(`Festival promotion scheduler failed: ${error.message}`));
  sweep();
  const timer = setInterval(sweep, 60_000);
  timer.unref?.();
};

module.exports = { startPromoCampaignScheduler, runPromoCampaignSweep, promoCampaignEmail };
