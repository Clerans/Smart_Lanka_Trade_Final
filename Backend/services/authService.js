const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const userModel = require('../models/userModel');
const verificationModel = require('../models/verificationModel');
const { sendVerificationEmail, sendVerificationOTPEmail, sendPasswordResetOTPEmail } = require('./emailService');
const { validatePassword } = require('../utils/validator');


const createError = (code, message, status = 400) => {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
};

exports.registerUser = async (name, email, password) => {
  // Check if email already exists
  const existingUser = await userModel.findByEmail(email);
  if (existingUser) {
    throw createError('EMAIL_ALREADY_EXISTS', 'Email address is already registered.', 409);
  }

  // Validate password strength
  if (!validatePassword(password)) {
    throw createError('PASSWORD_TOO_WEAK', 'Password is too weak. Must be at least 8 characters, and contain uppercase, lowercase, numbers, and special characters.', 422);
  }

  // Generate random token for legacy / email link support if needed
  const token = crypto.randomBytes(32).toString('hex');
  const hashedPassword = await bcrypt.hash(password, 10);
  const userId = await userModel.createUser(name, email, hashedPassword, token);

  // Generate 6-digit OTP for email verification
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry
  await verificationModel.createEmailVerificationOTP(userId, otp, expiresAt);

  if (process.env.NODE_ENV !== 'production') {
    console.log(`\n=================================================`);
    console.log(`📧 Email Verification OTP for ${email}: ${otp}`);
    console.log(`=================================================\n`);
  }

  // Send verification OTP email (async)
  sendVerificationOTPEmail(email, otp);

  return { userId };
};

exports.loginUser = async (email, password) => {
  const user = await userModel.findByEmail(email);
  if (!user) {
    throw createError('USER_NOT_FOUND', 'User with this email does not exist.', 404);
  }

  // Check if account is locked
  if (user.ACCOUNT_LOCKED_UNTIL) {
    const lockTime = new Date(user.ACCOUNT_LOCKED_UNTIL);
    if (lockTime > new Date()) {
      const minutesLeft = Math.ceil((lockTime - new Date()) / (60 * 1000));
      throw createError(
        'ACCOUNT_LOCKED',
        `Account is temporarily locked due to too many failed login attempts. Try again in ${minutesLeft} minute(s).`,
        403
      );
    }
  }

  // Compare passwords
  const isMatch = await bcrypt.compare(password, user.PASSWORD);
  if (!isMatch) {
    const newAttempts = user.FAILED_ATTEMPTS + 1;
    if (newAttempts >= 5) {
      const lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes lockout
      await userModel.lockAccount(user.ID, lockUntil);
      throw createError(
        'ACCOUNT_LOCKED',
        'Account locked due to 5 consecutive failed login attempts. Try again in 15 minutes.',
        403
      );
    } else {
      await userModel.updateFailedAttempts(user.ID, newAttempts);
      const remaining = 5 - newAttempts;
      throw createError(
        'INVALID_PASSWORD',
        `Incorrect password. ${remaining} attempt(s) remaining before account lockout.`,
        401
      );
    }
  }

  // Check if email is verified
  if (user.IS_VERIFIED === 0) {
    throw createError('EMAIL_NOT_VERIFIED', 'Please verify your email before logging in.', 403);
  }

  // Reset attempts and log login timestamp
  await userModel.resetFailedAttemptsAndLogLogin(user.ID);

  const userRole = user.ROLE || 'USER';
  const token = jwt.sign(
    { id: user.ID, email: user.EMAIL, role: userRole },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );

  return {
    token,
    user: {
      id: user.ID,
      name: user.NAME,
      email: user.EMAIL,
      role: userRole,
      phoneNumber: user.PHONE_NUMBER || null,
      profileImage: user.PROFILE_IMAGE || null
    }
  };
};

