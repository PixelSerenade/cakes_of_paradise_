const mongoose = require('mongoose');
let bcrypt;
try {
  bcrypt = require('bcrypt');
  if (!bcrypt.hash) throw new Error();
} catch {
  bcrypt = require('bcryptjs');
}

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a name'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Please provide an email address'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^[^\s@]+@[^\s@]+\.[^\s@]{2,63}$/,
      'Please provide a valid email address',
    ],
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: [6, 'Password must be at least 6 characters long'],
  },
  passwordResetOtpHash: { type: String, select: false, default: '' },
  passwordResetOtpExpiresAt: { type: Date, select: false, default: null },
  passwordResetOtpSentAt: { type: Date, select: false, default: null },
  passwordResetAttempts: { type: Number, select: false, default: 0 },
  passwordResetTokenHash: { type: String, select: false, default: '' },
  passwordResetTokenExpiresAt: { type: Date, select: false, default: null },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  avatar: {
    type: String,
    default: '',
  },
  welcomeEmailSentAt: { type: Date, default: null },
  phone: {
    type: String,
    default: '',
    trim: true,
  },
  dateOfBirth: { type: String, default: '', match: [/^(?:|\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]))$/, 'Use a valid date of birth'] },
  savedAddresses: [{
    label: { type: String, trim: true, maxlength: 40 },
    recipientName: { type: String, trim: true, maxlength: 100 },
    phone: { type: String, trim: true, maxlength: 24 },
    address: { type: String, trim: true, maxlength: 400, required: true },
    area: { type: String, trim: true, maxlength: 80 },
    city: { type: String, trim: true, maxlength: 80 },
    postalCode: { type: String, trim: true, maxlength: 6 },
  }],
  favoriteProducts: { type: [String], default: [] },
  cart: [{
    productId: { type: String, required: true, trim: true },
    size: { type: String, required: true, trim: true },
    flavor: { type: String, required: true, trim: true },
    cakeMessage: { type: String, trim: true, maxlength: 50, default: '' },
    quantity: { type: Number, required: true, min: 1, max: 10 },
  }],
  loyaltyPoints: { type: Number, default: 0, min: 0 },
  giftWalletBalance: { type: Number, default: 0, min: 0 },
  birthdayMonthDay: { type: String, default: '', match: [/^(?:|(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]))$/, 'Use a valid month and day'] },
  anniversaryMonthDay: { type: String, default: '', match: [/^(?:|(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]))$/, 'Use a valid month and day'] },
  birthdayReminderOptIn: { type: Boolean, default: false },
  anniversaryReminderOptIn: { type: Boolean, default: false },
  occasions: [{
    personName: { type: String, trim: true, maxlength: 100, default: '' },
    relationship: { type: String, trim: true, maxlength: 30, default: 'Other' },
    title: { type: String, required: true, trim: true, maxlength: 60 },
    dateMonthDay: { type: String, required: true, match: [/^(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/, 'Use a valid month and day'] },
    reminderOptIn: { type: Boolean, default: false },
  }],
  referralCode: { type: String, unique: true, sparse: true, uppercase: true, trim: true },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  referralCodeUsed: { type: String, default: '', uppercase: true, trim: true, maxlength: 32 },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

/**
 * Method to compare an entered plain text password with the hashed password in MongoDB
 */
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Ensure password is not exposed by default in JSON conversions
userSchema.methods.toJSON = function () {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
