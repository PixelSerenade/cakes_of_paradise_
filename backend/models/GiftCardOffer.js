const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  design: { type: String, enum: ['sweet-moments', 'cake-love', 'birthday-bliss', 'just-because', 'with-love', 'special-treat'], default: 'sweet-moments' },
  emailTemplate: { type: String, enum: ['sweet-moments', 'cake-love', 'birthday-bliss', 'just-because', 'with-love', 'special-treat'] },
  price: { type: Number, required: true, min: 100, max: 100000 },
  active: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

schema.index({ active: 1, price: 1, createdAt: -1 });

module.exports = mongoose.model('GiftCardOffer', schema);
