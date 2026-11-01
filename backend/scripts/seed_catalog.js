const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const dns = require('dns');

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

const connectDB = require('../config/db');
const Product = require('../models/Product');
const products = require('../data/products');

async function seedCatalog() {
  console.log('Connecting to MongoDB...');
  await connectDB();

  // Remove the old invalid / broken test product if present
  await Product.deleteOne({ slug: 'chocolate-ganache-crown11' });

  // Map any legacy categories to the 6 standard bakery categories
  await Product.updateMany({ category: 'Chocolate' }, { $set: { category: 'Birthday Cakes' } });
  await Product.updateMany({ category: 'Fruit' }, { $set: { category: 'Birthday Cakes' } });
  await Product.updateMany({ category: 'Celebration' }, { $set: { category: 'Anniversary Cakes' } });

  console.log(`Synchronizing ${products.length} catalog products...`);
  for (const item of products) {
    const { id, ...data } = item;
    await Product.findOneAndUpdate(
      { slug: id },
      {
        ...data,
        slug: id,
        dietaryTags: data.dietaryTags || [],
        available: true,
        seasonal: false,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  const distinctCategories = await Product.distinct('category', { available: true });
  const totalCount = await Product.countDocuments({ available: true });
  console.log(`✔ Catalog updated successfully! Total products: ${totalCount}`);
  console.log(`✔ Active categories:`, distinctCategories);

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB.');
}

seedCatalog().catch((err) => {
  console.error('Error seeding catalog:', err);
  process.exit(1);
});
