const oracledb = require('oracledb');

const createTransaction = async (connection, userId, symbol, type, quantity, price, totalAmount, status = 'COMPLETED', assetType = 'CRYPTO') => {
  const conn = connection || (await oracledb.getConnection());
  try {
    const result = await conn.execute(
      `INSERT INTO TRANSACTIONS (USER_ID, SYMBOL, TRANSACTION_TYPE, QUANTITY, PRICE, TOTAL_AMOUNT, STATUS, ASSET_TYPE) 
       VALUES (:userId, :symbol, :type, :quantity, :price, :totalAmount, :status, :assetType)
       RETURNING TRANSACTION_ID INTO :txId`,
      {
        userId, symbol, type, quantity, price, totalAmount, status, assetType,
        txId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
      }
    );
    const txId = result?.outBinds?.txId?.[0];
    if (!txId) {
      throw new Error('Database failed to return generated transaction ID for inserted order.');
    }
    if (!connection) {
      await conn.commit();
    }
    return txId;
  } finally {
    if (!connection) await conn.close();
  }
};

const getTransactionsByUserId = async (userId) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    const result = await connection.execute(
      `SELECT TRANSACTION_ID, USER_ID, SYMBOL, TRANSACTION_TYPE, QUANTITY, PRICE, TOTAL_AMOUNT, STATUS, ASSET_TYPE, CREATED_AT 
       FROM TRANSACTIONS 
       WHERE USER_ID = :userId 
       ORDER BY CREATED_AT DESC`,
      [userId],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return result.rows;
  } finally {
    if (connection) await connection.close();
  }
};

module.exports = {
  createTransaction,
  getTransactionsByUserId
};
