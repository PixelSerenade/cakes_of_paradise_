const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  referrer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  referee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
  referralCode: { type: String, required: true, uppercase: true },
  rewardPoints: { type: Number, required: true, min: 0 },
  refereeRewardPoints: { type: Number, min: 0, default: 50 },
  status: { type: String, enum: ['pending', 'rewarded', 'void'], default: 'pending' },
}, { timestamps: true });

module.exports = mongoose.model('ReferralClaim', schema);
