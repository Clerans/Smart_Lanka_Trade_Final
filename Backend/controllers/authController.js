const authService = require('../services/authService');
const { validateEmail, validatePassword } = require('../utils/validator');

// Extract client metadata for audit trails
function getClientMeta(req) {
  return {
    ip: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'SmartLanka-App'
  };
}

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(422).json({
        success: false,
        code: 'MISSING_FIELDS',
        message: 'Please fill in all registration fields.'
      });
    }

    if (!validateEmail(email)) {
      return res.status(422).json({
        success: false,
        code: 'INVALID_EMAIL',
        message: 'Invalid email address format.'
      });
    }

    if (!validatePassword(password)) {
      return res.status(422).json({
        success: false,
        code: 'PASSWORD_TOO_WEAK',
        message: 'Password is too weak. Must be at least 8 characters, and contain uppercase, lowercase, numbers, and special characters.'
      });
    }

    const result = await authService.registerUser(name, email, password, 'INVESTOR', getClientMeta(req));
    
    // Security Rule: NEVER expose or return OTP in API response
    res.status(201).json({
      success: true,
      message: 'Registration successful! A verification code has been sent to your email.',
      userId: result.userId
    });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      code: err.code || 'SERVER_ERROR',
      message: err.message || 'An error occurred during registration.'
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(422).json({
        success: false,
        code: 'MISSING_FIELDS',
        message: 'Please enter both email and password.'
      });
    }

    const data = await authService.loginUser(email, password, getClientMeta(req));
    res.json({
      success: true,
      token: data.token,
      user: data.user
    });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      code: err.code || 'SERVER_ERROR',
      message: err.message || 'An error occurred during login.'
    });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(422).json({
        success: false,
        code: 'MISSING_FIELDS',
        message: 'Email and OTP verification code are required.'
      });
    }

    const result = await authService.verifyEmailOTP(email, otp, getClientMeta(req));
    res.json({
      success: true,
      message: result.message
    });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      code: err.code || 'SERVER_ERROR',
      message: err.message || 'Verification failed.'
    });
  }
};

exports.sendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(422).json({
        success: false,
        code: 'MISSING_FIELDS',
        message: 'Email is required.'
      });
    }

    const result = await authService.resendVerificationOTP(email, getClientMeta(req));
    res.json({
      success: true,
      message: result.message
    });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      code: err.code || 'SERVER_ERROR',
      message: err.message || 'Failed to send verification code.'
    });
  }
};

exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(422).json({
        success: false,
        code: 'MISSING_FIELDS',
        message: 'Email is required.'
      });
    }

    const result = await authService.resendVerificationOTP(email, getClientMeta(req));
    res.json({
      success: true,
      message: result.message
    });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      code: err.code || 'SERVER_ERROR',
      message: err.message || 'Failed to resend verification code.'
    });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(422).json({
        success: false,
        code: 'MISSING_FIELDS',
        message: 'Email is required.'
      });
    }

    const result = await authService.forgotPassword(email, getClientMeta(req));
    res.json({
      success: true,
      message: result.message
    });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      code: err.code || 'SERVER_ERROR',
      message: err.message || 'Failed to process forgot password request.'
    });
  }
};

exports.verifyResetOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(422).json({
        success: false,
        code: 'MISSING_FIELDS',
        message: 'Email and OTP code are required.'
      });
    }

    const result = await authService.verifyResetOTP(email, otp);
    res.json({
      success: true,
      message: result.message
    });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      code: err.code || 'SERVER_ERROR',
      message: err.message || 'Invalid code.'
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, password } = req.body;
    if (!email || !otp || !password) {
      return res.status(422).json({
        success: false,
        code: 'MISSING_FIELDS',
        message: 'Email, OTP, and new password are required.'
      });
    }

    const result = await authService.resetPassword(email, otp, password, getClientMeta(req));
    res.json({
      success: true,
      message: result.message
    });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      code: err.code || 'SERVER_ERROR',
      message: err.message || 'Password reset failed.'
    });
  }
};

exports.validateToken = async (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
};

exports.googleLogin = async (req, res) => {
  try {
    const { idToken, email, name } = req.body;
    if (!email) {
      return res.status(422).json({
        success: false,
        code: 'MISSING_FIELDS',
        message: 'Google authentication details are required.'
      });
    }

    const data = await authService.googleLoginUser(idToken, email, name, getClientMeta(req));
    res.json({
      success: true,
      token: data.token,
      user: data.user
    });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      code: err.code || 'SERVER_ERROR',
      message: err.message || 'Google authentication failed.'
    });
  }
};
