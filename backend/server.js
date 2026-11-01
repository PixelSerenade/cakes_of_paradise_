const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load the backend configuration regardless of the directory used to start Node.
dotenv.config({ path: require('path').join(__dirname, '.env') });

const connectDB = require('./config/db');
const Product = require('./models/Product');
const starterProducts = require('./data/products');
const DeliveryRate = require('./models/DeliveryRate');
const User = require('./models/User');
const authRoutes = require('./routes/authRoutes');
const catalogRoutes = require('./routes/catalogRoutes');
const orderRoutes = require('./routes/orderRoutes');
const commerceRoutes = require('./routes/commerceRoutes');
const insightsRoutes = require('./routes/insightsRoutes');
const adminRoutes = require('./routes/adminRoutes');
const deliveryRoutes = require('./routes/deliveryRoutes');
const policyRoutes = require('./routes/policyRoutes');
const enquiryRoutes = require('./routes/enquiryRoutes');
const newsletterRoutes = require('./routes/newsletterRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const { razorpayWebhook } = require('./controllers/orderController');
const { protect } = require('./middleware/authMiddleware');
const { requireRole } = require('./middleware/roleMiddleware');
const { startOccasionReminderScheduler } = require('./services/occasionReminders');
const { startPromoCampaignScheduler } = require('./services/promoCampaigns');

const path = require('path');

// Initialize Express app
const app = express();

// Core Middleware
app.use(cors()); // Allow cross-origin requests from frontend
// Admin cake galleries accept up to five resized photos in the JSON request.
app.use(express.json({
  limit: '8mb',
  verify: (req, res, buffer) => { req.rawBody = buffer; },
}));

// Serve static frontend files (index.html, login.html) and media assets
const staticFileOptions = {
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    // Keep page documents fresh during design updates while caching their
    // styles, scripts, and images for faster navigation between pages.
    if (path.extname(filePath).toLowerCase() === '.html') {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
};
app.use('/public', express.static(path.join(__dirname, '../public'), staticFileOptions));
app.use('/images', express.static(path.join(__dirname, '../public/images'), staticFileOptions));
app.use(express.static(path.join(__dirname, '..'), staticFileOptions));

// Welcome API health status
app.get('/api/health', (req, res) => {
  res.json({
    message: 'Welcome to Cakes of Paradise Backend API',
    status: 'Running',
    version: '1.0.0',
  });
});

// Mount Authentication routes
app.use('/api/auth', authRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/inventory/admin', inventoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/commerce', commerceRoutes);
app.use('/api/admin/insights', insightsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/policy', policyRoutes);
app.use('/api/enquiries', enquiryRoutes);
app.use('/api/newsletter', newsletterRoutes);

app.post('/api/payments/razorpay/webhook', (req, res, next) => {
  Promise.resolve(razorpayWebhook(req, res, next)).catch(next);
});

// Protected Admin Test Endpoint
// Requires valid JWT token AND role == 'admin'
app.get('/api/admin/test', protect, requireRole('admin'), (req, res) => {
  res.status(200).json({
    message: 'Admin access granted',
    admin: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
    },
  });
});

// 404 Handler for undefined routes
app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.originalUrl}` });
});

// Global Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err.stack);
  res.status(500).json({
    message: 'An unexpected server error occurred',
    error: process.env.NODE_ENV === 'production' ? null : err.message,
  });
});

// Start only after configuration and MongoDB are ready so requests do not race
// database initialization or fail later with an opaque JWT error.
const startServer = async () => {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your_jwt_secret_key_here') {
    throw new Error('Set a strong JWT_SECRET in backend/.env before starting the server.');
  }
  if (!process.env.MONGODB_URI || process.env.MONGODB_URI === 'your_mongodb_connection_string_here') {
    throw new Error('Set MONGODB_URI in backend/.env before starting the server.');
  }

  await connectDB();
  const hasUserCollection = await User.db.db.listCollections({ name: User.collection.name }, { nameOnly: true }).hasNext();
  if (hasUserCollection) {
    const userIndexes = await User.collection.indexes();
    const obsoleteNameIndex = userIndexes.find((index) => index.name === 'name_1' && index.unique);
    if (obsoleteNameIndex) {
      await User.collection.dropIndex(obsoleteNameIndex.name);
      console.log('Removed the obsolete unique customer-name index.');
    }
  }
  if (await Product.countDocuments() === 0) {
    await Product.insertMany(starterProducts.map(({ id, ...product }) => ({ ...product, slug: id, dietaryTags: [], available: true, seasonal: false })));
  }
  if (await DeliveryRate.countDocuments() === 0) {
    await DeliveryRate.insertMany([
      { minKm: 0, maxKm: 5, fee: 40 },
      { minKm: 5, maxKm: 10, fee: 70 },
      { minKm: 10, maxKm: 15, fee: 100 },
      { minKm: 15, maxKm: 20, fee: 130 },
    ]);
    console.log('Added starter outside-Surathkal delivery bands through 20 km.');
  } else if (await DeliveryRate.exists({ minKm: 10, maxKm: 15, active: true }) &&
      !await DeliveryRate.exists({ minKm: { $lt: 20 }, maxKm: { $gt: 15 } })) {
    await DeliveryRate.create({ minKm: 15, maxKm: 20, fee: 130 });
    console.log('Added the 15–20 km outside-Surathkal delivery band.');
  }
  startOccasionReminderScheduler();
  startPromoCampaignScheduler();
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Cakes of Paradise Server running on http://localhost:${PORT}`);
  });
};

if (require.main === module) {
  startServer().catch((error) => {
    console.error(`Unable to start server: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { app, startServer };
