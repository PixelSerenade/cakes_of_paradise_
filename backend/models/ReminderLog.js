const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  occasion: { type: String, required: true, maxlength: 100 },
  year: { type: Number, required: true },
  status: { type: String, enum: ['processing', 'sent', 'failed'], default: 'processing' },
  couponCode: { type: String, default: '' },
  sentAt: Date,
}, { timestamps: true });
schema.index({ user: 1, occasion: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('ReminderLog', schema);
