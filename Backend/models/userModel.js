const oracledb = require('oracledb');

const { generateAccountUID } = require('../utils/uidGenerator');

// Configure CLOB columns to fetch as string automatically
oracledb.fetchAsString = [ oracledb.CLOB ];

exports.findByEmail = async (email) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    const result = await connection.execute(
      `SELECT ID, ACCOUNT_UID, NAME, EMAIL, PASSWORD, IS_VERIFIED, NVL(EMAIL_VERIFIED, IS_VERIFIED) AS EMAIL_VERIFIED, ROLE, KYC_STATUS, NIC_NUMBER, PHONE_NUMBER, PROFILE_IMAGE, FAILED_ATTEMPTS, ACCOUNT_LOCKED_UNTIL, LAST_LOGIN FROM SL_USERS WHERE EMAIL = :email`,
      [email],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const user = result.rows[0];
    if (user && !user.ACCOUNT_UID) {
      const newUid = generateAccountUID();
      await connection.execute(
        `UPDATE SL_USERS SET ACCOUNT_UID = :newUid WHERE ID = :id`,
        { newUid, id: user.ID }
      );
      await connection.commit();
      user.ACCOUNT_UID = newUid;
    }
    return user;
  } finally {
    if (connection) await connection.close();
  }
};

exports.findById = async (id) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    const result = await connection.execute(
      `SELECT ID, ACCOUNT_UID, NAME, EMAIL, PASSWORD, IS_VERIFIED, NVL(EMAIL_VERIFIED, IS_VERIFIED) AS EMAIL_VERIFIED, ROLE, KYC_STATUS, NIC_NUMBER, PHONE_NUMBER, PROFILE_IMAGE, CREATED_AT FROM SL_USERS WHERE ID = :id`,
      [id],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const user = result.rows[0] || null;
    if (user && !user.ACCOUNT_UID) {
      const newUid = generateAccountUID();
      await connection.execute(
        `UPDATE SL_USERS SET ACCOUNT_UID = :newUid WHERE ID = :id`,
        { newUid, id: user.ID }
      );
      await connection.commit();
      user.ACCOUNT_UID = newUid;
    }
    return user;
  } finally {
    if (connection) await connection.close();
  }
};

exports.findByUid = async (uid) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    const cleanUid = (uid || '').trim().toUpperCase();
    const result = await connection.execute(
      `SELECT ID, ACCOUNT_UID, NAME, EMAIL, IS_VERIFIED, NVL(EMAIL_VERIFIED, IS_VERIFIED) AS EMAIL_VERIFIED, ROLE, KYC_STATUS, CREATED_AT FROM SL_USERS WHERE UPPER(ACCOUNT_UID) = :cleanUid`,
      [cleanUid],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return result.rows[0] || null;
  } finally {
    if (connection) await connection.close();
  }
};

exports.updateProfile = async (userId, { name, email, phoneNumber, profileImage }) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    await connection.execute(
      `UPDATE SL_USERS 
       SET NAME = :name, 
           EMAIL = :email, 
           PHONE_NUMBER = :phoneNumber, 
           PROFILE_IMAGE = :profileImage, 
           UPDATED_AT = CURRENT_TIMESTAMP 
       WHERE ID = :userId`,
      {
        name,
        email,
        phoneNumber: phoneNumber !== undefined ? phoneNumber : null,
        profileImage: profileImage !== undefined ? profileImage : null,
        userId
      }
    );
    await connection.commit();
    return await exports.findById(userId);
  } finally {
    if (connection) await connection.close();
  }
};

exports.findByToken = async (token) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    const result = await connection.execute(
      `SELECT ID, ACCOUNT_UID FROM SL_USERS WHERE VERIFICATION_TOKEN = :token`,
      [token],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return result.rows[0];
  } finally {
    if (connection) await connection.close();
  }
};

exports.verifyUser = async (userId) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    await connection.execute(
      `UPDATE SL_USERS SET IS_VERIFIED = 1, EMAIL_VERIFIED = 1, VERIFICATION_TOKEN = NULL, UPDATED_AT = CURRENT_TIMESTAMP WHERE ID = :userId`,
      [userId]
    );
    await connection.commit();
  } finally {
    if (connection) await connection.close();
  }
};

exports.createUser = async (name, email, password, token) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    
    // Generate unique account UID
    const accountUid = generateAccountUID();

    // Insert User with token, unique UID, and unverified status
    const result = await connection.execute(
      `INSERT INTO SL_USERS (ACCOUNT_UID, NAME, EMAIL, PASSWORD, VERIFICATION_TOKEN, IS_VERIFIED, EMAIL_VERIFIED) 
       VALUES (:accountUid, :name, :email, :password, :token, 0, 0) 
       RETURNING ID INTO :id`,
      {
        accountUid,
        name,
        email,
        password,
        token,
        id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
      }
    );

    const userId = result.outBinds.id[0];

    // Create Initial Wallet
    await connection.execute(
      `INSERT INTO SL_WALLETS (USER_ID) VALUES (:userId)`,
      [userId]
    );

    // Create Initial WALLETS (v3 Demo Trading Engine)
    await connection.execute(
      `INSERT INTO WALLETS (USER_ID, BALANCE_LKR) VALUES (:userId, 1000000.00)`,
      [userId]
    );

    await connection.commit();
    return userId;
  } catch (err) {
    if (connection) await connection.rollback();
    throw err;
  } finally {
    if (connection) await connection.close();
  }
};

