const mongoose = require('mongoose');

const giftCardSchema = new mongoose.Schema({
  codeHash: { type: String, required: true, unique: true, select: false },
  codeLast4: { type: String, required: true },
  purchaseRef: { type: String, unique: true, sparse: true, select: false },
  value: { type: Number, required: true, min: 1 },
  balance: { type: Number, required: true, min: 0 },
  recipientName: { type: String, default: '', maxlength: 100 },
  recipientEmail: { type: String, default: '' },
  message: { type: String, default: '', maxlength: 300 },
  design: { type: String, enum: ['sweet-moments', 'cake-love', 'birthday-bliss', 'just-because', 'with-love', 'special-treat'], default: 'sweet-moments' },
  emailTemplate: { type: String, enum: ['sweet-moments', 'cake-love', 'birthday-bliss', 'just-because', 'with-love', 'special-treat'] },
  offerName: { type: String, default: '', maxlength: 80 },
  expiresAt: { type: Date, required: true },
  active: { type: Boolean, default: true },
  issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

module.exports = mongoose.model('GiftCard', giftCardSchema);
