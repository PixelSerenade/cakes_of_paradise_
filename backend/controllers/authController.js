const jwt = require('jsonwebtoken');
const crypto = require('crypto');
let bcrypt;
try {
  bcrypt = require('bcrypt');
  if (!bcrypt.hash) throw new Error();
} catch {
  bcrypt = require('bcryptjs');
}
const User = require('../models/User');
const { isValidPassword, passwordPolicyMessage } = require('../utils/passwordPolicy');
const { sendEmailMessage } = require('../services/emailService');
const passwordResetOtpTemplate = require('../templates/emails/passwordResetOtp');
const { sendRegisteredWelcome } = require('../services/notificationEmails');

const resetDigest = (value) => crypto.createHmac('sha256', process.env.JWT_SECRET || 'cakes-of-paradise-reset').update(value).digest('hex');
const safeEqual = (left, right) => {
  const a = Buffer.from(String(left || ''), 'hex');
  const b = Buffer.from(String(right || ''), 'hex');
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
};
const safeStringEqual = (left, right) => {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
};

const isValidAvatar = (avatar) => avatar === undefined || avatar === '' ||
  (typeof avatar === 'string' && avatar.length <= 2_850_000 &&
    /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(avatar));

/**
 * Generate a signed JWT token containing userId and role
 */
const generateToken = (userId, role) => {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET, {
    expiresIn: '7d', // Token valid for 7 days
  });
};

/**
 * @desc    Register a new customer/user
 * @route   POST /api/auth/register
 * @access  Public
 */
const registerUser = async (req, res) => {
  try {
    const { name, email, password, phone, avatar } = req.body;

    // 1. Basic validation
    if (typeof name !== 'string' || !name.trim() || typeof email !== 'string' ||
        !email.trim() || typeof password !== 'string' || !password) {
      return res.status(400).json({ message: 'Please provide name, email, and password' });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({ message: passwordPolicyMessage });
    }
    if (!isValidAvatar(avatar)) {
      return res.status(400).json({ message: 'Profile photo must be a JPEG, PNG, or WebP image under 2 MB' });
    }

    // 2. Check if user already exists
    const normalizedEmail = email.toLowerCase().trim();
    const configuredAdminEmail = String(process.env.ADMIN_EMAIL || 'admin@cakesofparadise.com').trim().toLowerCase();
    if (normalizedEmail === configuredAdminEmail) {
      return res.status(403).json({ message: 'This email is reserved for the bakery administrator. Sign in with the configured admin credentials.' });
    }
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ message: 'A user with this email already exists' });
    }

    const referralInput = req.body.referralCode;
    if (referralInput !== undefined && typeof referralInput !== 'string') {
      return res.status(400).json({ message: 'Enter a valid referral code, or leave it blank.' });
    }
    const referralCodeUsed = String(referralInput || '').trim().toUpperCase();
    if (referralCodeUsed && !/^[A-Z0-9-]{3,32}$/.test(referralCodeUsed)) {
      return res.status(400).json({ message: 'Referral codes must be 3–32 letters or numbers.' });
    }
    let referrer = null;
    if (referralCodeUsed) {
      referrer = await User.findOne({ referralCode: referralCodeUsed }).select('_id email');
      if (!referrer) return res.status(400).json({ message: 'That referral code was not found. Check it or leave the field blank.' });
      if (String(referrer.email).toLowerCase() === normalizedEmail) return res.status(400).json({ message: 'You cannot use your own referral code.' });
    }

    // 3. Hash password using bcrypt
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 4. Save new user. Enforce role = 'user' strictly (ignore any client-provided role)
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: 'user', // Public registration can ONLY create normal users
      phone: phone ? phone.trim() : '',
      avatar: avatar || '',
      ...(referrer ? { referredBy: referrer._id, referralCodeUsed } : {}),
    });

    // Registration confirmation is a service email; delivery trouble must not undo the new account.
    void sendRegisteredWelcome(user).then(async (result) => {
      if (result.sent) await User.updateOne({ _id: user._id, welcomeEmailSentAt: null }, { $set: { welcomeEmailSentAt: new Date() } });
    }).catch(() => console.error('Registration welcome email status could not be saved.'));

    // 5. Generate JWT token
    const token = generateToken(user._id, user.role);

    // 6. Return response (do NOT return password)
    return res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone || '',
        avatar: user.avatar || '',
        referralCodeUsed: user.referralCodeUsed || '',
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ message: 'Server error during registration', error: error.message });
  }
};

