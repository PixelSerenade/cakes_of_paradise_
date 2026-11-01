const mongoose = require('mongoose');
const dns = require('dns');

const resolveMongoUri = (configuredUri) => {
  return String(configuredUri || '').trim();
};

// Prefer IPv4 on networks where the system has an IPv6 route without working
// external connectivity. Leave resolver selection to Windows/network policy.
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {}

/**
 * Connect to MongoDB Atlas database
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(resolveMongoUri(process.env.MONGODB_URI));
    console.log(`MongoDB Connected successfully: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    throw error;
  }
};

module.exports = connectDB;
module.exports.resolveMongoUri = resolveMongoUri;
