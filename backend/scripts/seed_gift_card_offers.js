const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const GiftCardOffer = require('../models/GiftCardOffer');
const User = require('../models/User');

const offers = [
  { name: 'Sweet Moments', design: 'sweet-moments', price: 500 },
  { name: 'Cake Love', design: 'cake-love', price: 1000 },
  { name: 'Birthday Bliss', design: 'birthday-bliss', price: 1500 },
  { name: 'Just Because', design: 'just-because', price: 2000 },
  { name: 'A Special Treat', design: 'special-treat', price: 2500 },
];

async function seedGiftCardOffers() {
  await connectDB();
  const admin = await User.findOne({ role: 'admin' }).select('_id').lean();
  for (const offer of offers) {
    await GiftCardOffer.findOneAndUpdate(
      { name: offer.name },
      { $set: { ...offer, emailTemplate: offer.design, active: true, ...(admin ? { createdBy: admin._id } : {}) } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
  }
  const published = await GiftCardOffer.find({ active: true }).sort({ price: 1 }).select('name price').lean();
  console.log(`Published ${offers.length} gift card offers. Active offers: ${published.length}`);
  published.forEach(({ name, price }) => console.log(`${name}: ₹${price}`));
  await mongoose.disconnect();
}

seedGiftCardOffers().catch(async (error) => {
  console.error('Could not publish gift card offers:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
