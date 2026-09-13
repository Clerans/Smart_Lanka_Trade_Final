const oracledb = require('oracledb');

const { generateAccountUID } = require('../utils/uidGenerator');

// Configure CLOB columns to fetch as string automatically
oracledb.fetchAsString = [ oracledb.CLOB ];

exports.findByEmail = async (email) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    const result = await connection.execute(
      `SELECT ID, ACCOUNT_UID, NAME, EMAIL, PASSWORD, IS_VERIFIED, ROLE, KYC_STATUS, NIC_NUMBER, PHONE_NUMBER, PROFILE_IMAGE, FAILED_ATTEMPTS, ACCOUNT_LOCKED_UNTIL, LAST_LOGIN FROM SL_USERS WHERE EMAIL = :email`,
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
      `SELECT ID, ACCOUNT_UID, NAME, EMAIL, PASSWORD, IS_VERIFIED, ROLE, KYC_STATUS, NIC_NUMBER, PHONE_NUMBER, PROFILE_IMAGE, CREATED_AT FROM SL_USERS WHERE ID = :id`,
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
      `SELECT ID, ACCOUNT_UID, NAME, EMAIL, IS_VERIFIED, ROLE, KYC_STATUS, CREATED_AT FROM SL_USERS WHERE UPPER(ACCOUNT_UID) = :cleanUid`,
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
      `UPDATE SL_USERS SET IS_VERIFIED = 1, VERIFICATION_TOKEN = NULL WHERE ID = :userId`,
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

    // Insert User with token and unique UID
    const result = await connection.execute(
      `INSERT INTO SL_USERS (ACCOUNT_UID, NAME, EMAIL, PASSWORD, VERIFICATION_TOKEN) 
       VALUES (:accountUid, :name, :email, :password, :token) 
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
  let connection;
  try {
    connection = await oracledb.getConnection();
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
 * Synchronize or register a Firebase Authenticated user in Oracle database
 * Derives user identity strictly from verified token parameters.
 */
exports.createOrSyncFirebaseUser = async ({ firebaseUid, email, name, emailVerified }) => {
  if (!firebaseUid || !email) {
    throw new Error('firebaseUid and email are required for user synchronization.');
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanName = (name || '').trim() || cleanEmail.split('@')[0];

  // 1. Check if user exists by FIREBASE_UID
  let user = await exports.findByFirebaseUid(firebaseUid);
  if (user) {
    // If email verification status changed on Firebase, update Oracle IS_VERIFIED
    if (emailVerified && user.IS_VERIFIED !== 1) {
      await exports.verifyUser(user.ID);
      user.IS_VERIFIED = 1;
    }
    return user;
  }

  // 2. Check if user already exists by EMAIL (Existing User Migration / Re-authentication)
  user = await exports.findByEmail(cleanEmail);
  if (user) {
    console.log(`🔗 [Firebase Migration] Linking FIREBASE_UID (${firebaseUid}) to existing Oracle user ${user.ID} (${cleanEmail})`);
    await exports.linkFirebaseUid(user.ID, firebaseUid);
    if (emailVerified && user.IS_VERIFIED !== 1) {
      await exports.verifyUser(user.ID);
      user.IS_VERIFIED = 1;
    }
    user.FIREBASE_UID = firebaseUid;
    return user;
  }

  // 3. New User Registration: Create SL_USERS record and initialize Wallets
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

