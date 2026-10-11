const authService = require('../services/authService');
const { validateEmail, validatePassword } = require('../utils/validator');

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
        message: 'Invalid email format.'
      });
    }

    if (!validatePassword(password)) {
      return res.status(422).json({
        success: false,
        code: 'PASSWORD_TOO_WEAK',
        message: 'Password is too weak. Must be at least 8 characters, and contain uppercase, lowercase, numbers, and special characters.'
      });
    }

    const result = await authService.registerUser(name, email, password);
    res.status(201).json({
      success: true,
      message: 'Registration successful! Please check your email for the verification code.',
      userId: result.userId
    });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      code: err.code || 'SERVER_ERROR',
      message: err.message
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

    const data = await authService.loginUser(email, password);
    res.json({
      success: true,
      token: data.token,
      user: data.user
    });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      code: err.code || 'SERVER_ERROR',
      message: err.message
    });
  }
};

exports.sendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(422).json({
        success: false,
        code: 'MISSING_FIELDS',
        message: 'Email address is required.'
      });
    }

    if (!validateEmail(email)) {
      return res.status(422).json({
        success: false,
        code: 'INVALID_EMAIL',
        message: 'Invalid email address format.'
      });
    }

    const result = await authService.sendOtp(email);
    res.json({
      success: true,
      message: result.message || 'Verification code sent successfully.'
    });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      code: err.code || 'SERVER_ERROR',
      message: err.message || 'Unable to send verification code.'
    });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(422).json({
        success: false,
        code: 'MISSING_FIELDS',
        message: 'Email address and 6-digit verification code are required.'
      });
    }

    if (!validateEmail(email)) {
      return res.status(422).json({
        success: false,
        code: 'INVALID_EMAIL',
        message: 'Invalid email address format.'
      });
    }

    const result = await authService.verifyOtp(email, otp);
    res.json({
      success: true,
      message: result.message || 'Email verified successfully!'
    });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      code: err.code || 'SERVER_ERROR',
      message: err.message || 'Verification failed.'
    });
  }
};

// Aliases for backward compatibility
exports.verifyEmail = exports.verifyOtp;
exports.sendVerification = exports.sendOtp;
exports.resendVerification = exports.sendOtp;

exports.verifyEmailToken = async (req, res) => {
  try {
    const { token } = req.params;
    const result = await authService.verifyEmailToken(token);
    res.send(`<h1>Verification Successful</h1><p>${result.message}</p>`);
  } catch (err) {
    res.status(err.status || 400).send(`<h1>Verification Failed</h1><p>${err.message}</p>`);
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

    const result = await authService.forgotPassword(email);
    res.json({
      success: true,
      message: 'Password reset OTP sent successfully.'
    });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      code: err.code || 'SERVER_ERROR',
      message: err.message
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
      message: err.message
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

    const result = await authService.resetPassword(email, otp, password);
    res.json({
      success: true,
      message: result.message
    });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      code: err.code || 'SERVER_ERROR',
      message: err.message
    });
  }
};

exports.validateToken = async (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
};

exports.syncUser = async (req, res) => {
  try {
    const profile = await authService.getUserProfile(req.user.id);
    res.json({
      success: true,
      user: profile
    });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      code: err.code || 'SERVER_ERROR',
      message: err.message
    });
  }
};

exports.getSecuritySettings = async (req, res) => {
  try {
    const userModel = require('../models/userModel');
    const settings = await userModel.getSecuritySettings(req.user.id);
    res.json({
      success: true,
      data: settings
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: err.message
    });
  }
};

exports.updateSecuritySettings = async (req, res) => {
  try {
    const { twoFactorEnabled, pin } = req.body;
    const userModel = require('../models/userModel');
    const bcrypt = require('bcryptjs');

    const updatePayload = {};
    if (twoFactorEnabled !== undefined) {
      updatePayload.twoFactorEnabled = !!twoFactorEnabled;
    }
    if (pin) {
      const cleanPin = String(pin).trim();
      if (!/^\d{4,6}$/.test(cleanPin)) {
        return res.status(422).json({
          success: false,
          code: 'INVALID_PIN_FORMAT',
          message: 'Security PIN must be 4 to 6 digits.'
        });
      }
      updatePayload.pinHash = await bcrypt.hash(cleanPin, 10);
    }

    const settings = await userModel.updateSecuritySettings(req.user.id, updatePayload);
    res.json({
      success: true,
      message: 'Security settings updated successfully.',
      data: settings
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: err.message
    });
  }
};

exports.verifyPin = async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin) {
      return res.status(422).json({
        success: false,
        code: 'MISSING_PIN',
        message: 'Security PIN is required.'
      });
    }

    const userModel = require('../models/userModel');
    const isValid = await userModel.verifyPin(req.user.id, pin);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        code: 'INVALID_PIN',
        message: 'Incorrect security PIN.'
      });
    }

    res.json({
      success: true,
      message: 'Security PIN verified successfully.'
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: err.message
    });
  }
};


exports.getUsers = async (req, res) => {
  try {
    const userModel = require('../models/userModel');
    const users = await userModel.findAllUsers();
    res.json(users);
  } catch (err) {
    res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: err.message
    });
  }
};

exports.googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({
        success: false,
        code: 'MISSING_ID_TOKEN',
        message: 'Google ID token is required.'
      });
    }

    const data = await authService.googleLoginUser(idToken);
    res.json({
      success: true,
      token: data.token,
      user: data.user
    });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      code: err.code || 'SERVER_ERROR',
      message: err.message
    });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(422).json({
        success: false,
        code: 'MISSING_FIELDS',
        message: 'Current password and new password are required.'
      });
    }

    const result = await authService.changePasswordUser(req.user.id, currentPassword, newPassword);
    res.json({
      success: true,
      message: result.message
    });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      code: err.code || 'SERVER_ERROR',
      message: err.message
    });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const profile = await authService.getUserProfile(req.user.id);
    res.json({
      success: true,
      user: profile
    });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      code: err.code || 'SERVER_ERROR',
      message: err.message
    });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, email, phoneNumber, profileImage } = req.body;
    const updatedUser = await authService.updateUserProfile(req.user.id, {
      name,
      email,
      phoneNumber,
      profileImage
    });

    res.json({
      success: true,
      message: 'Profile updated successfully.',
      user: updatedUser
    });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      code: err.code || 'SERVER_ERROR',
      message: err.message
    });
  }
};