/**
 * @desc    Authenticate user (Customer or Admin) & get token
 * @route   POST /api/auth/login
 * @access  Public
 */
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Basic validation
    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    // 2. Find user in MongoDB by lowercase email (or 'admin' username)
    if (typeof email !== 'string' || typeof password !== 'string' || password.length > 128) {
      return res.status(400).json({ message: 'Please provide a valid email and password' });
    }
    const normalizedInput = email.toLowerCase().trim();
    const configuredAdminEmail = String(process.env.ADMIN_EMAIL || 'admin@cakesofparadise.com').trim().toLowerCase();
    const searchEmail = normalizedInput === 'admin' ? configuredAdminEmail : normalizedInput;
    let user = await User.findOne({ email: searchEmail });

    // The configured administrator secret is the only credential allowed to
    // provision or repair the reserved admin account. This prevents a stale
    // customer-role record from silently sending the bakery owner to the shop.
    const isConfiguredAdmin = Boolean(configuredAdminEmail && searchEmail === configuredAdminEmail);
    const configuredAdminPassword = process.env.ADMIN_PASSWORD || '';
    const canProvisionAdmin = isConfiguredAdmin && isValidPassword(configuredAdminPassword) && safeStringEqual(password, configuredAdminPassword);
    if (canProvisionAdmin && (!user || user.role !== 'admin')) {
      const adminPasswordHash = await bcrypt.hash(configuredAdminPassword, 10);
      if (user) {
        user.role = 'admin';
        user.password = adminPasswordHash;
        await user.save();
      } else {
        user = await User.create({
          name: String(process.env.ADMIN_NAME || 'Bakery Admin').trim(),
          email: configuredAdminEmail,
          password: adminPasswordHash,
          role: 'admin',
        });
      }
    }

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // 3. Compare passwords using bcrypt
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (isConfiguredAdmin && user.role !== 'admin') {
      return res.status(403).json({ message: 'This account is not provisioned as a bakery admin. Check the configured admin email and password, or run `npm run seed:admin` from the backend folder.' });
    }

    // 4. Generate JWT containing userId and role
    const token = generateToken(user._id, user.role);

    // 5. Return token and user details
    return res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone || '',
        avatar: user.avatar || '',
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Server error during login', error: error.message });
  }
};

/**
 * @desc    Get current logged in user profile
 * @route   GET /api/auth/profile
 * @access  Private (Requires valid JWT)
 */
const getUserProfile = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      phone: req.user.phone || '',
      dateOfBirth: req.user.dateOfBirth || '',
      avatar: req.user.avatar || '',
    });
  } catch (error) {
    console.error('Profile retrieval error:', error);
    return res.status(500).json({ message: 'Server error fetching profile', error: error.message });
  }
};

/**
 * @desc    Update user profile (name, phone, avatar, or change password)
 * @route   PUT /api/auth/profile
 * @access  Private (Requires valid JWT)
 */
const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { name, phone, avatar, dateOfBirth, currentPassword, newPassword } = req.body;

    if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
      return res.status(400).json({ message: 'Name must be a non-empty string' });
    }
    if (phone !== undefined && typeof phone !== 'string') {
      return res.status(400).json({ message: 'Phone number must be a string' });
    }
    if (dateOfBirth !== undefined) {
      const validDate = typeof dateOfBirth === 'string' && (!dateOfBirth || /^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth));
      const parsed = validDate && dateOfBirth ? new Date(`${dateOfBirth}T00:00:00Z`) : null;
      if (!validDate || (dateOfBirth && (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dateOfBirth || parsed > new Date()))) return res.status(400).json({ message: 'Enter a valid date of birth.' });
      user.dateOfBirth = dateOfBirth;
    }
    if (!isValidAvatar(avatar)) {
      return res.status(400).json({ message: 'Profile photo must be a JPEG, PNG, or WebP image under 2 MB' });
    }

    if (name && name.trim()) {
      user.name = name.trim();
    }

    if (phone !== undefined) {
      user.phone = phone.trim();
    }

    if (avatar !== undefined) {
      user.avatar = avatar;
    }

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ message: 'Please provide your current password to set a new password' });
      }
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }
      if (!isValidPassword(newPassword)) {
        return res.status(400).json({ message: passwordPolicyMessage.replace(/^Password/, 'New password') });
      }
      user.password = await bcrypt.hash(newPassword, 10);
    }

    await user.save();

    return res.status(200).json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone || '',
        dateOfBirth: user.dateOfBirth || '',
        avatar: user.avatar || '',
      },
    });
  } catch (error) {
    console.error('Profile update error:', error);
    return res.status(500).json({ message: 'Server error updating profile', error: error.message });
  }
};

