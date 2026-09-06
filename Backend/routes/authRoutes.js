const express = require('express');
const router = express.Router();
const {
  login,
  register,
  verifyEmail,
  sendVerification,
  resendVerification,
  forgotPassword,
  verifyResetOTP,
  resetPassword,
  validateToken,
  googleLogin
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// Public Authentication Endpoints
router.post('/register', register);
router.post('/login', login);
router.post('/google-login', googleLogin);

// Verification & Recovery Endpoints
router.post('/send-verification', sendVerification);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-otp', verifyResetOTP);
router.post('/reset-password', resetPassword);

// Authenticated Token Verification Endpoint
router.get('/validate-token', protect, validateToken);

module.exports = router;
