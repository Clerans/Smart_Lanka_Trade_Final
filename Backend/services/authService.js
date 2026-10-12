const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const axios = require('axios');
const { OAuth2Client } = require('google-auth-library');
const userModel = require('../models/userModel');
const otpModel = require('../models/otpModel');
const verificationModel = require('../models/verificationModel');
const { sendVerificationEmail, sendVerificationOTPEmail, sendPasswordResetOTPEmail } = require('./emailService');
const { validatePassword, validateEmail } = require('../utils/validator');

const createError = (code, message, status = 400) => {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
};

/**
 * Send 6-digit OTP to user's email with HMAC-SHA256 hashing, 10-minute expiry, and 60-second cooldown
 */
exports.sendOtp = async (email) => {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !validateEmail(cleanEmail)) {
    throw createError('INVALID_EMAIL', 'Please provide a valid email address.', 422);
  }

  // 1. Check 60-second cooldown per email
  const existingOtp = await otpModel.findOtpByEmail(cleanEmail);
  if (existingOtp && existingOtp.CREATED_AT) {
    const elapsedMs = Date.now() - new Date(existingOtp.CREATED_AT).getTime();
    if (elapsedMs < 60 * 1000) {
      const waitSec = Math.ceil((60 * 1000 - elapsedMs) / 1000);
      throw createError(
        'COOLDOWN_ACTIVE',
        `Please wait ${waitSec} second(s) before requesting another verification code.`,
        429
      );
    }
  }

  // 2. Generate secure 6-digit numeric OTP
  const otpCode = crypto.randomInt(100000, 1000000).toString();
  // 3. Expire after 10 minutes
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  // 4. Store only HMAC-SHA256 hash (never plain code), replacing previous OTP rows
  await otpModel.createOrReplaceOtp(cleanEmail, otpCode, expiresAt);

  // 5. Send branded verification email via Brevo transactional HTTP API
  try {
    await sendVerificationOTPEmail(cleanEmail, otpCode);
  } catch (emailErr) {
    console.error('Brevo email dispatch failed during sendOtp:', emailErr.message);
    throw createError(
      'EMAIL_SEND_FAILED',
      'Unable to deliver verification code email at this time. Please try again later.',
      503
    );
  }

  return {
    success: true,
    message: 'Verification code sent successfully.'
  };
};

// Aliases for compatibility
exports.sendVerificationOTP = exports.sendOtp;
exports.resendVerificationOTP = exports.sendOtp;

/**
 * Verify 6-digit OTP code using crypto.timingSafeEqual against HMAC-SHA256 hash
 */
exports.verifyOtp = async (email, otp) => {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanOtp = (otp || '').toString().trim();

  if (!cleanEmail || !validateEmail(cleanEmail)) {
    throw createError('INVALID_EMAIL', 'Please provide a valid email address.', 422);
  }

  if (!cleanOtp || cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
    throw createError('INVALID_OTP_FORMAT', 'Verification code must be exactly 6 digits.', 422);
  }

  const record = await otpModel.findOtpByEmail(cleanEmail);
  if (!record) {
    throw createError('OTP_INVALID', 'Invalid or expired verification code.', 422);
  }

  // Check attempt limit (max 5 attempts)
  if (record.ATTEMPTS >= 5) {
    await otpModel.deleteOtpByEmail(cleanEmail);
    throw createError(
      'OTP_MAX_ATTEMPTS',
      'Maximum verification attempts exceeded. Please request a new verification code.',
      429
    );
  }

  // Check expiration (10 minutes)
  if (new Date(record.EXPIRES_AT) < new Date()) {
    await otpModel.deleteOtpByEmail(cleanEmail);
    throw createError(
      'OTP_EXPIRED',
      'Your verification code has expired. Please request a new code.',
      422
    );
  }

  // Timing-safe HMAC-SHA256 comparison
  const isValid = otpModel.verifyOtpHash(cleanOtp, record.OTP_HASH);

  if (!isValid) {
    await otpModel.incrementAttempts(record.ID);
    const remainingAttempts = Math.max(0, 5 - (record.ATTEMPTS + 1));
    if (remainingAttempts === 0) {
      await otpModel.deleteOtpByEmail(cleanEmail);
      throw createError(
        'OTP_MAX_ATTEMPTS',
        'Maximum verification attempts exceeded. Please request a new verification code.',
        429
      );
    }
    throw createError(
      'OTP_INVALID',
      `Invalid verification code. ${remainingAttempts} attempt(s) remaining.`,
      422
    );
  }

  // 1. Success: Delete OTP row from EMAIL_OTPS
  await otpModel.deleteOtpByEmail(cleanEmail);

  // 2. Mark user's email as verified in Oracle (EMAIL_VERIFIED = 1, IS_VERIFIED = 1)
  await otpModel.markUserEmailVerified(cleanEmail);

  return {
    success: true,
    message: 'Email verified successfully!'
  };
};

