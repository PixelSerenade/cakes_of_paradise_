const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  _id: { type: String, default: 'default' },
  cancellationCutoffStatus: { type: String, enum: ['placed', 'confirmed', 'preparing', 'ready'], default: 'confirmed' },
  referralFriendPoints: { type: Number, min: 1, default: 50 },
  referralOwnerPoints: { type: Number, min: 1, default: 100 },
}, { timestamps: true });

module.exports = mongoose.model('StorePolicy', schema);
