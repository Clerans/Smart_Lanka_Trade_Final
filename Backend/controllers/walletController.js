const oracledb = require('oracledb');

const getWalletDetails = async (req, res) => {
  let connection;
  try {
    const userId = req.user ? req.user.id : 1;
    connection = await oracledb.getConnection();
    
    // 1. Get wallet cash balance
    const walletResult = await connection.execute(
      `SELECT BALANCE_LKR FROM WALLETS WHERE USER_ID = :userId`,
      [userId],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    
    if (walletResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }
    
    const availableBalance = parseFloat(walletResult.rows[0].BALANCE_LKR);

    // 2. Get total invested amount from active portfolios
    const portfolioResult = await connection.execute(
      `SELECT SUM(INVESTED_AMOUNT) AS TOTAL_INVESTED FROM PORTFOLIOS WHERE USER_ID = :userId`,
      [userId],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    
    const investedAmount = portfolioResult.rows[0].TOTAL_INVESTED ? parseFloat(portfolioResult.rows[0].TOTAL_INVESTED) : 0.0;
    const balanceLKR = availableBalance + investedAmount;

    res.json({
      success: true,
      balanceLKR,
      investedAmount,
      availableBalance
    });
  } catch (error) {
    console.error('Wallet Fetch Details Error:', error.message);
    res.status(500).json({ success: false, error: 'Server error fetching wallet details' });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) {}
    }
  }
};

const getWalletBalance = async (req, res) => {
  let connection;
  try {
    const userId = req.user ? req.user.id : 1;
    
    connection = await oracledb.getConnection();
    const result = await connection.execute(
      `SELECT BALANCE_LKR FROM WALLETS WHERE USER_ID = :userId`,
      [userId],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    res.json({
      success: true,
      data: {
        balance: parseFloat(result.rows[0].BALANCE_LKR),
        currency: 'LKR'
      }
    });
  } catch (error) {
    console.error('Wallet Fetch Error:', error.message);
    res.status(500).json({ success: false, error: 'Server error fetching wallet balance' });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) {}
    }
  }
};

const depositMoney = async (req, res) => {
  let connection;
  try {
    const { amount } = req.body;
    const userId = req.user ? req.user.id : 1;

    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid deposit amount' });
    }

    const numAmount = parseFloat(amount);
    connection = await oracledb.getConnection();

    // 1. Update balance in new WALLETS table
    await connection.execute(
      `UPDATE WALLETS SET BALANCE_LKR = BALANCE_LKR + :numAmount, UPDATED_AT = CURRENT_TIMESTAMP WHERE USER_ID = :userId`,
      { numAmount, userId }
    );

    // Also update legacy SL_WALLETS for backward compatibility
    try {
      await connection.execute(
        `UPDATE SL_WALLETS SET BALANCE = BALANCE + :numAmount, LAST_UPDATED = CURRENT_TIMESTAMP WHERE USER_ID = :userId`,
        { numAmount, userId }
      );
    } catch (err) {
      console.warn('Syncing SL_WALLETS failed (non-blocking):', err.message);
    }

    // 2. Log transaction in new TRANSACTIONS table
    await connection.execute(
      `INSERT INTO TRANSACTIONS (USER_ID, SYMBOL, TRANSACTION_TYPE, QUANTITY, PRICE, TOTAL_AMOUNT, STATUS) 
       VALUES (:userId, 'LKR', 'DEPOSIT', 1, :numAmount, :numAmount, 'COMPLETED')`,
      { userId, numAmount }
    );

    // Also log to legacy SL_TRANSACTIONS
    try {
      await connection.execute(
        `INSERT INTO SL_TRANSACTIONS (USER_ID, AMOUNT, TYPE, STATUS) VALUES (:userId, :numAmount, 'DEPOSIT', 'COMPLETED')`,
        { userId, numAmount }
      );
    } catch (err) {
      console.warn('Syncing SL_TRANSACTIONS failed (non-blocking):', err.message);
    }

    await connection.commit();

    res.json({
      success: true,
      message: `Successfully deposited LKR ${numAmount.toLocaleString()}`
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Deposit Error:', error.message);
    res.status(500).json({ success: false, error: 'Server error during deposit' });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) {}
    }
  }
};

const getTransactions = async (req, res) => {
  let connection;
  try {
    const userId = req.user ? req.user.id : 1;
    
    connection = await oracledb.getConnection();
    const result = await connection.execute(
      `SELECT TRANSACTION_ID AS ID, TOTAL_AMOUNT AS AMOUNT, TRANSACTION_TYPE AS TYPE, STATUS, CREATED_AT 
       FROM TRANSACTIONS 
       WHERE USER_ID = :userId 
       ORDER BY CREATED_AT DESC 
       FETCH NEXT 5 ROWS ONLY`,
      [userId],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    // Parse numeric attributes to float
    const formatted = result.rows.map(row => ({
      ID: row.ID,
      AMOUNT: parseFloat(row.AMOUNT),
      TYPE: row.TYPE,
      STATUS: row.STATUS,
      CREATED_AT: row.CREATED_AT
    }));

    res.json({
      success: true,
      data: formatted
    });
  } catch (error) {
    console.error('Transactions Fetch Error:', error.message);
    res.status(500).json({ success: false, error: 'Server error fetching transactions' });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) {}
    }
  }
};

module.exports = {
  getWalletDetails,
  getWalletBalance,
  depositMoney,
  getTransactions
};