// Aliases for compatibility
exports.verifyEmailOTP = exports.verifyOtp;

/**
 * Register User: creates unverified user and automatically triggers sendOtp
 */
exports.registerUser = async (name, email, password) => {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanName = (name || '').trim();

  // Check if email already exists
  const existingUser = await userModel.findByEmail(cleanEmail);
  if (existingUser) {
    throw createError('EMAIL_ALREADY_EXISTS', 'Email address is already registered.', 409);
  }

  // Validate password strength
  if (!validatePassword(password)) {
    throw createError('PASSWORD_TOO_WEAK', 'Password is too weak. Must be at least 8 characters, and contain uppercase, lowercase, numbers, and special characters.', 422);
  }

  const token = crypto.randomBytes(32).toString('hex');
  const hashedPassword = await bcrypt.hash(password, 10);
  
  // Creates user with IS_VERIFIED = 0 and EMAIL_VERIFIED = 0
  const userId = await userModel.createUser(cleanName, cleanEmail, hashedPassword, token);

  // Trigger sendOtp (HMAC-SHA256 hashed code sent via Brevo)
  let otpSent = false;
  let otpError = null;
  try {
    await exports.sendOtp(cleanEmail);
    otpSent = true;
  } catch (otpErr) {
    console.warn(`⚠️ Initial OTP dispatch note for ${cleanEmail}:`, otpErr.message);
    otpError = otpErr.message;
  }

  return { userId, email: cleanEmail, otpSent, otpError };
};

exports.loginUser = async (email, password) => {
  const cleanEmail = (email || '').trim().toLowerCase();
  const user = await userModel.findByEmail(cleanEmail);
  if (!user) {
    throw createError('INVALID_CREDENTIALS', 'Invalid email or password.', 401);
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
        'INVALID_CREDENTIALS',
        `Incorrect password. ${remaining} attempt(s) remaining before account lockout.`,
        401
      );
    }
  }

  // Check if email is verified
  if (user.IS_VERIFIED === 0 || user.EMAIL_VERIFIED === 0) {
    throw createError('EMAIL_NOT_VERIFIED', 'Please verify your email address before logging in.', 403);
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
      accountUid: user.ACCOUNT_UID || null,
      name: user.NAME,
      email: user.EMAIL,
      role: userRole,
      phoneNumber: user.PHONE_NUMBER || null,
      profileImage: user.PROFILE_IMAGE || null
    }
  };
};


exports.forgotPassword = async (email) => {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !validateEmail(cleanEmail)) {
    throw createError('INVALID_EMAIL', 'Please provide a valid email address.', 422);
  }

  const user = await userModel.findByEmail(cleanEmail);
  if (!user) {
    // Non-revealing response to prevent email enumeration
    return {
      success: true,
      message: 'If an account exists with this email address, a verification code has been sent.'
    };
  }

  // Enforce 60-second cooldown per user
  const latestAttempt = await verificationModel.getLatestPasswordResetOTP(user.ID);
  if (latestAttempt && latestAttempt.CREATED_AT) {
    const elapsedMs = Date.now() - new Date(latestAttempt.CREATED_AT).getTime();
    if (elapsedMs < 60 * 1000) {
      const waitSec = Math.ceil((60 * 1000 - elapsedMs) / 1000);
      throw createError(
        'COOLDOWN_ACTIVE',
        `Please wait ${waitSec} second(s) before requesting another verification code.`,
        429
      );
    }
  }

  const otp = crypto.randomInt(100000, 1000000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  await verificationModel.createPasswordResetOTP(user.ID, otp, expiresAt);

  // Send branded password reset OTP email via Brevo
  try {
    await sendPasswordResetOTPEmail(cleanEmail, otp);
  } catch (emailErr) {
    console.error('Brevo email dispatch failed during forgotPassword:', emailErr.message);
    throw createError(
      'EMAIL_SEND_FAILED',
      'Unable to deliver password reset email at this time. Please try again later.',
      503
    );
  }

  return {
    success: true,
    message: 'Verification code sent successfully.'
  };
};