const requestPasswordReset = async (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,63}$/.test(email)) return res.status(400).json({ message: 'Enter a valid email address.' });
  const user = await User.findOne({ email, role: 'user' }).select('+passwordResetOtpHash +passwordResetOtpExpiresAt +passwordResetOtpSentAt +passwordResetAttempts');
  if (!user) return res.status(404).json({ code: 'ACCOUNT_NOT_FOUND', message: 'There is no account registered with this email address. Create an account to join us.' });

  const { isConfigured } = require('../services/emailService');
  if (!isConfigured()) {
    return res.status(503).json({ message: 'Email verification is temporarily unavailable. Please contact the bakery for help.' });
  }

  const generic = 'If an account uses that email, a verification code has been sent.';
  const now = Date.now();
  if (user.passwordResetOtpSentAt && now - user.passwordResetOtpSentAt.getTime() < 45_000) return res.json({ message: generic });

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  user.passwordResetOtpHash = resetDigest(code);
  user.passwordResetOtpExpiresAt = new Date(now + 10 * 60_000);
  user.passwordResetOtpSentAt = new Date(now);
  user.passwordResetAttempts = 0;
  user.passwordResetTokenHash = '';
  user.passwordResetTokenExpiresAt = null;
  await user.save();

  try {
    const message = passwordResetOtpTemplate(user, code);
    const result = await sendEmailMessage({ to: user.email, ...message });
    if (!result.sent) throw new Error('Email delivery is not configured.');
    return res.json({ message: generic });
  } catch (error) {
    user.passwordResetOtpHash = '';
    user.passwordResetOtpExpiresAt = null;
    user.passwordResetOtpSentAt = null;
    await user.save();
    console.error(`Password reset email delivery failed: ${error.message}`);
    return res.status(503).json({ message: 'We could not send the verification email right now. Please try again later.' });
  }
};

const verifyPasswordResetOtp = async (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const code = typeof req.body.code === 'string' ? req.body.code.trim() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,63}$/.test(email) || !/^\d{6}$/.test(code)) return res.status(400).json({ message: 'Enter the email address and six-digit code.' });
  const user = await User.findOne({ email, role: 'user' }).select('+passwordResetOtpHash +passwordResetOtpExpiresAt +passwordResetAttempts');
  if (!user || !user.passwordResetOtpHash || !user.passwordResetOtpExpiresAt || user.passwordResetOtpExpiresAt <= new Date()) return res.status(400).json({ message: 'That code is invalid or expired. Request a new one and try again.' });
  if (user.passwordResetAttempts >= 5) return res.status(429).json({ message: 'Too many incorrect attempts. Request a new code to continue.' });
  if (!safeEqual(resetDigest(code), user.passwordResetOtpHash)) {
    user.passwordResetAttempts += 1;
    if (user.passwordResetAttempts >= 5) { user.passwordResetOtpHash = ''; user.passwordResetOtpExpiresAt = null; }
    await user.save();
    return res.status(user.passwordResetAttempts >= 5 ? 429 : 400).json({ message: user.passwordResetAttempts >= 5 ? 'Too many incorrect attempts. Request a new code to continue.' : 'That code does not match. Please check it and try again.' });
  }
  const resetToken = crypto.randomBytes(32).toString('base64url');
  user.passwordResetOtpHash = '';
  user.passwordResetOtpExpiresAt = null;
  user.passwordResetTokenHash = resetDigest(resetToken);
  user.passwordResetTokenExpiresAt = new Date(Date.now() + 10 * 60_000);
  await user.save();
  return res.json({ message: 'Code verified. Choose a new password.', resetToken });
};

const resetPassword = async (req, res) => {
  const token = typeof req.body.resetToken === 'string' ? req.body.resetToken : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!token || token.length > 128) return res.status(400).json({ message: 'Verify your email code before choosing a new password.' });
  if (!isValidPassword(password)) return res.status(400).json({ message: passwordPolicyMessage.replace(/^Password/, 'New password') });
  const tokenHash = resetDigest(token);
  const user = await User.findOne({ role: 'user', passwordResetTokenHash: tokenHash, passwordResetTokenExpiresAt: { $gt: new Date() } }).select('+passwordResetTokenHash +passwordResetTokenExpiresAt');
  if (!user) return res.status(400).json({ message: 'This password reset has expired. Request a new verification code.' });
  user.password = await bcrypt.hash(password, 10);
  user.passwordResetTokenHash = '';
  user.passwordResetTokenExpiresAt = null;
  user.passwordResetAttempts = 0;
  await user.save();
  return res.json({ message: 'Your password has been changed. You can now sign in.' });
};

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
  updateProfile,
  requestPasswordReset,
  verifyPasswordResetOtp,
  resetPassword,
};
