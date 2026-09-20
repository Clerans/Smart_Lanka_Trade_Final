const oracledb = require('oracledb');
const crypto = require('crypto');

/**
 * Get configured secret key for HMAC-SHA256 OTP hashing
 */
const getOtpSecret = () => {
  return process.env.OTP_SECRET || 'smartlanka_default_otp_hmac_secret_2026';
};

/**
 * Compute HMAC-SHA256 hash of the plain OTP code
 * @param {string|number} rawOtp 
 * @returns {string} hex-encoded HMAC-SHA256 digest
 */
const hashOtp = (rawOtp) => {
  const secret = getOtpSecret();
  return crypto.createHmac('sha256', secret).update(String(rawOtp).trim()).digest('hex');
};

/**
 * Timing-safe comparison of provided OTP code against stored HMAC-SHA256 hash
 * @param {string|number} rawOtp 
 * @param {string} storedHash 
 * @returns {boolean}
 */
const verifyOtpHash = (rawOtp, storedHash) => {
  if (!rawOtp || !storedHash) return false;
  try {
    const computedHash = hashOtp(rawOtp);
    const computedBuf = Buffer.from(computedHash, 'hex');
    const storedBuf = Buffer.from(storedHash, 'hex');
    if (computedBuf.length !== storedBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(computedBuf, storedBuf);
  } catch (err) {
    return false;
  }
};

/**
 * Find the latest OTP record for an email
 * @param {string} email 
 * @returns {Promise<Object|null>}
 */
const findOtpByEmail = async (email) => {
  const cleanEmail = (email || '').trim().toLowerCase();
  let connection;
  try {
    connection = await oracledb.getConnection();
    const result = await connection.execute(
      `SELECT ID, EMAIL, OTP_HASH, EXPIRES_AT, ATTEMPTS, CREATED_AT 
       FROM EMAIL_OTPS 
       WHERE LOWER(EMAIL) = :email
       ORDER BY CREATED_AT DESC`,
      { email: cleanEmail },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return result.rows[0] || null;
  } finally {
    if (connection) await connection.close();
  }
};

/**
 * Replace any existing OTP records for the email and insert a new OTP hash record
 * @param {string} email 
 * @param {string} rawOtp 
 * @param {Date} expiresAt 
 * @returns {Promise<{id: number, otpHash: string}>}
 */
const createOrReplaceOtp = async (email, rawOtp, expiresAt) => {
  const cleanEmail = (email || '').trim().toLowerCase();
  const otpHash = hashOtp(rawOtp);
  let connection;
  try {
    connection = await oracledb.getConnection();

    // 1. Delete previous OTP rows for this email
    await connection.execute(
      `DELETE FROM EMAIL_OTPS WHERE LOWER(EMAIL) = :email`,
      { email: cleanEmail }
    );

    // 2. Insert new OTP hash
    const result = await connection.execute(
      `INSERT INTO EMAIL_OTPS (EMAIL, OTP_HASH, EXPIRES_AT, ATTEMPTS, CREATED_AT)
       VALUES (:email, :otpHash, :expiresAt, 0, CURRENT_TIMESTAMP)
       RETURNING ID INTO :id`,
      {
        email: cleanEmail,
        otpHash,
        expiresAt,
        id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
      }
    );

    await connection.commit();
    const id = result.outBinds.id[0];
    return { id, otpHash };
  } catch (err) {
    if (connection) await connection.rollback();
    throw err;
  } finally {
    if (connection) await connection.close();
  }
};

/**
 * Increment failed attempts count for an OTP record
 * @param {number} id 
 * @returns {Promise<void>}
 */
const incrementAttempts = async (id) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    await connection.execute(
      `UPDATE EMAIL_OTPS SET ATTEMPTS = ATTEMPTS + 1 WHERE ID = :id`,
      { id }
    );
    await connection.commit();
  } finally {
    if (connection) await connection.close();
  }
};

/**
 * Delete OTP records for an email upon successful verification
 * @param {string} email 
 * @returns {Promise<void>}
 */
const deleteOtpByEmail = async (email) => {
  const cleanEmail = (email || '').trim().toLowerCase();
  let connection;
  try {
    connection = await oracledb.getConnection();
    await connection.execute(
      `DELETE FROM EMAIL_OTPS WHERE LOWER(EMAIL) = :email`,
      { email: cleanEmail }
    );
    await connection.commit();
  } finally {
    if (connection) await connection.close();
  }
};

/**
 * Mark user as email verified (sets EMAIL_VERIFIED = 1 and IS_VERIFIED = 1)
 * @param {string} email 
 * @returns {Promise<boolean>}
 */
const markUserEmailVerified = async (email) => {
  const cleanEmail = (email || '').trim().toLowerCase();
  let connection;
  try {
    connection = await oracledb.getConnection();
    const result = await connection.execute(
      `UPDATE SL_USERS 
       SET EMAIL_VERIFIED = 1, 
           IS_VERIFIED = 1, 
           VERIFICATION_TOKEN = NULL,
           UPDATED_AT = CURRENT_TIMESTAMP 
       WHERE LOWER(EMAIL) = :email`,
      { email: cleanEmail }
    );
    await connection.commit();
    return result.rowsAffected > 0;
  } catch (err) {
    if (connection) await connection.rollback();
    throw err;
  } finally {
    if (connection) await connection.close();
  }
};

module.exports = {
  hashOtp,
  verifyOtpHash,
  findOtpByEmail,
  createOrReplaceOtp,
  incrementAttempts,
  deleteOtpByEmail,
  markUserEmailVerified
};