exports.findAllUsers = async () => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    const result = await connection.execute(
      `SELECT ID, ACCOUNT_UID, NAME, EMAIL, IS_VERIFIED, CREATED_AT FROM SL_USERS`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return result.rows;
  } finally {
    if (connection) await connection.close();
  }
};

exports.updateFailedAttempts = async (userId, attempts) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    await connection.execute(
      `UPDATE SL_USERS SET FAILED_ATTEMPTS = :attempts, UPDATED_AT = CURRENT_TIMESTAMP WHERE ID = :userId`,
      { attempts, userId }
    );
    await connection.commit();
  } finally {
    if (connection) await connection.close();
  }
};

exports.lockAccount = async (userId, lockUntil) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    await connection.execute(
      `UPDATE SL_USERS 
       SET FAILED_ATTEMPTS = 5, ACCOUNT_LOCKED_UNTIL = :lockUntil, UPDATED_AT = CURRENT_TIMESTAMP 
       WHERE ID = :userId`,
      { lockUntil, userId }
    );
    await connection.commit();
  } finally {
    if (connection) await connection.close();
  }
};

exports.resetFailedAttemptsAndLogLogin = async (userId) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    await connection.execute(
      `UPDATE SL_USERS 
       SET FAILED_ATTEMPTS = 0, ACCOUNT_LOCKED_UNTIL = NULL, LAST_LOGIN = CURRENT_TIMESTAMP, UPDATED_AT = CURRENT_TIMESTAMP 
       WHERE ID = :userId`,
      { userId }
    );
    await connection.commit();
  } finally {
    if (connection) await connection.close();
  }
};

exports.updatePassword = async (userId, hashedPassword) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    await connection.execute(
      `UPDATE SL_USERS SET PASSWORD = :hashedPassword, UPDATED_AT = CURRENT_TIMESTAMP WHERE ID = :userId`,
      { hashedPassword, userId }
    );
    await connection.commit();
  } finally {
    if (connection) await connection.close();
  }
};

/**
 * Retrieve User Security Settings from Oracle Database
 */
exports.getSecuritySettings = async (userId) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    const result = await connection.execute(
      `SELECT NVL(TWO_FACTOR_ENABLED, 0) AS TWO_FACTOR_ENABLED, 
              PIN_HASH, 
              NVL(PIN_FAILED_ATTEMPTS, 0) AS PIN_FAILED_ATTEMPTS, 
              PIN_LOCKED_UNTIL 
       FROM SL_USERS WHERE ID = :userId`,
      [userId],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const row = result.rows[0];
    const isLocked = row?.PIN_LOCKED_UNTIL ? new Date(row.PIN_LOCKED_UNTIL) > new Date() : false;
    const minutesRemaining = isLocked 
      ? Math.max(1, Math.ceil((new Date(row.PIN_LOCKED_UNTIL) - Date.now()) / (60 * 1000))) 
      : 0;

    return {
      twoFactorEnabled: row ? row.TWO_FACTOR_ENABLED === 1 : false,
      hasPin: row ? !!row.PIN_HASH : false,
      pinLocked: isLocked,
      pinLockMinutesRemaining: minutesRemaining
    };
  } catch (err) {
    console.error(`[userModel.getSecuritySettings] Database error fetching security settings for user ${userId}:`, err.message);
    const dbErr = new Error(`Database error retrieving user security settings: ${err.message}`);
    dbErr.code = 'DATABASE_ERROR';
    dbErr.status = 500;
    throw dbErr;
  } finally {
    if (connection) await connection.close();
  }
};

/**
 * Update User Security Settings (2FA & Security PIN)
 */
exports.updateSecuritySettings = async (userId, { twoFactorEnabled, pinHash, resetLockout }) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    const updates = [];
    const binds = { userId };

    if (twoFactorEnabled !== undefined) {
      updates.push('TWO_FACTOR_ENABLED = :twoFactorEnabled');
      binds.twoFactorEnabled = twoFactorEnabled ? 1 : 0;
    }
    if (pinHash !== undefined) {
      updates.push('PIN_HASH = :pinHash');
      binds.pinHash = pinHash;
      updates.push('PIN_FAILED_ATTEMPTS = 0');
      updates.push('PIN_LOCKED_UNTIL = NULL');
    } else if (resetLockout) {
      updates.push('PIN_FAILED_ATTEMPTS = 0');
      updates.push('PIN_LOCKED_UNTIL = NULL');
    }

    if (updates.length > 0) {
      await connection.execute(
        `UPDATE SL_USERS SET ${updates.join(', ')}, UPDATED_AT = CURRENT_TIMESTAMP WHERE ID = :userId`,
        binds
      );
      await connection.commit();
    }
    return await exports.getSecuritySettings(userId);
  } finally {
    if (connection) await connection.close();
  }
};

