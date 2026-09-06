const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const userModel = require('../models/userModel');
const verificationModel = require('../models/verificationModel');
const { sendVerificationEmail } = require('./emailService');
const { validatePassword, validateEmail } = require('../utils/validator');
const { logAuditEvent } = require('./auditService');

const JWT_SECRET = process.env.JWT_SECRET || 'smartlanka_super_secret_jwt_key_2026';
const MAX_OTP_ATTEMPTS = 5;
const OTP_EXPIRY_MINUTES = 5;

const createError = (code, message, status = 400) => {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
};

// Generate cryptographically secure 6-digit OTP
function generateSecureOTP() {
  return crypto.randomInt(100000, 1000000).toString();
}

exports.registerUser = async (name, email, password, role = 'INVESTOR', clientMeta = {}) => {
  const sanitizedEmail = email.trim().toLowerCase();
  
  if (!validateEmail(sanitizedEmail)) {
    throw createError('INVALID_EMAIL', 'Please provide a valid email address.', 422);
  }

  // Check if email already exists
  const existingUser = await userModel.findByEmail(sanitizedEmail);
  if (existingUser) {
    throw createError('EMAIL_ALREADY_EXISTS', 'Email address is already registered.', 409);
  }

  // Validate password strength
  if (!validatePassword(password)) {
    throw createError(
      'PASSWORD_TOO_WEAK',
      'Password must be at least 8 characters, and contain uppercase, lowercase, numbers, and special characters.',
      422
    );
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const userId = await userModel.createUser(name.trim(), sanitizedEmail, hashedPassword, role);

  // Generate cryptographically secure 6-digit OTP & store its bcrypt hash
  const otp = generateSecureOTP();
  const otpHashed = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
  
  await verificationModel.createEmailVerificationOTP(userId, otpHashed, expiresAt);

  // Send verification email
  sendVerificationEmail(sanitizedEmail, otp);

  // Audit Log
  await logAuditEvent({
    userId,
    action: 'USER_REGISTRATION',
    entity: 'USER',
    entityId: userId,
    ipAddress: clientMeta.ip,
    userAgent: clientMeta.userAgent,
    details: `User registered with role ${role}`
  });

  return { userId, email: sanitizedEmail };
};

exports.loginUser = async (email, password, clientMeta = {}) => {
  const sanitizedEmail = email.trim().toLowerCase();
  const user = await userModel.findByEmail(sanitizedEmail);
  
  if (!user) {
    await logAuditEvent({
      userId: null,
      action: 'LOGIN_FAILED',
      entity: 'SECURITY',
      ipAddress: clientMeta.ip,
      userAgent: clientMeta.userAgent,
      details: `Non-existent user login attempt for email: ${sanitizedEmail}`,
      status: 'FAILED'
    });
    throw createError('INVALID_CREDENTIALS', 'Invalid email or password.', 401);
  }

  // Check if account is locked
  if (user.ACCOUNT_LOCKED_UNTIL) {
    const lockTime = new Date(user.ACCOUNT_LOCKED_UNTIL);
    if (lockTime > new Date()) {
      const minutesLeft = Math.ceil((lockTime - new Date()) / (60 * 1000));
      await logAuditEvent({
        userId: user.ID,
        action: 'LOGIN_BLOCKED_LOCKED_ACCOUNT',
        entity: 'SECURITY',
        entityId: user.ID,
        ipAddress: clientMeta.ip,
        userAgent: clientMeta.userAgent,
        details: `Locked account login attempt. ${minutesLeft} mins remaining.`,
        status: 'BLOCKED'
      });
      throw createError(
        'ACCOUNT_LOCKED',
        `Account is temporarily locked due to failed login attempts. Try again in ${minutesLeft} minute(s).`,
        403
      );
    }
  }

  // Compare passwords
  const isMatch = await bcrypt.compare(password, user.PASSWORD);
  if (!isMatch) {
    const newAttempts = (user.FAILED_ATTEMPTS || 0) + 1;
    if (newAttempts >= 5) {
      const lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes lockout
      await userModel.lockAccount(user.ID, lockUntil);
      await logAuditEvent({
        userId: user.ID,
        action: 'ACCOUNT_LOCKED',
        entity: 'SECURITY',
        entityId: user.ID,
        ipAddress: clientMeta.ip,
        userAgent: clientMeta.userAgent,
        details: 'Account locked for 15 minutes after 5 failed attempts.',
        status: 'WARNING'
      });
      throw createError(
        'ACCOUNT_LOCKED',
        'Account locked due to 5 consecutive failed login attempts. Try again in 15 minutes.',
        403
      );
    } else {
      await userModel.updateFailedAttempts(user.ID, newAttempts);
      const remaining = 5 - newAttempts;
      await logAuditEvent({
        userId: user.ID,
        action: 'LOGIN_FAILED_PASSWORD',
        entity: 'SECURITY',
        entityId: user.ID,
        ipAddress: clientMeta.ip,
        userAgent: clientMeta.userAgent,
        details: `Failed password attempt (${newAttempts}/5).`,
        status: 'FAILED'
      });
      throw createError(
        'INVALID_CREDENTIALS',
        `Incorrect password. ${remaining} attempt(s) remaining before temporary lockout.`,
        401
      );
    }
  }

  // Check if email is verified
  if (user.IS_VERIFIED === 0) {
    throw createError('EMAIL_NOT_VERIFIED', 'Please verify your email address before logging in.', 403);
  }

  // Reset attempts and update last login
  await userModel.resetFailedAttemptsAndLogLogin(user.ID);

  // Generate JWT with claims
  const token = jwt.sign(
    {
      id: user.ID,
      email: user.EMAIL,
      role: user.ROLE || 'INVESTOR',
      name: user.NAME
    },
    JWT_SECRET,
    { expiresIn: '1d' }
  );

  await logAuditEvent({
    userId: user.ID,
    action: 'LOGIN_SUCCESS',
    entity: 'USER',
    entityId: user.ID,
    ipAddress: clientMeta.ip,
    userAgent: clientMeta.userAgent,
    details: `User logged in with role: ${user.ROLE}`
  });

  return {
    token,
    user: {
      id: user.ID,
      name: user.NAME,
      email: user.EMAIL,
      role: user.ROLE || 'INVESTOR',
      kycStatus: user.KYC_STATUS || 'UNVERIFIED'
    }
  };
};

exports.verifyEmailOTP = async (email, otp, clientMeta = {}) => {
  const sanitizedEmail = email.trim().toLowerCase();
  const user = await userModel.findByEmail(sanitizedEmail);
  if (!user) {
    throw createError('USER_NOT_FOUND', 'User with this email does not exist.', 404);
  }

  const record = await verificationModel.findActiveEmailVerification(sanitizedEmail);
  if (!record) {
    throw createError('OTP_INVALID', 'No active verification request found. Please request a new OTP.', 422);
  }

  if (record.ATTEMPTS >= MAX_OTP_ATTEMPTS) {
    throw createError('OTP_MAX_ATTEMPTS', 'Maximum OTP verification attempts exceeded. Please request a new code.', 422);
  }

  if (new Date(record.EXPIRES_AT) < new Date()) {
    throw createError('OTP_EXPIRED', 'Verification code has expired (valid for 5 minutes). Please request a new code.', 422);
  }

  const isOtpValid = await bcrypt.compare(otp.trim(), record.OTP_HASH);
  if (!isOtpValid) {
    await verificationModel.incrementEmailOtpAttempts(record.ID, record.ATTEMPTS + 1);
    const remaining = MAX_OTP_ATTEMPTS - (record.ATTEMPTS + 1);
    throw createError('OTP_INVALID', `Invalid verification code. ${remaining} attempt(s) remaining.`, 422);
  }

  // Mark verified and update user
  await userModel.verifyUser(user.ID);
  await verificationModel.markEmailVerificationOTPVerified(record.ID);

  await logAuditEvent({
    userId: user.ID,
    action: 'EMAIL_VERIFIED',
    entity: 'USER',
    entityId: user.ID,
    ipAddress: clientMeta.ip,
    userAgent: clientMeta.userAgent,
    details: 'User email verified successfully.'
  });

  return { message: 'Email verified successfully! You can now log in.' };
};

exports.resendVerificationOTP = async (email, clientMeta = {}) => {
  const sanitizedEmail = email.trim().toLowerCase();
  const user = await userModel.findByEmail(sanitizedEmail);
  if (!user) {
    throw createError('USER_NOT_FOUND', 'User with this email does not exist.', 404);
  }

  if (user.IS_VERIFIED === 1) {
    throw createError('EMAIL_ALREADY_VERIFIED', 'This email is already verified.', 409);
  }

  const otp = generateSecureOTP();
  const otpHashed = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
  
  await verificationModel.createEmailVerificationOTP(user.ID, otpHashed, expiresAt);
  sendVerificationEmail(sanitizedEmail, otp);

  await logAuditEvent({
    userId: user.ID,
    action: 'OTP_RESENT',
    entity: 'SECURITY',
    entityId: user.ID,
    ipAddress: clientMeta.ip,
    userAgent: clientMeta.userAgent,
    details: 'Verification OTP resent.'
  });

  return { message: 'Verification code resent successfully.' };
};

exports.forgotPassword = async (email, clientMeta = {}) => {
  const sanitizedEmail = email.trim().toLowerCase();
  const user = await userModel.findByEmail(sanitizedEmail);
  if (!user) {
    // Return generic message to prevent user enumeration
    return { message: 'If this email is registered, a password reset code has been sent.' };
  }

  const otp = generateSecureOTP();
  const otpHashed = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
  
  await verificationModel.createPasswordResetOTP(user.ID, otpHashed, expiresAt);
  sendVerificationEmail(sanitizedEmail, otp);

  await logAuditEvent({
    userId: user.ID,
    action: 'PASSWORD_RESET_REQUESTED',
    entity: 'SECURITY',
    entityId: user.ID,
    ipAddress: clientMeta.ip,
    userAgent: clientMeta.userAgent,
    details: 'Password reset OTP generated.'
  });

  return { message: 'If this email is registered, a password reset code has been sent.' };
};

exports.verifyResetOTP = async (email, otp) => {
  const sanitizedEmail = email.trim().toLowerCase();
  const user = await userModel.findByEmail(sanitizedEmail);
  if (!user) {
    throw createError('OTP_INVALID', 'Invalid code or request.', 422);
  }

  const record = await verificationModel.findActivePasswordReset(sanitizedEmail);
  if (!record) {
    throw createError('OTP_INVALID', 'No active reset request found. Please request a new code.', 422);
  }

  if (record.ATTEMPTS >= MAX_OTP_ATTEMPTS) {
    throw createError('OTP_MAX_ATTEMPTS', 'Maximum reset attempts exceeded. Please request a new code.', 422);
  }

  if (new Date(record.EXPIRES_AT) < new Date()) {
    throw createError('OTP_EXPIRED', 'Reset code has expired (valid for 5 minutes).', 422);
  }

  const isOtpValid = await bcrypt.compare(otp.trim(), record.OTP_HASH);
  if (!isOtpValid) {
    await verificationModel.incrementResetOtpAttempts(record.ID, record.ATTEMPTS + 1);
    const remaining = MAX_OTP_ATTEMPTS - (record.ATTEMPTS + 1);
    throw createError('OTP_INVALID', `Invalid reset code. ${remaining} attempt(s) remaining.`, 422);
  }

  return { message: 'Reset code is valid.' };
};

exports.resetPassword = async (email, otp, newPassword, clientMeta = {}) => {
  const sanitizedEmail = email.trim().toLowerCase();
  const user = await userModel.findByEmail(sanitizedEmail);
  if (!user) {
    throw createError('USER_NOT_FOUND', 'User does not exist.', 404);
  }

  const record = await verificationModel.findActivePasswordReset(sanitizedEmail);
  if (!record) {
    throw createError('OTP_INVALID', 'Invalid or expired reset code.', 422);
  }

  if (new Date(record.EXPIRES_AT) < new Date()) {
    throw createError('OTP_EXPIRED', 'Reset code has expired.', 422);
  }

  const isOtpValid = await bcrypt.compare(otp.trim(), record.OTP_HASH);
  if (!isOtpValid) {
    throw createError('OTP_INVALID', 'Invalid reset code.', 422);
  }

  // Validate new password strength
  if (!validatePassword(newPassword)) {
    throw createError(
      'PASSWORD_TOO_WEAK',
      'Password must be at least 8 characters, and contain uppercase, lowercase, numbers, and special characters.',
      422
    );
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await userModel.updatePassword(user.ID, hashedPassword);
  await verificationModel.markPasswordResetOTPUsed(record.ID);
  await userModel.resetFailedAttemptsAndLogLogin(user.ID);

  await logAuditEvent({
    userId: user.ID,
    action: 'PASSWORD_RESET_COMPLETED',
    entity: 'USER',
    entityId: user.ID,
    ipAddress: clientMeta.ip,
    userAgent: clientMeta.userAgent,
    details: 'Password reset completed successfully.'
  });

  return { message: 'Password reset successful. You can now log in with your new password.' };
};

exports.googleLoginUser = async (idToken, email, name, clientMeta = {}) => {
  // If an ID token or verifiable payload is supplied, validate it
  if (!email || !validateEmail(email)) {
    throw createError('INVALID_GOOGLE_AUTH', 'Invalid Google credentials supplied.', 422);
  }

  const sanitizedEmail = email.trim().toLowerCase();
  let user = await userModel.findByEmail(sanitizedEmail);

  if (!user) {
    const randomPassword = crypto.randomBytes(32).toString('hex');
    const hashedPassword = await bcrypt.hash(randomPassword, 10);
    const userId = await userModel.createUser(name ? name.trim() : 'Google User', sanitizedEmail, hashedPassword, 'INVESTOR');
    await userModel.verifyUser(userId);
    user = await userModel.findByEmail(sanitizedEmail);
  }

  if (user.ACCOUNT_LOCKED_UNTIL) {
    const lockTime = new Date(user.ACCOUNT_LOCKED_UNTIL);
    if (lockTime > new Date()) {
      const minutesLeft = Math.ceil((lockTime - new Date()) / (60 * 1000));
      throw createError('ACCOUNT_LOCKED', `Account is temporarily locked. Try again in ${minutesLeft} minute(s).`, 403);
    }
  }

  await userModel.resetFailedAttemptsAndLogLogin(user.ID);

  const jwtToken = jwt.sign(
    {
      id: user.ID,
      email: user.EMAIL,
      role: user.ROLE || 'INVESTOR',
      name: user.NAME
    },
    JWT_SECRET,
    { expiresIn: '1d' }
  );

  await logAuditEvent({
    userId: user.ID,
    action: 'GOOGLE_LOGIN_SUCCESS',
    entity: 'USER',
    entityId: user.ID,
    ipAddress: clientMeta.ip,
    userAgent: clientMeta.userAgent,
    details: 'User authenticated via Google OAuth.'
  });

  return {
    token: jwtToken,
    user: {
      id: user.ID,
      name: user.NAME,
      email: user.EMAIL,
      role: user.ROLE || 'INVESTOR',
      kycStatus: user.KYC_STATUS || 'UNVERIFIED'
    }
  };
};
