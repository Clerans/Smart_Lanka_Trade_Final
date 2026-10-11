const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');

/**
 * Authentication Middleware for SmartLanka Trade
 * Verifies the application's authoritative JWT token and attaches user identity (req.user).
 */
const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      code: 'UNAUTHORIZED',
      message: 'Authorization denied. No Bearer token provided.'
    });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({
      success: false,
      code: 'UNAUTHORIZED',
      message: 'Authorization denied. Empty token.'
    });
  }

  // 1. Primary: Verify SmartLanka Application JWT
  if (process.env.JWT_SECRET) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await userModel.findById(decoded.id);

      if (user) {
        req.user = {
          id: user.ID,
          accountUid: user.ACCOUNT_UID || null,
          email: user.EMAIL,
          name: user.NAME,
          role: (user.ROLE || decoded.role || 'USER').toUpperCase(),
          firebaseUid: user.FIREBASE_UID || null,
          isVerified: user.IS_VERIFIED === 1,
          emailVerified: user.IS_VERIFIED === 1,
          phoneNumber: user.PHONE_NUMBER || null,
          profileImage: user.PROFILE_IMAGE || null
        };
        return next();
      }
    } catch (jwtErr) {
      return res.status(401).json({
        success: false,
        code: 'UNAUTHORIZED',
        message: 'Authentication failed: Invalid or expired token.'
      });
    }
  }

  return res.status(401).json({
    success: false,
    code: 'UNAUTHORIZED',
    message: 'Authentication failed: Invalid or expired token.'
  });
};

/**
 * Middleware to require that the user's email is verified before proceeding
 */
const requireVerifiedEmail = (req, res, next) => {
  if (!req.user || (!req.user.isVerified && !req.user.emailVerified)) {
    return res.status(403).json({
      success: false,
      code: 'EMAIL_NOT_VERIFIED',
      message: 'Please verify your email address to access trading and wallet features.'
    });
  }
  next();
};

module.exports = {
  protect,
  requireVerifiedEmail
};



