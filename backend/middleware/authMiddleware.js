const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Authentication Middleware
 * Validates the JWT from the Authorization header (Bearer <token>)
 * and attaches the authenticated user to req.user.
 */
const protect = async (req, res, next) => {
  let token;

  // Check if Authorization header exists and starts with "Bearer"
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Extract token from "Bearer <token>"
      token = req.headers.authorization.split(' ')[1];

      // Verify the token using JWT_SECRET
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Fetch the user from MongoDB (excluding password)
      req.user = await User.findById(decoded.userId).select('-password');

      if (!req.user) {
        return res.status(401).json({ message: 'User belonging to this token no longer exists' });
      }

      // Proceed to the next middleware or controller
      next();
    } catch (error) {
      console.error('JWT Verification error:', error.message);
      return res.status(401).json({ message: 'Not authorized, invalid or expired token' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token provided' });
  }
};

module.exports = { protect };
