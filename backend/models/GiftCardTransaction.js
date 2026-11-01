const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  giftCard: { type: mongoose.Schema.Types.ObjectId, ref: 'GiftCard', required: true, index: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  type: { type: String, enum: ['issued', 'redeemed', 'refunded', 'claimed'], required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  amount: { type: Number, required: true, min: 0 },
  balanceAfter: { type: Number, required: true, min: 0 },
  note: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('GiftCardTransaction', schema);
