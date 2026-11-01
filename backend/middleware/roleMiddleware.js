/**
 * Role-based Authorization Middleware
 * Verifies that the authenticated user possesses one of the allowed roles.
 *
 * Example usage: requireRole('admin') or requireRole('admin', 'manager')
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    // If user is not authenticated or role is not in the allowed roles
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Forbidden: Access denied. Required role: ${roles.join(' or ')}.`,
      });
    }

    // Role authorized, proceed to the next handler
    next();
  };
};

module.exports = { requireRole };
