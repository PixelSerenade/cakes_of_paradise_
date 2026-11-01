require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Product = require('../models/Product');

async function fixLegacyImages() {
  await mongoose.connect(process.env.MONGODB_URI);
  await Product.updateMany({ image: /unsplash/ }, { image: '/images/gallery/1.jpeg' });
  const unsplash = await Product.find({ image: /unsplash/ }).countDocuments();
  console.log('Remaining unsplash images in DB:', unsplash);
  await mongoose.disconnect();
}
fixLegacyImages();
