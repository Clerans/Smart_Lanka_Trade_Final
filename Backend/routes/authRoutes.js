const express = require('express');
const router = express.Router();
const {
  login,
  register,
  getUsers,
  sendOtp,
  verifyOtp,
  verifyEmail,
  verifyEmailToken,
  sendVerification,
  resendVerification,
  forgotPassword,
  verifyResetOTP,
  resetPassword,
  validateToken,
  googleLogin,
  changePassword,
  getProfile,
  updateProfile,
  syncUser,
  getSecuritySettings,
  updateSecuritySettings,
  verifyPin
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/adminMiddleware');
const { rateLimit } = require('express-rate-limit');

// Dedicated rate limiter for OTP endpoints
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // 15 requests per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: 'TOO_MANY_REQUESTS',
    message: 'Too many OTP verification attempts from this IP. Please try again after 15 minutes.'
  }
});

// Dedicated rate limiter for authentication & credential verification endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: 'TOO_MANY_REQUESTS',
    message: 'Too many authentication requests from this IP. Please try again after 15 minutes.'
  }
});

// Authenticated session state endpoints
router.post('/sync', protect, syncUser);
router.get('/me', protect, syncUser);

// Security Settings & PIN Verification Endpoints
router.get('/security-settings', protect, getSecuritySettings);
router.put('/security-settings', protect, updateSecuritySettings);
router.post('/verify-pin', protect, authLimiter, verifyPin);

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/google-login', authLimiter, googleLogin);
router.get('/users', protect, requireAdmin, getUsers);
router.get('/verify/:token', verifyEmailToken); // Legacy HTML verification support

// Email OTP Endpoints
router.post('/send-otp', otpLimiter, sendOtp);
router.post('/verify-otp', otpLimiter, verifyOtp);
router.post('/send-verification', otpLimiter, sendVerification);
router.post('/verify-email', otpLimiter, verifyEmail);
router.post('/resend-verification', otpLimiter, resendVerification);
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-otp', verifyResetOTP);
router.post('/reset-password', resetPassword);
router.post('/change-password', protect, changePassword);

// User Profile management endpoints
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);

// Token check endpoint
router.get('/validate-token', protect, validateToken);

module.exports = router;
