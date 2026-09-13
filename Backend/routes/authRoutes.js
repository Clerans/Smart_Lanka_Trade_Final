const express = require('express');
const router = express.Router();
const {
  login,
  register,
  getUsers,
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
  syncUser
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/adminMiddleware');

// Firebase user synchronization endpoint
router.post('/sync', protect, syncUser);
router.get('/me', protect, syncUser);

router.post('/register', register);
router.post('/login', login);
router.post('/google-login', googleLogin);
router.get('/users', protect, requireAdmin, getUsers);
router.get('/verify/:token', verifyEmailToken); // Legacy HTML verification support

// New OTP & security endpoints
router.post('/send-verification', sendVerification);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);
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
