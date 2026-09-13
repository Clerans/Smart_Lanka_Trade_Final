const jwt = require('jsonwebtoken');
const { verifyFirebaseIdToken, isInitialized } = require('../config/firebaseAdmin');
const userModel = require('../models/userModel');

/**
 * Firebase Authentication Middleware
 * 
 * Verifies the incoming Firebase ID token, resolves/synchronizes the Oracle SL_USERS record,
 * and attaches standard user identity (`req.user`) compatible with all downstream controllers.
 */
const firebaseAuth = async (req, res, next) => {
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

  // 1. Primary: Verify as Firebase ID Token via Firebase Admin SDK
  try {
    const decoded = await verifyFirebaseIdToken(token);
    const firebaseUid = decoded.uid;
    const email = decoded.email || `${firebaseUid}@firebase.user`;
    const name = decoded.name || decoded.display_name || email.split('@')[0];
    const emailVerified = !!decoded.email_verified;

    // Resolve or synchronize user in Oracle Database
    const user = await userModel.createOrSyncFirebaseUser({
      firebaseUid,
      email,
      name,
      emailVerified
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        code: 'USER_NOT_FOUND',
        message: 'Unable to resolve application user record for authenticated credentials.'
      });
    }

    // Attach verified user payload
    req.user = {
      id: user.ID,
      accountUid: user.ACCOUNT_UID,
      email: user.EMAIL,
      name: user.NAME,
      role: (user.ROLE || 'USER').toUpperCase(),
      firebaseUid: firebaseUid,
      isVerified: user.IS_VERIFIED === 1,
      emailVerified: emailVerified
    };
    req.firebaseUser = decoded;

    return next();
  } catch (firebaseErr) {
    // 2. Secondary fallback: Legacy SmartLanka JWT (for backward compatibility during transition)
    if (process.env.JWT_SECRET) {
      try {
        const decodedJwt = jwt.verify(token, process.env.JWT_SECRET);
        const user = await userModel.findById(decodedJwt.id);
        if (user) {
          req.user = {
            id: user.ID,
            accountUid: user.ACCOUNT_UID,
            email: user.EMAIL,
            name: user.NAME,
            role: (user.ROLE || decodedJwt.role || 'USER').toUpperCase(),
            firebaseUid: user.FIREBASE_UID || null,
            isVerified: user.IS_VERIFIED === 1,
            emailVerified: user.IS_VERIFIED === 1
          };
          return next();
        }
      } catch (jwtErr) {
        // Fallback failed as well
      }
    }

    return res.status(401).json({
      success: false,
      code: firebaseErr.code || 'INVALID_TOKEN',
      message: firebaseErr.message || 'Authentication failed: Invalid or expired token.'
    });
  }
};

module.exports = {
  firebaseAuth,
  protect: firebaseAuth // Drop-in replacement for existing route definitions
};
