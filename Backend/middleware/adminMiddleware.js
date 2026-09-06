const userModel = require('../models/userModel');

/**
 * Middleware: requireAdmin
 * Ensures the authenticated user has administrative privileges.
 * 
 * Verifies both token claims and confirms current status in the Oracle database
 * to prevent privilege escalation via stale or forged tokens.
 */
const requireAdmin = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. No user credentials found.'
      });
    }

    // Verify role directly against Oracle DB record (defense-in-depth)
    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User account not found.'
      });
    }

    const role = (user.ROLE || req.user.role || 'USER').toUpperCase();
    if (role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. Administrator privileges are required to access this resource.'
      });
    }

    // Attach verified admin details
    req.adminUser = user;
    next();
  } catch (error) {
    console.error('Admin authorization error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify administrative authorization.'
    });
  }
};

module.exports = { requireAdmin };
