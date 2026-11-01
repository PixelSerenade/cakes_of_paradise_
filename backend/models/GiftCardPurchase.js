const mongoose = require('mongoose');
const giftCardDesigns = ['sweet-moments', 'cake-love', 'birthday-bliss', 'just-because', 'with-love', 'special-treat'];

const schema = new mongoose.Schema({
  offer: { type: mongoose.Schema.Types.ObjectId, ref: 'GiftCardOffer', default: null },
  offerName: { type: String, trim: true, maxlength: 80, default: 'Gift Card' },
  recipientName: { type: String, trim: true, maxlength: 100, default: '' },
  recipientEmail: { type: String, required: true, lowercase: true, trim: true, maxlength: 200 },
  message: { type: String, trim: true, maxlength: 200, default: '' },
  design: { type: String, enum: giftCardDesigns, required: true },
  emailTemplate: { type: String, enum: giftCardDesigns },
  value: { type: Number, required: true, min: 100, max: 100000 },
  receipt: { type: String, required: true, unique: true },
  paymentOrderId: { type: String, unique: true, sparse: true },
  paymentId: { type: String, default: '' },
  paymentMethod: { type: String, enum: ['upi', 'gift-wallet'], default: 'upi' },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  deliveryCodeEncrypted: { type: String, default: '', select: false },
  status: { type: String, enum: ['pending', 'paid', 'fulfilled'], default: 'pending' },
  giftCard: { type: mongoose.Schema.Types.ObjectId, ref: 'GiftCard', default: null },
}, { timestamps: true });

module.exports = mongoose.model('GiftCardPurchase', schema);
