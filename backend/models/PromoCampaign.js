const mongoose = require('mongoose');

const promoCampaignSchema = new mongoose.Schema({
  eventName: { type: String, required: true, trim: true, maxlength: 80 },
  code: { type: String, required: true, uppercase: true, trim: true, maxlength: 24 },
  promoCode: { type: mongoose.Schema.Types.ObjectId, ref: 'PromoCode', required: true },
  discountPercent: { type: Number, required: true, min: 1, max: 15 },
  minimumSubtotal: { type: Number, default: 500, min: 0 },
  maximumDiscount: { type: Number, default: 300, min: 0 },
  sendAt: { type: Date, required: true, index: true },
  endsAt: { type: Date, required: true },
  status: { type: String, enum: ['scheduled', 'sending', 'sent', 'failed'], default: 'scheduled', index: true },
  attempts: { type: Number, default: 0 },
  sentCount: { type: Number, default: 0 },
  sentSubscriberIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'NewsletterSubscriber' }],
  lastError: { type: String, default: '', maxlength: 300 },
}, { timestamps: true });

module.exports = mongoose.model('PromoCampaign', promoCampaignSchema);
