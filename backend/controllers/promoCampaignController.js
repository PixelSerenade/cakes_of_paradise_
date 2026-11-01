const PromoCampaign = require('../models/PromoCampaign');
const PromoCode = require('../models/PromoCode');

exports.list = async (_req, res) => {
  const campaigns = await PromoCampaign.find().sort({ sendAt: -1 }).limit(50).lean();
  return res.json({ campaigns });
};

exports.create = async (req, res) => {
  const eventName = String(req.body.eventName || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, 80);
  const code = String(req.body.code || '').trim().toUpperCase();
  const discountPercent = Number(req.body.discountPercent);
  const minimumSubtotal = Number(req.body.minimumSubtotal ?? 500);
  const maximumDiscount = Number(req.body.maximumDiscount ?? 300);
  const sendAt = new Date(req.body.sendAt);
  const endsAt = new Date(req.body.endsAt);
  if (!eventName) return res.status(400).json({ message: 'Add a festival or campaign name.' });
  if (!/^[A-Z0-9_-]{3,24}$/.test(code)) return res.status(400).json({ message: 'Use 3–24 letters, numbers, hyphens, or underscores for the code.' });
  if (!Number.isInteger(discountPercent) || discountPercent < 1 || discountPercent > 15) return res.status(400).json({ message: 'Choose a discount from 1% to 15%.' });
  if (!Number.isSafeInteger(minimumSubtotal) || minimumSubtotal < 0 || !Number.isSafeInteger(maximumDiscount) || maximumDiscount < 0) return res.status(400).json({ message: 'Enter valid minimum order and discount cap amounts.' });
  if (Number.isNaN(sendAt.getTime()) || sendAt <= new Date()) return res.status(400).json({ message: 'Choose a future email send date and time.' });
  if (Number.isNaN(endsAt.getTime()) || endsAt <= sendAt) return res.status(400).json({ message: 'The coupon expiry must be after the scheduled email.' });

  let promo;
  try {
    promo = await PromoCode.create({
      code, description: `${eventName} newsletter promotion`.slice(0, 160), type: 'percent',
      value: discountPercent, minimumSubtotal, maximumDiscount, startsAt: sendAt, endsAt,
    });
    const campaign = await PromoCampaign.create({ eventName, code, promoCode: promo._id, discountPercent, minimumSubtotal, maximumDiscount, sendAt, endsAt });
    return res.status(201).json({ message: `${eventName} email campaign scheduled. It will go to customers who opted into bakery emails.`, campaign });
  } catch (error) {
    if (promo) await PromoCode.deleteOne({ _id: promo._id }).catch(() => {});
    if (error.code === 11000) return res.status(409).json({ message: 'That promotion code is already in use.' });
    throw error;
  }
};
