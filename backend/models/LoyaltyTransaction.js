const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  kind: { type: String, enum: ['earned', 'redeemed', 'refunded'], required: true },
  points: { type: Number, required: true, min: 1 },
  note: { type: String, default: '' },
}, { timestamps: true });
schema.index({ order: 1, kind: 1 }, { unique: true, partialFilterExpression: { order: { $type: 'objectId' } } });

module.exports = mongoose.model('LoyaltyTransaction', schema);
