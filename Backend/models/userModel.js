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
 * Synchronize or register a Firebase Authenticated user in Oracle Autonomous AI Database 26ai
 * Strictly prevents account takeover by prohibiting automatic email-only linking.
 */
exports.createOrSyncFirebaseUser = async ({ firebaseUid, email, name, emailVerified }) => {
  if (!firebaseUid || !email) {
    throw new Error('firebaseUid and email are required for user synchronization.');
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanName = (name || '').trim() || cleanEmail.split('@')[0];

  // 1. CASE A: Firebase UID already linked -> Load existing Oracle user
  let user = await exports.findByFirebaseUid(firebaseUid);
  if (user) {
    // If email verification status changed on Firebase, update Oracle IS_VERIFIED
    if (emailVerified && user.IS_VERIFIED !== 1) {
      await exports.verifyUser(user.ID);
      user.IS_VERIFIED = 1;
    }
    return user;
  }

  // 2. CASE C: Check if an Oracle account already exists for this email
  const existingByEmail = await exports.findByEmail(cleanEmail);
  if (existingByEmail) {
    // If existing user already has a DIFFERENT Firebase UID, reject
    if (existingByEmail.FIREBASE_UID && existingByEmail.FIREBASE_UID !== firebaseUid) {
      const err = new Error('This email address is already associated with another authenticated identity.');
      err.code = 'FIREBASE_UID_MISMATCH';
      err.status = 409;
      throw err;
    }

    // If existing user is ADMIN, forbid automatic linking
    if ((existingByEmail.ROLE || '').toUpperCase() === 'ADMIN') {
      const err = new Error('Administrative accounts cannot be linked automatically. Please contact security support.');
      err.code = 'ADMIN_LINK_RESTRICTED';
      err.status = 403;
      throw err;
    }

    // DO NOT automatically link! Email equality is NOT proof of ownership.
    // Require explicit legacy password verification via /api/auth/link-legacy-account
    const err = new Error('An existing account was found for this email address. Please verify your legacy account password to link your account.');
    err.code = 'MIGRATION_REQUIRED';
    err.status = 409;
    throw err;
  }

  // 3. CASE B: Firebase UID does not exist AND no Oracle account exists for email -> Create new Oracle user
  let connection;
  try {
    connection = await oracledb.getConnection();
    const accountUid = generateAccountUID();
    const crypto = require('crypto');
    const dummyPasswordHash = '$2a$10$' + crypto.randomBytes(24).toString('base64').substring(0, 53); // Non-usable placeholder

    const isVerifiedNum = emailVerified ? 1 : 0;

    const result = await connection.execute(
      `INSERT INTO SL_USERS (ACCOUNT_UID, FIREBASE_UID, NAME, EMAIL, PASSWORD, IS_VERIFIED, ROLE) 
       VALUES (:accountUid, :firebaseUid, :name, :email, :password, :isVerified, 'USER') 
       RETURNING ID INTO :id`,
      {
        accountUid,
        firebaseUid,
        name: cleanName,
        email: cleanEmail,
        password: dummyPasswordHash,
        isVerified: isVerifiedNum,
        id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
      }
    );

    const userId = result.outBinds.id[0];

    // Create Initial Legacy Wallet (SL_WALLETS)
    try {
      await connection.execute(
        `INSERT INTO SL_WALLETS (USER_ID) VALUES (:userId)`,
        [userId]
      );
    } catch (e) {}

    // Create Initial Demo Trading Wallet (WALLETS) with LKR 1,000,000
    try {
      await connection.execute(
        `INSERT INTO WALLETS (USER_ID, BALANCE_LKR) VALUES (:userId, 1000000.00)`,
        [userId]
      );
    } catch (e) {}

    await connection.commit();
    console.log(`✨ [Firebase Sync] Created new Oracle user ID ${userId} with UID ${accountUid} for Firebase UID ${firebaseUid}`);
    return await exports.findById(userId);
  } catch (err) {
    if (connection) await connection.rollback();
    throw err;
  } finally {
    if (connection) await connection.close();
  }
};

