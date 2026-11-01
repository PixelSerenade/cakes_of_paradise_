const mongoose = require('mongoose');

const promoCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  description: { type: String, default: '', maxlength: 160 },
  occasionType: { type: String, enum: ['festival', 'celebration', 'other'], default: 'other', index: true },
  sendToSubscribers: { type: Boolean, default: false },
  type: { type: String, enum: ['percent', 'fixed'], required: true },
  value: { type: Number, required: true, min: 1 },
  minimumSubtotal: { type: Number, default: 0, min: 0 },
  maximumDiscount: { type: Number, default: 0, min: 0 },
  startsAt: { type: Date, default: Date.now },
  endsAt: { type: Date, required: true },
  usageLimit: { type: Number, default: 0, min: 0 },
  usedCount: { type: Number, default: 0, min: 0 },
  active: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('PromoCode', promoCodeSchema);
