const oracledb = require('oracledb');
const bcrypt = require('bcryptjs');

// Create a new password reset OTP (hashed)
exports.createPasswordResetOTP = async (userId, otpHashed, expiresAt) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    // Invalidate previous active reset OTPs for this user
    await connection.execute(
      `UPDATE SL_PASSWORD_RESET SET USED = 1 WHERE USER_ID = :userId AND USED = 0`,
      { userId }
    );
    
    await connection.execute(
      `INSERT INTO SL_PASSWORD_RESET (USER_ID, OTP_HASH, EXPIRES_AT, ATTEMPTS, USED)
       VALUES (:userId, :otpHashed, :expiresAt, 0, 0)`,
      { userId, otpHashed, expiresAt }
    );
    await connection.commit();
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) {}
    }
  }
};

// Find latest active password reset record for an email
exports.findActivePasswordReset = async (email) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    const result = await connection.execute(
      `SELECT r.ID, r.USER_ID, r.OTP_HASH, r.EXPIRES_AT, r.ATTEMPTS, r.USED 
       FROM SL_PASSWORD_RESET r
       JOIN SL_USERS u ON r.USER_ID = u.ID
       WHERE LOWER(u.EMAIL) = LOWER(:email) AND r.USED = 0
       ORDER BY r.EXPIRES_AT DESC
       FETCH NEXT 1 ROWS ONLY`,
      { email },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return result.rows[0] || null;
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) {}
    }
  }
};

exports.incrementResetOtpAttempts = async (resetId, attempts) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    await connection.execute(
      `UPDATE SL_PASSWORD_RESET SET ATTEMPTS = :attempts WHERE ID = :resetId`,
      { attempts, resetId },
      { autoCommit: true }
    );
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) {}
    }
  }
};

exports.markPasswordResetOTPUsed = async (resetId) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    await connection.execute(
      `UPDATE SL_PASSWORD_RESET SET USED = 1 WHERE ID = :resetId`,
      { resetId },
      { autoCommit: true }
    );
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) {}
    }
  }
};

// Create a new email verification OTP (hashed)
exports.createEmailVerificationOTP = async (userId, otpHashed, expiresAt) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    // Invalidate previous unverified OTPs
    await connection.execute(
      `UPDATE SL_EMAIL_VERIFICATION SET VERIFIED = 1 WHERE USER_ID = :userId AND VERIFIED = 0`,
      { userId }
    );

    await connection.execute(
      `INSERT INTO SL_EMAIL_VERIFICATION (USER_ID, OTP_HASH, EXPIRES_AT, ATTEMPTS, VERIFIED)
       VALUES (:userId, :otpHashed, :expiresAt, 0, 0)`,
      { userId, otpHashed, expiresAt }
    );
    await connection.commit();
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) {}
    }
  }
};

// Find latest active email verification record for an email
exports.findActiveEmailVerification = async (email) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    const result = await connection.execute(
      `SELECT v.ID, v.USER_ID, v.OTP_HASH, v.EXPIRES_AT, v.ATTEMPTS, v.VERIFIED 
       FROM SL_EMAIL_VERIFICATION v
       JOIN SL_USERS u ON v.USER_ID = u.ID
       WHERE LOWER(u.EMAIL) = LOWER(:email) AND v.VERIFIED = 0
       ORDER BY v.EXPIRES_AT DESC
       FETCH NEXT 1 ROWS ONLY`,
      { email },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return result.rows[0] || null;
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) {}
    }
  }
};

exports.incrementEmailOtpAttempts = async (verificationId, attempts) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    await connection.execute(
      `UPDATE SL_EMAIL_VERIFICATION SET ATTEMPTS = :attempts WHERE ID = :verificationId`,
      { attempts, verificationId },
      { autoCommit: true }
    );
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) {}
    }
  }
};

exports.markEmailVerificationOTPVerified = async (verificationId) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    await connection.execute(
      `UPDATE SL_EMAIL_VERIFICATION SET VERIFIED = 1 WHERE ID = :verificationId`,
      { verificationId },
      { autoCommit: true }
    );
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) {}
    }
  }
};
