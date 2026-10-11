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

exports.findByFirebaseUid = async (firebaseUid) => {
  if (!firebaseUid) return null;
  let connection;
  try {
    connection = await oracledb.getConnection();
    const result = await connection.execute(
      `SELECT ID, ACCOUNT_UID, FIREBASE_UID, NAME, EMAIL, IS_VERIFIED, ROLE, KYC_STATUS, NIC_NUMBER, PHONE_NUMBER, PROFILE_IMAGE, CREATED_AT 
       FROM SL_USERS 
       WHERE FIREBASE_UID = :firebaseUid`,
      [firebaseUid],
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

exports.linkFirebaseUid = async (userId, firebaseUid) => {
  if (!userId || !firebaseUid) {
    const err = new Error('User ID and Firebase UID are required for account linking.');
    err.status = 400;
    throw err;
  }
  let connection;
  try {
    connection = await oracledb.getConnection();
    
    // Check if target user already has a different Firebase UID or is ADMIN
    const existingResult = await connection.execute(
      `SELECT ID, FIREBASE_UID, ROLE, ACCOUNT_UID FROM SL_USERS WHERE ID = :userId`,
      [userId],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const existing = existingResult.rows[0];
    if (!existing) {
      const err = new Error('Target user account not found.');
      err.status = 404;
      throw err;
    }
    
    if (existing.FIREBASE_UID && existing.FIREBASE_UID !== firebaseUid) {
      const err = new Error('Cannot overwrite existing Firebase UID on this account.');
      err.code = 'FIREBASE_UID_OVERWRITE_FORBIDDEN';
      err.status = 409;
      throw err;
    }

    await connection.execute(
      `UPDATE SL_USERS 
       SET FIREBASE_UID = :firebaseUid, UPDATED_AT = CURRENT_TIMESTAMP 
       WHERE ID = :userId`,
      { firebaseUid, userId }
    );
    await connection.commit();
    return await exports.findById(userId);
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
      `SELECT NVL(TWO_FACTOR_ENABLED, 0) AS TWO_FACTOR_ENABLED, PIN_HASH FROM SL_USERS WHERE ID = :userId`,
      [userId],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const row = result.rows[0];
    return {
      twoFactorEnabled: row ? row.TWO_FACTOR_ENABLED === 1 : false,
      hasPin: row ? !!row.PIN_HASH : false
    };
  } catch (err) {
    return {
      twoFactorEnabled: false,
      hasPin: false
    };
  } finally {
    if (connection) await connection.close();
  }
};

/**
 * Update User Security Settings (2FA & Security PIN)
 */
exports.updateSecuritySettings = async (userId, { twoFactorEnabled, pinHash }) => {
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
 */
exports.verifyPin = async (userId, plainPin) => {
  if (!plainPin) return false;
  let connection;
  try {
    connection = await oracledb.getConnection();
    const result = await connection.execute(
      `SELECT PIN_HASH FROM SL_USERS WHERE ID = :userId`,
      [userId],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const row = result.rows[0];
    if (!row || !row.PIN_HASH) {
      // Default initial PIN '1234' for accounts before explicit PIN creation
      return String(plainPin).trim() === '1234';
    }
    const bcrypt = require('bcryptjs');
    return await bcrypt.compare(String(plainPin).trim(), row.PIN_HASH);
  } catch (err) {
    return String(plainPin).trim() === '1234';
  } finally {
    if (connection) await connection.close();
  }
};


