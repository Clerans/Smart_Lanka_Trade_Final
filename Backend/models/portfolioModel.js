const oracledb = require('oracledb');

const getUserPortfolio = async (userId) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    const result = await connection.execute(
      `SELECT PORTFOLIO_ID, USER_ID, SYMBOL, QUANTITY, AVERAGE_PRICE, INVESTED_AMOUNT, CREATED_AT, UPDATED_AT 
       FROM PORTFOLIOS 
       WHERE USER_ID = :userId AND QUANTITY > 0
       ORDER BY SYMBOL ASC`,
      [userId],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return result.rows;
  } finally {
    if (connection) await connection.close();
  }
};

const getAssetHolding = async (userId, symbol) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    const result = await connection.execute(
      `SELECT PORTFOLIO_ID, USER_ID, SYMBOL, QUANTITY, AVERAGE_PRICE, INVESTED_AMOUNT 
       FROM PORTFOLIOS 
       WHERE USER_ID = :userId AND SYMBOL = :symbol`,
      { userId, symbol },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return result.rows[0] || null;
  } finally {
    if (connection) await connection.close();
  }
};

const updateAssetHolding = async (connection, userId, symbol, quantity, averagePrice, investedAmount) => {
  const conn = connection || (await oracledb.getConnection());
  try {
    await conn.execute(
      `MERGE INTO PORTFOLIOS p
       USING (SELECT :userId AS user_id, :symbol AS symbol FROM dual) src
       ON (p.user_id = src.user_id AND p.symbol = src.symbol)
       WHEN MATCHED THEN
         UPDATE SET p.quantity = :quantity,
                    p.average_price = :averagePrice,
                    p.invested_amount = :investedAmount,
                    p.updated_at = CURRENT_TIMESTAMP
       WHEN NOT MATCHED THEN
         INSERT (USER_ID, SYMBOL, QUANTITY, AVERAGE_PRICE, INVESTED_AMOUNT)
         VALUES (:userId, :symbol, :quantity, :averagePrice, :investedAmount)`,
      { userId, symbol, quantity, averagePrice, investedAmount }
    );
    if (!connection) {
      await conn.commit();
    }
  } finally {
    if (!connection) await conn.close();
  }
};

const deleteAssetHolding = async (connection, userId, symbol) => {
  const conn = connection || (await oracledb.getConnection());
  try {
    await conn.execute(
      `DELETE FROM PORTFOLIOS WHERE USER_ID = :userId AND SYMBOL = :symbol`,
      { userId, symbol }
    );
    if (!connection) {
      await conn.commit();
    }
  } finally {
    if (!connection) await conn.close();
  }
};

module.exports = {
  getUserPortfolio,
  getAssetHolding,
  updateAssetHolding,
  deleteAssetHolding
};
