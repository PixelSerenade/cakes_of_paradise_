const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  giftCard: { type: mongoose.Schema.Types.ObjectId, ref: 'GiftCard', default: null },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  type: { type: String, enum: ['claimed', 'spent', 'refunded'], required: true },
  amount: { type: Number, required: true, min: 1 },
  balanceAfter: { type: Number, required: true, min: 0 },
  note: { type: String, default: '', maxlength: 240 },
}, { timestamps: true });

module.exports = mongoose.model('GiftWalletTransaction', schema);
