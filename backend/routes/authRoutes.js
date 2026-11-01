const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  getUserProfile,
  updateProfile,
  requestPasswordReset,
  verifyPasswordResetOtp,
  resetPassword,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const account = require('../controllers/accountController');

// Public routes
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/forgot-password', (req, res, next) => Promise.resolve(requestPasswordReset(req, res)).catch(next));
router.post('/verify-reset-otp', (req, res, next) => Promise.resolve(verifyPasswordResetOtp(req, res)).catch(next));
router.post('/reset-password', (req, res, next) => Promise.resolve(resetPassword(req, res)).catch(next));

// Protected routes (require valid JWT)
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateProfile);
router.get('/account', protect, (req, res, next) => Promise.resolve(account.getAccount(req, res)).catch(next));
router.get('/account/cart', protect, (req, res, next) => Promise.resolve(account.getCart(req, res)).catch(next));
router.put('/account/cart', protect, (req, res, next) => Promise.resolve(account.replaceCart(req, res)).catch(next));
router.put('/account/preferences', protect, (req, res, next) => Promise.resolve(account.updatePreferences(req, res)).catch(next));
router.post('/account/addresses', protect, (req, res, next) => Promise.resolve(account.addAddress(req, res)).catch(next));
router.delete('/account/addresses/:addressId', protect, (req, res, next) => Promise.resolve(account.deleteAddress(req, res)).catch(next));
router.put('/account/favorites/:productId', protect, (req, res, next) => Promise.resolve(account.toggleFavorite(req, res)).catch(next));

module.exports = router;
