const StorePolicy = require('../models/StorePolicy');
const { getReferralRewards } = require('../utils/referralRewards');

exports.getPolicy = async (req, res) => {
  const policy = await StorePolicy.findById('default');
  const referralRewards = getReferralRewards(policy);
  return res.json({ cancellationCutoffStatus: policy?.cancellationCutoffStatus || 'confirmed', referralFriendPoints: referralRewards.customerPoints, referralOwnerPoints: referralRewards.referrerPoints });
};

exports.updatePolicy = async (req, res) => {
  const allowed = ['placed', 'confirmed', 'preparing', 'ready'];
  if (!allowed.includes(req.body.cancellationCutoffStatus)) return res.status(400).json({ message: 'Choose a valid order status for the cancellation cutoff.' });
  const referralFriendPoints = Number(req.body.referralFriendPoints);
  const referralOwnerPoints = Number(req.body.referralOwnerPoints);
  if (![referralFriendPoints, referralOwnerPoints].every(Number.isSafeInteger) || referralFriendPoints < 1 || referralOwnerPoints < 1) return res.status(400).json({ message: 'Enter valid referral reward point amounts.' });
  const policy = await StorePolicy.findByIdAndUpdate('default', { cancellationCutoffStatus: req.body.cancellationCutoffStatus, referralFriendPoints, referralOwnerPoints }, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true });
  return res.json({ message: 'Customer and referral policies saved.', cancellationCutoffStatus: policy.cancellationCutoffStatus, referralFriendPoints: policy.referralFriendPoints, referralOwnerPoints: policy.referralOwnerPoints });
};