/**
 * Authoritative Server-Side Security PIN Verification
 * - Never falls back to default '1234'
 * - Detects and upgrades legacy SHA-256 hashes to bcrypt seamlessly
 * - Enforces 5-attempt rate limit and 15-minute progressive lockout
 */
exports.verifyPin = async (userId, plainPin) => {
  if (!plainPin) {
    return { valid: false, code: 'MISSING_PIN', message: 'Security PIN is required.' };
  }

  const cleanPin = String(plainPin).trim();
  let connection;
  try {
    connection = await oracledb.getConnection();
    const result = await connection.execute(
      `SELECT PIN_HASH, NVL(PIN_FAILED_ATTEMPTS, 0) AS PIN_FAILED_ATTEMPTS, PIN_LOCKED_UNTIL 
       FROM SL_USERS WHERE ID = :userId`,
      [userId],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const row = result.rows && result.rows[0];

    if (!row || !row.PIN_HASH) {
      return { 
        valid: false, 
        code: 'PIN_NOT_SET', 
        message: 'Security PIN has not been set up for this account. Please configure it in Security Settings.' 
      };
    }

    // Check lockout
    if (row.PIN_LOCKED_UNTIL && new Date(row.PIN_LOCKED_UNTIL) > new Date()) {
      const minutesLeft = Math.max(1, Math.ceil((new Date(row.PIN_LOCKED_UNTIL) - Date.now()) / (60 * 1000)));
      return {
        valid: false,
        code: 'PIN_LOCKED',
        message: `Security PIN is locked due to too many failed attempts. Try again in ${minutesLeft} minute(s).`
      };
    }

    let isMatch = false;
    const storedHash = row.PIN_HASH;
    const bcrypt = require('bcryptjs');
    const crypto = require('crypto');

    // Check if stored hash is legacy SHA-256 (64 hex characters)
    const isLegacySha256 = /^[a-f0-9]{64}$/i.test(storedHash);
    if (isLegacySha256) {
      const computedSha256 = crypto.createHash('sha256').update(cleanPin).digest('hex');
      if (computedSha256.toLowerCase() === storedHash.toLowerCase()) {
        isMatch = true;
        // Seamless migration: upgrade legacy SHA-256 hash to salted bcrypt
        try {
          const newBcryptHash = await bcrypt.hash(cleanPin, 10);
          await connection.execute(
            `UPDATE SL_USERS SET PIN_HASH = :newHash, PIN_FAILED_ATTEMPTS = 0, PIN_LOCKED_UNTIL = NULL, UPDATED_AT = CURRENT_TIMESTAMP WHERE ID = :userId`,
            { newHash: newBcryptHash, userId }
          );
          await connection.commit();
        } catch (upgradeErr) {
          console.warn('⚠️ Legacy PIN hash upgrade notice:', upgradeErr.message);
        }
      }
    } else {
      isMatch = await bcrypt.compare(cleanPin, storedHash);
    }

    if (isMatch) {
      // Reset failed attempts on success
      if (row.PIN_FAILED_ATTEMPTS > 0 || row.PIN_LOCKED_UNTIL) {
        await connection.execute(
          `UPDATE SL_USERS SET PIN_FAILED_ATTEMPTS = 0, PIN_LOCKED_UNTIL = NULL WHERE ID = :userId`,
          { userId }
        );
        await connection.commit();
      }
      return { valid: true };
    } else {
      // Record failed attempt
      const newAttempts = Number(row.PIN_FAILED_ATTEMPTS || 0) + 1;
      if (newAttempts >= 5) {
        const lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minute lockout
        await connection.execute(
          `UPDATE SL_USERS SET PIN_FAILED_ATTEMPTS = :attempts, PIN_LOCKED_UNTIL = :lockUntil WHERE ID = :userId`,
          { attempts: newAttempts, lockUntil, userId }
        );
        await connection.commit();
        return {
          valid: false,
          code: 'PIN_LOCKED',
          message: 'Security PIN has been temporarily locked due to 5 consecutive incorrect attempts. Try again in 15 minutes.'
        };
      } else {
        await connection.execute(
          `UPDATE SL_USERS SET PIN_FAILED_ATTEMPTS = :attempts WHERE ID = :userId`,
          { attempts: newAttempts, userId }
        );
        await connection.commit();
        const remaining = 5 - newAttempts;
        return {
          valid: false,
          code: 'INVALID_PIN',
          message: `Incorrect security PIN. ${remaining} attempt(s) remaining before account lockout.`
        };
      }
    }
  } catch (err) {
    console.error('Error verifying PIN:', err.message);
    return { valid: false, code: 'PIN_VERIFY_ERROR', message: 'Unable to verify security PIN at this time.' };
  } finally {
    if (connection) await connection.close();
  }
};


