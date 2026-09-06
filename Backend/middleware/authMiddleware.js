const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');

/**
 * Standard JWT Authentication Middleware
 * Enforces valid Bearer token and attaches authenticated user payload
 */
const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      code: 'UNAUTHORIZED',
      message: 'Access denied. No valid authentication token provided.'
    });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({
      success: false,
      code: 'UNAUTHORIZED',
      message: 'Access denied. Token missing.'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'smartlanka_super_secret_jwt_key_2026');
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role || 'INVESTOR',
      name: decoded.name || 'Investor'
    };
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      code: 'TOKEN_INVALID',
      message: 'Session token has expired or is invalid. Please log in again.'
    });
  }
};

/**
 * RBAC Admin Authorization Middleware
 * Enforces that authenticated user holds the ADMIN role
 */
const adminProtect = async (req, res, next) => {
  await protect(req, res, async () => {
    if (!req.user || req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'Administrative privileges required to access this resource.'
      });
    }
    next();
  });
};

module.exports = {
  protect,
  adminProtect
};