exports.verifyResetOTP = async (email, otp) => {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanOtp = (otp || '').toString().trim();

  if (!cleanEmail || !validateEmail(cleanEmail)) {
    throw createError('INVALID_EMAIL', 'Please provide a valid email address.', 422);
  }

  if (!cleanOtp || cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
    throw createError('INVALID_OTP_FORMAT', 'Verification code must be exactly 6 digits.', 422);
  }

  const user = await userModel.findByEmail(cleanEmail);
  if (!user) {
    throw createError('OTP_INVALID', 'Invalid or expired verification code.', 422);
  }

  const activeRecord = await verificationModel.findActivePasswordResetByUser(cleanEmail);
  if (!activeRecord) {
    throw createError('OTP_INVALID', 'Invalid or expired verification code.', 422);
  }

  // Check attempt limit (max 5 attempts)
  if (activeRecord.ATTEMPTS >= 5) {
    await verificationModel.invalidatePasswordResetOTP(activeRecord.ID);
    throw createError(
      'OTP_MAX_ATTEMPTS',
      'Maximum verification attempts exceeded. Please request a new verification code.',
      429
    );
  }

  // Check expiration (10 minutes)
  if (new Date(activeRecord.EXPIRES_AT) < new Date()) {
    await verificationModel.invalidatePasswordResetOTP(activeRecord.ID);
    throw createError(
      'OTP_EXPIRED',
      'Your verification code has expired. Please request a new code.',
      422
    );
  }

  // Timing-safe SHA-256 verification
  const candidateHash = crypto.createHash('sha256').update(cleanOtp).digest('hex');
  const storedHash = activeRecord.OTP;
  let isMatch = false;

  try {
    const candidateBuf = Buffer.from(candidateHash, 'hex');
    const storedBuf = Buffer.from(storedHash, 'hex');
    if (candidateBuf.length === storedBuf.length) {
      isMatch = crypto.timingSafeEqual(candidateBuf, storedBuf);
    }
  } catch {
    isMatch = (candidateHash === storedHash || cleanOtp === storedHash);
  }

  if (!isMatch) {
    await verificationModel.incrementPasswordResetAttempts(activeRecord.ID);
    const remainingAttempts = Math.max(0, 5 - (activeRecord.ATTEMPTS + 1));
    if (remainingAttempts === 0) {
      await verificationModel.invalidatePasswordResetOTP(activeRecord.ID);
      throw createError(
        'OTP_MAX_ATTEMPTS',
        'Maximum verification attempts exceeded. Please request a new verification code.',
        429
      );
    }
    throw createError(
      'OTP_INVALID',
      `Invalid verification code. ${remainingAttempts} attempt(s) remaining.`,
      422
    );
  }

  // Issue server-authorized short-lived resetToken (10m)
  const resetToken = jwt.sign(
    {
      userId: user.ID,
      email: user.EMAIL,
      purpose: 'PASSWORD_RESET',
      resetId: activeRecord.ID
    },
    process.env.JWT_SECRET,
    { expiresIn: '10m' }
  );

  return {
    success: true,
    message: 'Verification code verified successfully.',
    resetToken
  };
};

exports.resetPassword = async (email, otp, newPassword, resetToken) => {
  const cleanEmail = (email || '').trim().toLowerCase();

  // Validate password strength first
  if (!validatePassword(newPassword)) {
    throw createError(
      'PASSWORD_TOO_WEAK',
      'Password is too weak. Must be at least 8 characters, and contain uppercase, lowercase, numbers, and special characters.',
      422
    );
  }

  const user = await userModel.findByEmail(cleanEmail);
  if (!user) {
    throw createError('USER_NOT_FOUND', 'User account not found.', 404);
  }

  let resetRecordId = null;

  // Require server-authorized resetToken issued upon successful cryptographic OTP verification
  if (!resetToken || typeof resetToken !== 'string') {
    throw createError(
      'RESET_TOKEN_REQUIRED',
      'A server-authorized password reset session token is required. Please verify your verification code first.',
      403
    );
  }

  try {
    const decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    if (decoded.purpose !== 'PASSWORD_RESET' || decoded.email.toLowerCase() !== cleanEmail) {
      throw createError('INVALID_RESET_TOKEN', 'Invalid reset token authorization.', 403);
    }
    const record = await verificationModel.findPasswordResetOTPById(decoded.resetId);
    if (!record || record.USED !== 0 || new Date(record.EXPIRES_AT) < new Date()) {
      throw createError('RESET_TOKEN_EXPIRED', 'Password reset session has expired or was already used.', 403);
    }
    resetRecordId = record.ID;
  } catch (tokenErr) {
    if (tokenErr.code) throw tokenErr;
    throw createError('INVALID_RESET_TOKEN', 'Invalid or expired password reset session.', 403);
  }

  // Hash new password with salted bcrypt
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Atomically consume reset authorization and update password in a single Oracle transaction
  // Prevents replay attacks and concurrent execution races
  const consumptionResult = await verificationModel.consumePasswordResetAndSetPassword(
    resetRecordId,
    user.ID,
    hashedPassword
  );

  if (!consumptionResult || !consumptionResult.success) {
    throw createError(
      'RESET_TOKEN_ALREADY_USED',
      'This password reset authorization has already been consumed or has expired. Please request a new verification code.',
      403
    );
  }

  return {
    success: true,
    message: 'Password reset successful! You can now log in.'
  };
};

