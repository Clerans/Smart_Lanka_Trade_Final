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
  changePassword
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.post('/google-login', googleLogin);
router.get('/users', getUsers);
router.get('/verify/:token', verifyEmailToken); // Legacy HTML verification support

// New OTP & security endpoints
router.post('/send-verification', sendVerification);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-otp', verifyResetOTP);
router.post('/reset-password', resetPassword);
router.post('/change-password', protect, changePassword);

// Token check endpoint
router.get('/validate-token', protect, validateToken);

module.exports = router;
