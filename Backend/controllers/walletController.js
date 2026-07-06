const oracledb = require('oracledb');

const getWalletBalance = async (req, res) => {
  let connection;
  try {
    // For development: if not authenticated, fallback to User ID 1
    const userId = req.user ? req.user.id : 1;
    
    connection = await oracledb.getConnection();
    const result = await connection.execute(
      `SELECT BALANCE, CURRENCY FROM SL_WALLETS WHERE USER_ID = :userId`,
      [userId],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    res.json({
      success: true,
      data: {
        balance: parseFloat(result.rows[0].BALANCE),
        currency: result.rows[0].CURRENCY
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

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid deposit amount' });
    }

    connection = await oracledb.getConnection();

    // 1. Update balance
    await connection.execute(
      `UPDATE SL_WALLETS SET BALANCE = BALANCE + :amount, LAST_UPDATED = CURRENT_TIMESTAMP WHERE USER_ID = :userId`,
      { amount, userId }
    );

    // 2. Log transaction
    await connection.execute(
      `INSERT INTO SL_TRANSACTIONS (USER_ID, AMOUNT, TYPE, STATUS) VALUES (:userId, :amount, 'DEPOSIT', 'COMPLETED')`,
      { userId, amount }
    );

    await connection.commit();

    res.json({
      success: true,
      message: `Successfully deposited LKR ${amount.toLocaleString()}`
    });
  } catch (error) {
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
      `SELECT ID, AMOUNT, TYPE, STATUS, CREATED_AT 
       FROM SL_TRANSACTIONS 
       WHERE USER_ID = :userId 
       ORDER BY CREATED_AT DESC 
       FETCH NEXT 5 ROWS ONLY`,
      [userId],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    res.json({
      success: true,
      data: result.rows
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
  getWalletBalance,
  depositMoney,
  getTransactions
};
