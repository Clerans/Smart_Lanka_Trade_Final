const oracledb = require('oracledb');

const findWalletByUserId = async (userId) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    const result = await connection.execute(
      `SELECT WALLET_ID, USER_ID, BALANCE_LKR, CREATED_AT, UPDATED_AT 
       FROM WALLETS WHERE USER_ID = :userId`,
      [userId],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return result.rows[0] || null;
  } finally {
    if (connection) await connection.close();
  }
};

const createWallet = async (userId, balanceLkr = 1000000.00) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    await connection.execute(
      `INSERT INTO WALLETS (USER_ID, BALANCE_LKR) VALUES (:userId, :balanceLkr)`,
      { userId, balanceLkr }
    );
    await connection.commit();
  } finally {
    if (connection) await connection.close();
  }
};

const updateWalletBalance = async (connection, userId, amount) => {
  // Amount can be positive (sell/deposit) or negative (buy/withdraw)
  const conn = connection || (await oracledb.getConnection());
  try {
    await conn.execute(
      `UPDATE WALLETS 
       SET BALANCE_LKR = BALANCE_LKR + :amount, UPDATED_AT = CURRENT_TIMESTAMP 
       WHERE USER_ID = :userId`,
      { amount, userId }
    );
    if (!connection) {
      await conn.commit();
    }
  } finally {
    if (!connection) await conn.close();
  }
};

module.exports = {
  findWalletByUserId,
  createWallet,
  updateWalletBalance
};
