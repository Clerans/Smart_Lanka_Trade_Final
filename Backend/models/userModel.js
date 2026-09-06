const oracledb = require('oracledb');

exports.findByEmail = async (email) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    const result = await connection.execute(
      `SELECT ID, NAME, EMAIL, PASSWORD, ROLE, IS_VERIFIED, KYC_STATUS, FAILED_ATTEMPTS, ACCOUNT_LOCKED_UNTIL, LAST_LOGIN, CREATED_AT 
       FROM SL_USERS WHERE LOWER(EMAIL) = LOWER(:email)`,
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

exports.findById = async (id) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    const result = await connection.execute(
      `SELECT ID, NAME, EMAIL, ROLE, IS_VERIFIED, KYC_STATUS, FAILED_ATTEMPTS, ACCOUNT_LOCKED_UNTIL, LAST_LOGIN, CREATED_AT 
       FROM SL_USERS WHERE ID = :id`,
      { id },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return result.rows[0] || null;
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) {}
    }
  }
};

exports.createUser = async (name, email, hashedPassword, role = 'INVESTOR') => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    
    // Insert User
    const result = await connection.execute(
      `INSERT INTO SL_USERS (NAME, EMAIL, PASSWORD, ROLE, IS_VERIFIED, KYC_STATUS) 
       VALUES (:name, LOWER(:email), :hashedPassword, :role, 0, 'UNVERIFIED') 
       RETURNING ID INTO :id`,
      {
        name,
        email,
        hashedPassword,
        role: role || 'INVESTOR',
        id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
      }
    );

    const userId = result.outBinds.id[0];

    // Create Initial Demo Trading Virtual Wallet
    await connection.execute(
      `INSERT INTO WALLETS (USER_ID, BALANCE_LKR, USD_BALANCE) VALUES (:userId, 1000000.00, 0.00)`,
      { userId }
    );

    await connection.commit();
    return userId;
  } catch (err) {
    if (connection) await connection.rollback();
    throw err;
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) {}
    }
  }
};

exports.verifyUser = async (userId) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    await connection.execute(
      `UPDATE SL_USERS SET IS_VERIFIED = 1, UPDATED_AT = CURRENT_TIMESTAMP WHERE ID = :userId`,
      { userId },
      { autoCommit: true }
    );
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) {}
    }
  }
};

exports.updateKycStatus = async (userId, status) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    await connection.execute(
      `UPDATE SL_USERS SET KYC_STATUS = :status, UPDATED_AT = CURRENT_TIMESTAMP WHERE ID = :userId`,
      { status, userId },
      { autoCommit: true }
    );
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) {}
    }
  }
};

exports.findAllUsers = async () => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    const result = await connection.execute(
      `SELECT ID, NAME, EMAIL, ROLE, IS_VERIFIED, KYC_STATUS, LAST_LOGIN, CREATED_AT FROM SL_USERS ORDER BY CREATED_AT DESC`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return result.rows || [];
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) {}
    }
  }
};

exports.updateFailedAttempts = async (userId, attempts) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    await connection.execute(
      `UPDATE SL_USERS SET FAILED_ATTEMPTS = :attempts, UPDATED_AT = CURRENT_TIMESTAMP WHERE ID = :userId`,
      { attempts, userId },
      { autoCommit: true }
    );
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) {}
    }
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
      { lockUntil, userId },
      { autoCommit: true }
    );
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) {}
    }
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
      { userId },
      { autoCommit: true }
    );
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) {}
    }
  }
};

exports.updatePassword = async (userId, hashedPassword) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    await connection.execute(
      `UPDATE SL_USERS SET PASSWORD = :hashedPassword, UPDATED_AT = CURRENT_TIMESTAMP WHERE ID = :userId`,
      { hashedPassword, userId },
      { autoCommit: true }
    );
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) {}
    }
  }
};