exports.verifyEmailToken = async (token) => {
  const user = await userModel.findByToken(token);
  if (!user) {
    throw createError('INVALID_TOKEN', 'Invalid or expired verification token.', 400);
  }

  await userModel.verifyUser(user.ID);
  return { message: 'Email verified successfully! You can now log in.' };
};

exports.googleLoginUser = async (authInput) => {
  let idToken = null;

  // Handle both string idToken and object { idToken, code, codeVerifier, redirectUri }
  if (typeof authInput === 'string') {
    idToken = authInput.trim();
  } else if (authInput && typeof authInput === 'object') {
    if (authInput.idToken && typeof authInput.idToken === 'string') {
      idToken = authInput.idToken.trim();
    } else if (authInput.code && typeof authInput.code === 'string') {
      // Exchange Authorization Code with Google Token Endpoint using PKCE
      const googleWebClientId = process.env.GOOGLE_CLIENT_ID;
      const googleAndroidClientId = process.env.GOOGLE_ANDROID_CLIENT_ID || googleWebClientId;
      const clientId = authInput.clientId || googleWebClientId || googleAndroidClientId;

      const androidSchemeId = (googleAndroidClientId || '').replace('.apps.googleusercontent.com', '');
      const defaultAndroidRedirect = `com.googleusercontent.apps.${androidSchemeId}:/oauth2redirect`;

      const tokenParams = {
        code: authInput.code.trim(),
        client_id: clientId,
        grant_type: 'authorization_code',
        redirect_uri: authInput.redirectUri || defaultAndroidRedirect
      };

      if (authInput.codeVerifier) {
        tokenParams.code_verifier = authInput.codeVerifier;
      }
      if (process.env.GOOGLE_CLIENT_SECRET) {
        tokenParams.client_secret = process.env.GOOGLE_CLIENT_SECRET;
      }

      if (process.env.NODE_ENV !== 'production') {
        console.log('[OAuth Diagnostic] Stage: CODE_EXCHANGE initiating with Google token endpoint');
      }

      try {
        const tokenExchangeRes = await axios.post(
          'https://oauth2.googleapis.com/token',
          new URLSearchParams(tokenParams).toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 10000
          }
        );

        if (tokenExchangeRes.data && tokenExchangeRes.data.id_token) {
          idToken = tokenExchangeRes.data.id_token;
        } else {
          throw createError('GOOGLE_EXCHANGE_FAILED', 'Google token endpoint did not return an ID token.', 401);
        }
      } catch (exchangeErr) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[OAuth Diagnostic] Stage failed: CODE_EXCHANGE', exchangeErr.response?.data?.error || exchangeErr.message);
        }
        throw createError('GOOGLE_EXCHANGE_FAILED', 'Google authorization code exchange failed. Please re-authenticate.', 401);
      }
    }
  }

  if (!idToken || typeof idToken !== 'string') {
    throw createError('MISSING_TOKEN', 'Google ID token or authorization code is required.', 400);
  }

  const googleWebClientId = process.env.GOOGLE_CLIENT_ID;
  if (!googleWebClientId) {
    throw createError('SERVER_CONFIG_ERROR', 'Google OAuth client ID is not configured on the server.', 500);
  }

  const googleAndroidClientId = process.env.GOOGLE_ANDROID_CLIENT_ID || googleWebClientId;
  const acceptedAudiences = Array.from(new Set([
    googleWebClientId,
    googleAndroidClientId,
    '614054153944-tsftd7h3hmj1d43ave18m0cnrfmpf8v1.apps.googleusercontent.com',
    '614054153944-7figt10pghsb14tg764jj3hfnktkqnbt.apps.googleusercontent.com',
    '614054153944-39dgjpn4vskvm4e494ajiip01gaks2cs.apps.googleusercontent.com',
    '614054153944-t0flbk67jqulktrs8uf7gnghds8eeh15.apps.googleusercontent.com',
  ].filter(Boolean)));

  if (process.env.NODE_ENV !== 'production') {
    console.log('[OAuth Diagnostic] Stage: TOKEN_VALIDATION verifying token signature and audience');
  }

  let payload;
  try {
    const client = new OAuth2Client();
    const ticket = await client.verifyIdToken({
      idToken,
      audience: acceptedAudiences,
    });
    payload = ticket.getPayload();
  } catch (verifyErr) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[OAuth Diagnostic] Stage failed: TOKEN_VALIDATION', verifyErr.message);
    }
    throw createError('INVALID_GOOGLE_TOKEN', 'Google authentication failed: Invalid or expired ID token.', 401);
  }

  if (!payload || !payload.email) {
    throw createError('INVALID_GOOGLE_TOKEN', 'Google token payload is missing email.', 401);
  }

  // Validate issuer
  const validIssuers = ['https://accounts.google.com', 'accounts.google.com'];
  if (!validIssuers.includes(payload.iss)) {
    throw createError('INVALID_GOOGLE_TOKEN', 'Google token issuer is invalid.', 401);
  }

  // Validate expiration
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    throw createError('INVALID_GOOGLE_TOKEN', 'Google token has expired.', 401);
  }

  // Verify email is verified by Google
  if (payload.email_verified === false) {
    throw createError('UNVERIFIED_EMAIL', 'Google email is not verified.', 401);
  }

  const email = payload.email.toLowerCase().trim();
  const name = payload.name || payload.given_name || email.split('@')[0];

  let user = await userModel.findByEmail(email);
  if (!user) {
    // Safe user creation with secure random password and auto-verification
    const randomPassword = crypto.randomBytes(16).toString('hex');
    const hashedPassword = await bcrypt.hash(randomPassword, 10);
    const token = crypto.randomBytes(32).toString('hex');
    const userId = await userModel.createUser(name, email, hashedPassword, token);
    await userModel.verifyUser(userId);

    // Initialize user wallet if not existing
    try {
      const oracledb = require('oracledb');
      const conn = await oracledb.getConnection();
      try {
        const walletCheck = await conn.execute(
          `SELECT USER_ID FROM WALLETS WHERE USER_ID = :userId`,
          [userId]
        );
        if (!walletCheck.rows || walletCheck.rows.length === 0) {
          await conn.execute(
            `INSERT INTO WALLETS (USER_ID, BALANCE_LKR) VALUES (:userId, 1000000.00)`,
            { userId }
          );
          await conn.commit();
        }
      } catch (wErr) {
        // Silently skip if WALLETS table not yet ready or handled by trigger
      } finally {
        await conn.close();
      }
    } catch (connErr) {
      // Wallet initialization handled gracefully
    }

    user = await userModel.findByEmail(email);
  } else {
    // Existing user: ensure marked verified if Google email is verified
    if (user.IS_VERIFIED === 0 || user.EMAIL_VERIFIED === 0) {
      await userModel.verifyUser(user.ID);
    }
  }

  // Check account lockout status
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

  // Reset failed attempts and log login timestamp
  await userModel.resetFailedAttemptsAndLogLogin(user.ID);

  const userRole = user.ROLE || 'USER';
  const jwtToken = jwt.sign(
    { id: user.ID, email: user.EMAIL, role: userRole },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );

  return {
    token: jwtToken,
    user: {
      id: user.ID,
      accountUid: user.ACCOUNT_UID || null,
      name: user.NAME,
      email: user.EMAIL,
      role: userRole,
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
    accountUid: user.ACCOUNT_UID || null,
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
    accountUid: updatedUser.ACCOUNT_UID || null,
    name: updatedUser.NAME,
    email: updatedUser.EMAIL,
    phoneNumber: updatedUser.PHONE_NUMBER || null,
    profileImage: updatedUser.PROFILE_IMAGE || null,
    kycStatus: updatedUser.KYC_STATUS || 'NOT_SUBMITTED',
    isVerified: updatedUser.IS_VERIFIED === 1,
    role: updatedUser.ROLE || 'USER'
  };
};

/**
 * Change account password for authenticated user
 */
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
