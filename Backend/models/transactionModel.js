const oracledb = require('oracledb');

const createTransaction = async (connection, userId, symbol, type, quantity, price, totalAmount, status = 'COMPLETED') => {
  const conn = connection || (await oracledb.getConnection());
  try {
    const result = await conn.execute(
      `INSERT INTO TRANSACTIONS (USER_ID, SYMBOL, TRANSACTION_TYPE, QUANTITY, PRICE, TOTAL_AMOUNT, STATUS) 
       VALUES (:userId, :symbol, :type, :quantity, :price, :totalAmount, :status)
       RETURNING TRANSACTION_ID INTO :txId`,
      {
        userId, symbol, type, quantity, price, totalAmount, status,
        txId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
      }
    );
    const txId = result?.outBinds?.txId?.[0];
    if (!connection) {
      await conn.commit();
    }
    return txId;
  } catch (err) {
    // Fallback if RETURNING clause is unsupported in certain table triggers
    if (err.message && err.message.includes('ORA-')) {
      await conn.execute(
        `INSERT INTO TRANSACTIONS (USER_ID, SYMBOL, TRANSACTION_TYPE, QUANTITY, PRICE, TOTAL_AMOUNT, STATUS) 
         VALUES (:userId, :symbol, :type, :quantity, :price, :totalAmount, :status)`,
        { userId, symbol, type, quantity, price, totalAmount, status }
      );
      if (!connection) {
        await conn.commit();
      }
      return null;
    }
    throw err;
  } finally {
    if (!connection) await conn.close();
  }
};

const getTransactionsByUserId = async (userId) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    const result = await connection.execute(
      `SELECT TRANSACTION_ID, USER_ID, SYMBOL, TRANSACTION_TYPE, QUANTITY, PRICE, TOTAL_AMOUNT, STATUS, CREATED_AT 
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
