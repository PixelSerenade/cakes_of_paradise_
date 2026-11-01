const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const dns = require('dns');

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}
let bcrypt;
try {
  bcrypt = require('bcrypt');
  if (!bcrypt.hash) throw new Error();
} catch {
  bcrypt = require('bcryptjs');
}
const User = require('../models/User');
const { isValidPassword, passwordPolicyMessage } = require('../utils/passwordPolicy');

/**
 * Seed script to safely create the initial Admin account.
 * This runs independently and is not exposed to public web requests.
 */
const createAdmin = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('Error: MONGODB_URI not found in environment variables.');
      process.exit(1);
    }

    console.log('Connecting to MongoDB Atlas...');
    await connectDB();
    console.log('Connected to MongoDB.');

    // Never provision a publicly known default password.
    const adminName = process.env.ADMIN_NAME || 'Admin';
    const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
    const adminPlainPassword = process.env.ADMIN_PASSWORD;
    if (!adminEmail || !isValidPassword(adminPlainPassword)) {
      throw new Error(`Set ADMIN_EMAIL and an ADMIN_PASSWORD that meets this policy: ${passwordPolicyMessage}`);
    }

    // Check if an account with this email already exists
    let existingAdmin = await User.findOne({ email: adminEmail });

    const hashedPassword = await bcrypt.hash(adminPlainPassword, 10);

    if (existingAdmin) {
      console.log(`Admin user with email ${adminEmail} already exists.`);
      existingAdmin.role = 'admin';
      existingAdmin.name = adminName;
      existingAdmin.password = hashedPassword;
      await existingAdmin.save();
      console.log('Admin credentials updated successfully.');
    } else {
      await User.create({
        name: adminName,
        email: adminEmail,
        password: hashedPassword,
        role: 'admin',
      });
      console.log('New Admin user created successfully!');
    }

    console.log('-------------------------------------------');
    console.log('Admin Account Details:');
    console.log(`  Name:     ${adminName}`);
    console.log(`  Email:    ${adminEmail}`);
    console.log('  Password: (configured securely; not displayed)');
    console.log('  Role:     admin');
    console.log('-------------------------------------------');
    console.log('You can now use these credentials to log in via POST /api/auth/login');

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(0);
  } catch (error) {
    console.error('Error creating admin account:', error.message);
    process.exit(1);
  }
};

createAdmin();
