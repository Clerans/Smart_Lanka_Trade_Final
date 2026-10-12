const oracledb = require('oracledb');
const crypto = require('crypto');

/**
 * Compute SHA-256 hash for secure OTP storage and matching
 */
const hashOtp = (rawOtp) => {
  return crypto.createHash('sha256').update(String(rawOtp).trim()).digest('hex');
};

// Create a new password reset OTP (stores SHA-256 hash, invalidates previous active OTPs)
exports.createPasswordResetOTP = async (userId, otp, expiresAt) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    const otpHash = hashOtp(otp);

    // Invalidate previous active/unused OTPs for this user to prevent replay or concurrent reuse
    await connection.execute(
      `UPDATE SL_PASSWORD_RESET 
       SET USED = -1 
       WHERE USER_ID = :userId AND USED = 0`,
      { userId }
    );

    await connection.execute(
      `INSERT INTO SL_PASSWORD_RESET (USER_ID, OTP, EXPIRES_AT, USED, ATTEMPTS, CREATED_AT)
       VALUES (:userId, :otpHash, :expiresAt, 0, 0, CURRENT_TIMESTAMP)`,
      { userId, otpHash, expiresAt }
    );
    await connection.commit();
  } finally {
    if (connection) await connection.close();
  }
};

// Get the latest password reset attempt for a user to check resend cooldown
exports.getLatestPasswordResetOTP = async (userId) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    const result = await connection.execute(
      `SELECT ID, USER_ID, OTP, EXPIRES_AT, USED, ATTEMPTS, CREATED_AT
       FROM SL_PASSWORD_RESET
       WHERE USER_ID = :userId
       ORDER BY CREATED_AT DESC`,
      { userId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return result.rows[0] || null;
  } finally {
    if (connection) await connection.close();
  }
};

// Check if a password reset OTP is valid
exports.findPasswordResetOTP = async (email, otp) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    const otpHash = hashOtp(otp);
    const rawClean = String(otp).trim();

    // Retrieve OTP matching the email (checks SHA-256 hash, or raw fallback for legacy records)
    const result = await connection.execute(
      `SELECT r.ID, r.USER_ID, r.OTP, r.EXPIRES_AT, r.USED, NVL(r.ATTEMPTS, 0) AS ATTEMPTS, r.CREATED_AT 
       FROM SL_PASSWORD_RESET r
       JOIN SL_USERS u ON r.USER_ID = u.ID
       WHERE u.EMAIL = :email AND (r.OTP = :otpHash OR r.OTP = :rawClean) AND r.USED = 0
       ORDER BY r.EXPIRES_AT DESC`,
      { email, otpHash, rawClean },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return result.rows[0];
  } finally {
    if (connection) await connection.close();
  }
};

// Find latest active reset record for user regardless of OTP code (to track failed attempts)
exports.findActivePasswordResetByUser = async (email) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    const result = await connection.execute(
      `SELECT r.ID, r.USER_ID, r.OTP, r.EXPIRES_AT, r.USED, NVL(r.ATTEMPTS, 0) AS ATTEMPTS, r.CREATED_AT
       FROM SL_PASSWORD_RESET r
       JOIN SL_USERS u ON r.USER_ID = u.ID
       WHERE u.EMAIL = :email AND r.USED = 0
       ORDER BY r.EXPIRES_AT DESC`,
      { email },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return result.rows[0] || null;
  } finally {
    if (connection) await connection.close();
  }
};

// Find password reset record by ID
exports.findPasswordResetOTPById = async (resetId) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    const result = await connection.execute(
      `SELECT ID, USER_ID, OTP, EXPIRES_AT, USED, NVL(ATTEMPTS, 0) AS ATTEMPTS, CREATED_AT
       FROM SL_PASSWORD_RESET
       WHERE ID = :resetId`,
      { resetId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return result.rows[0] || null;
  } finally {
    if (connection) await connection.close();
  }
};

// Increment failed verification attempts
exports.incrementPasswordResetAttempts = async (resetId) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    await connection.execute(
      `UPDATE SL_PASSWORD_RESET 
       SET ATTEMPTS = NVL(ATTEMPTS, 0) + 1 
       WHERE ID = :resetId`,
      { resetId }
    );
    await connection.commit();
  } finally {
    if (connection) await connection.close();
  }
};

// Invalidate reset OTP (e.g., maximum attempts exceeded)
exports.invalidatePasswordResetOTP = async (resetId) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    await connection.execute(
      `UPDATE SL_PASSWORD_RESET SET USED = -1 WHERE ID = :resetId`,
      { resetId }
    );
    await connection.commit();
  } finally {
    if (connection) await connection.close();
  }
};

// Mark a password reset OTP as used
exports.markPasswordResetOTPUsed = async (resetId) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    await connection.execute(
      `UPDATE SL_PASSWORD_RESET SET USED = 1 WHERE ID = :resetId`,
      { resetId }
    );
    await connection.commit();
  } finally {
    if (connection) await connection.close();
  }
};

// Create a new email verification OTP (stores SHA-256 hash)
exports.createEmailVerificationOTP = async (userId, otp, expiresAt) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    const otpHash = hashOtp(otp);

    // Invalidate previous active/unverified OTPs for this user
    await connection.execute(
      `UPDATE SL_EMAIL_VERIFICATION 
       SET VERIFIED = -1 
       WHERE USER_ID = :userId AND VERIFIED = 0`,
      { userId }
    );

    // Insert new single-use OTP hash
    await connection.execute(
      `INSERT INTO SL_EMAIL_VERIFICATION (USER_ID, OTP, EXPIRES_AT, VERIFIED)
       VALUES (:userId, :otpHash, :expiresAt, 0)`,
      { userId, otpHash, expiresAt }
    );
    await connection.commit();
  } finally {
    if (connection) await connection.close();
  }
};

// Find latest email verification OTP
exports.findEmailVerificationOTP = async (email, otp) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    const otpHash = hashOtp(otp);
    const rawClean = String(otp).trim();

    const result = await connection.execute(
      `SELECT v.ID, v.USER_ID, v.OTP, v.EXPIRES_AT, v.VERIFIED 
       FROM SL_EMAIL_VERIFICATION v
       JOIN SL_USERS u ON v.USER_ID = u.ID
       WHERE u.EMAIL = :email AND (v.OTP = :otpHash OR v.OTP = :rawClean) AND v.VERIFIED = 0
       ORDER BY v.EXPIRES_AT DESC`,
      { email, otpHash, rawClean },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return result.rows[0];
  } finally {
    if (connection) await connection.close();
  }
};

// Mark email verification OTP as verified
exports.markEmailVerificationOTPVerified = async (verificationId) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    await connection.execute(
      `UPDATE SL_EMAIL_VERIFICATION SET VERIFIED = 1 WHERE ID = :verificationId`,
      { verificationId }
    );
    await connection.commit();
  } finally {
    if (connection) await connection.close();
  }
};