exports.sendVerificationOTP = async (email) => {
  const user = await userModel.findByEmail(email);
  if (!user) {
    throw createError('USER_NOT_FOUND', 'User with this email does not exist.', 404);
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
  await verificationModel.createEmailVerificationOTP(user.ID, otp, expiresAt);

  if (process.env.NODE_ENV !== 'production') {
    console.log(`\n=================================================`);
    console.log(`📧 Sent Email Verification OTP to ${email}: ${otp}`);
    console.log(`=================================================\n`);
  }

  sendVerificationOTPEmail(email, otp);

  return { success: true };
};

exports.verifyEmailOTP = async (email, otp) => {
  const user = await userModel.findByEmail(email);
  if (!user) {
    throw createError('USER_NOT_FOUND', 'User with this email does not exist.', 404);
  }

  const record = await verificationModel.findEmailVerificationOTP(email, otp);
  if (!record) {
    throw createError('OTP_INVALID', 'Invalid OTP verification code.', 422);
  }

  if (new Date(record.EXPIRES_AT) < new Date()) {
    throw createError('OTP_EXPIRED', 'OTP verification code has expired (valid for 5 minutes).', 422);
  }

  // Update user verified flag and verification record
  await userModel.verifyUser(user.ID);
  await verificationModel.markEmailVerificationOTPVerified(record.ID);

  return { message: 'Email verified successfully! You can now log in.' };
};

exports.resendVerificationOTP = async (email) => {
  const user = await userModel.findByEmail(email);
  if (!user) {
    throw createError('USER_NOT_FOUND', 'User with this email does not exist.', 404);
  }

  if (user.IS_VERIFIED === 1) {
    throw createError('EMAIL_ALREADY_VERIFIED', 'This email is already verified.', 409);
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
  await verificationModel.createEmailVerificationOTP(user.ID, otp, expiresAt);

  if (process.env.NODE_ENV !== 'production') {
    console.log(`\n=================================================`);
    console.log(`📧 Resent Email Verification OTP to ${email}: ${otp}`);
    console.log(`=================================================\n`);
  }

  sendVerificationOTPEmail(email, otp);

  return { success: true };
};

exports.forgotPassword = async (email) => {
  const user = await userModel.findByEmail(email);
  if (!user) {
    throw createError('USER_NOT_FOUND', 'User with this email does not exist.', 404);
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
  await verificationModel.createPasswordResetOTP(user.ID, otp, expiresAt);

  if (process.env.NODE_ENV !== 'production') {
    console.log(`\n=================================================`);
    console.log(`🔑 Password Reset OTP for ${email}: ${otp}`);
    console.log(`=================================================\n`);
  }

  sendPasswordResetOTPEmail(email, otp);

  return { success: true };
};

exports.verifyResetOTP = async (email, otp) => {
  const user = await userModel.findByEmail(email);
  if (!user) {
    throw createError('USER_NOT_FOUND', 'User with this email does not exist.', 404);
  }

  const record = await verificationModel.findPasswordResetOTP(email, otp);
  if (!record) {
    throw createError('OTP_INVALID', 'Invalid OTP code.', 422);
  }

  if (new Date(record.EXPIRES_AT) < new Date()) {
    throw createError('OTP_EXPIRED', 'OTP has expired (valid for 5 minutes).', 422);
  }

  return { message: 'OTP is valid.' };
};

exports.resetPassword = async (email, otp, newPassword) => {
  const user = await userModel.findByEmail(email);
  if (!user) {
    throw createError('USER_NOT_FOUND', 'User with this email does not exist.', 404);
  }

  const record = await verificationModel.findPasswordResetOTP(email, otp);
  if (!record) {
    throw createError('OTP_INVALID', 'Invalid or expired OTP code.', 422);
  }

  if (new Date(record.EXPIRES_AT) < new Date()) {
    throw createError('OTP_EXPIRED', 'OTP code has expired (valid for 5 minutes).', 422);
  }

  // Validate password strength
  if (!validatePassword(newPassword)) {
    throw createError('PASSWORD_TOO_WEAK', 'Password is too weak. Must be at least 8 characters, and contain uppercase, lowercase, numbers, and special characters.', 422);
  }

  // Hash new password and update user
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await userModel.updatePassword(user.ID, hashedPassword);
  await verificationModel.markPasswordResetOTPUsed(record.ID);

  // Reset failed login attempts and lockout when password is successfully reset
  await userModel.resetFailedAttemptsAndLogLogin(user.ID);

  return { message: 'Password reset successful. You can now log in.' };
};

exports.verifyEmailToken = async (token) => {
  const user = await userModel.findByToken(token);
  if (!user) {
    throw createError('INVALID_TOKEN', 'Invalid or expired verification token.', 400);
  }

  await userModel.verifyUser(user.ID);
  return { message: 'Email verified successfully! You can now log in.' };
};

exports.googleLoginUser = async (idToken) => {
  if (!idToken || typeof idToken !== 'string') {
    throw createError('MISSING_TOKEN', 'Google ID token is required.', 400);
  }

  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  if (!googleClientId) {
    throw createError('SERVER_CONFIG_ERROR', 'Google OAuth client ID is not configured on the server.', 500);
  }

  let payload;
  try {
    const client = new OAuth2Client(googleClientId);
    const ticket = await client.verifyIdToken({
      idToken,
      audience: googleClientId,
    });
    payload = ticket.getPayload();
  } catch (verifyErr) {
    throw createError('INVALID_GOOGLE_TOKEN', 'Google authentication failed: Invalid or expired ID token.', 401);
  }

  if (!payload || !payload.email) {
    throw createError('INVALID_GOOGLE_TOKEN', 'Google token payload is missing email.', 401);
  }

  const email = payload.email.toLowerCase().trim();
  const name = payload.name || payload.given_name || email.split('@')[0];

  let user = await userModel.findByEmail(email);
  if (!user) {
    // Create a new user with random password, automatically verified
    const randomPassword = crypto.randomBytes(16).toString('hex');
    const hashedPassword = await bcrypt.hash(randomPassword, 10);
    const token = crypto.randomBytes(32).toString('hex');
    const userId = await userModel.createUser(name, email, hashedPassword, token);
    await userModel.verifyUser(userId);
    user = await userModel.findByEmail(email);
  }

  // Ensure not locked
  if (user.ACCOUNT_LOCKED_UNTIL) {
    const lockTime = new Date(user.ACCOUNT_LOCKED_UNTIL);
    if (lockTime > new Date()) {
      const minutesLeft = Math.ceil((lockTime - new Date()) / (60 * 1000));
      throw createError(
        'ACCOUNT_LOCKED',
        `Account is temporarily locked. Try again in ${minutesLeft} minute(s).`,
        403
      );
    }
  }

  // Reset attempts and log login timestamp
  await userModel.resetFailedAttemptsAndLogLogin(user.ID);

  const jwtToken = jwt.sign(
    { id: user.ID, email: user.EMAIL },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );

  return {
    token: jwtToken,
    user: {
      id: user.ID,
      name: user.NAME,
      email: user.EMAIL,
      phoneNumber: user.PHONE_NUMBER || null,
      profileImage: user.PROFILE_IMAGE || null
    }
  };
};

exports.getUserProfile = async (userId) => {
  const user = await userModel.findById(userId);
  if (!user) {
    throw createError('USER_NOT_FOUND', 'User not found.', 404);
  }

  return {
    id: user.ID,
    name: user.NAME,
    email: user.EMAIL,
    phoneNumber: user.PHONE_NUMBER || null,
    profileImage: user.PROFILE_IMAGE || null,
    kycStatus: user.KYC_STATUS || 'NOT_SUBMITTED',
    isVerified: user.IS_VERIFIED === 1,
    role: user.ROLE || 'USER',
    createdAt: user.CREATED_AT
  };
};

exports.updateUserProfile = async (userId, { name, email, phoneNumber, profileImage }) => {
  const currentUser = await userModel.findById(userId);
  if (!currentUser) {
    throw createError('USER_NOT_FOUND', 'User not found.', 404);
  }

  const updatedName = name !== undefined && name !== null ? name.trim() : currentUser.NAME;
  const updatedEmail = email !== undefined && email !== null ? email.trim() : currentUser.EMAIL;

  if (!updatedName) {
    throw createError('INVALID_NAME', 'Name cannot be empty.', 422);
  }

  if (!updatedEmail) {
    throw createError('INVALID_EMAIL', 'Email cannot be empty.', 422);
  }

  // If email is changing, ensure it is unique
  if (updatedEmail.toLowerCase() !== currentUser.EMAIL.toLowerCase()) {
    const existing = await userModel.findByEmail(updatedEmail);
    if (existing && existing.ID !== userId) {
      throw createError('EMAIL_ALREADY_EXISTS', 'This email address is already in use by another account.', 409);
    }
  }

  const updatedUser = await userModel.updateProfile(userId, {
    name: updatedName,
    email: updatedEmail,
    phoneNumber: phoneNumber !== undefined ? (phoneNumber ? phoneNumber.trim() : null) : currentUser.PHONE_NUMBER,
    profileImage: profileImage !== undefined ? profileImage : currentUser.PROFILE_IMAGE
  });

  return {
    id: updatedUser.ID,
    name: updatedUser.NAME,
    email: updatedUser.EMAIL,
    phoneNumber: updatedUser.PHONE_NUMBER || null,
    profileImage: updatedUser.PROFILE_IMAGE || null,
    kycStatus: updatedUser.KYC_STATUS || 'NOT_SUBMITTED',
    isVerified: updatedUser.IS_VERIFIED === 1,
    role: updatedUser.ROLE || 'USER'
  };
};

exports.changePasswordUser = async (userId, currentPassword, newPassword) => {
  const user = await userModel.findById(userId);
  if (!user) {
    throw createError('USER_NOT_FOUND', 'User not found.', 404);
  }

  const isMatch = await bcrypt.compare(currentPassword, user.PASSWORD);
  if (!isMatch) {
    throw createError('INVALID_CREDENTIALS', 'Incorrect current password.', 400);
  }

  if (!validatePassword(newPassword)) {
    throw createError('PASSWORD_TOO_WEAK', 'New password must be at least 8 characters, containing uppercase, lowercase, numbers, and special characters.', 422);
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await userModel.updatePassword(userId, hashedPassword);
  return { message: 'Password changed successfully.' };
};
