const DEFAULT_REFERRAL_REWARDS = Object.freeze({ customerPoints: 50, referrerPoints: 100 });

const getReferralRewards = (policy) => {
  let customerPoints = Number(policy?.referralFriendPoints ?? DEFAULT_REFERRAL_REWARDS.customerPoints);
  let referrerPoints = Number(policy?.referralOwnerPoints ?? DEFAULT_REFERRAL_REWARDS.referrerPoints);

  // Map defaults saved by earlier referral-policy versions to the current modest awards.
  if ((customerPoints === 500 && referrerPoints === 1000) || (customerPoints === 25 && (referrerPoints === 50 || referrerPoints === 100))) {
    customerPoints = DEFAULT_REFERRAL_REWARDS.customerPoints;
    referrerPoints = DEFAULT_REFERRAL_REWARDS.referrerPoints;
  }

  return { customerPoints, referrerPoints };
};

module.exports = { DEFAULT_REFERRAL_REWARDS, getReferralRewards };
