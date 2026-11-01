const mongoose = require('mongoose');

const newsletterSubscriberSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254, unique: true },
  isSubscribed: { type: Boolean, default: true, index: true },
  consentAt: { type: Date, default: null },
  consentSource: { type: String, default: 'website newsletter form', maxlength: 80 },
  unsubscribeTokenHash: { type: String, default: '', select: false },
  unsubscribeTokenHashes: { type: [String], default: [], select: false },
  unsubscribedAt: { type: Date, default: null },
  subscribedAt: { type: Date, default: Date.now },
  welcomeEmailSentAt: { type: Date, default: null },
  welcomeEmailSendingAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('NewsletterSubscriber', newsletterSubscriberSchema);
