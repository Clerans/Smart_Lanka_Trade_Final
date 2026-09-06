const oracledb = require('oracledb');

exports.findByEmail = async (email) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    const result = await connection.execute(
      `SELECT ID, NAME, EMAIL, PASSWORD, IS_VERIFIED, ROLE, KYC_STATUS, NIC_NUMBER, FAILED_ATTEMPTS, ACCOUNT_LOCKED_UNTIL, LAST_LOGIN FROM SL_USERS WHERE EMAIL = :email`,
      [email],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return result.rows[0];
  } finally {
    if (connection) await connection.close();
  }
};

exports.findById = async (id) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    const result = await connection.execute(
      `SELECT ID, NAME, EMAIL, PASSWORD, IS_VERIFIED, ROLE, KYC_STATUS, NIC_NUMBER, CREATED_AT FROM SL_USERS WHERE ID = :id`,
      [id],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return result.rows[0] || null;
  } finally {
    if (connection) await connection.close();
  }
};

exports.findByToken = async (token) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    const result = await connection.execute(
      `SELECT ID FROM SL_USERS WHERE VERIFICATION_TOKEN = :token`,
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
    
    // Insert User with token
    const result = await connection.execute(
      `INSERT INTO SL_USERS (NAME, EMAIL, PASSWORD, VERIFICATION_TOKEN) 
       VALUES (:name, :email, :password, :token) 
       RETURNING ID INTO :id`,
      {
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
      `SELECT ID, NAME, EMAIL, IS_VERIFIED, CREATED_AT FROM SL_USERS`,
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

