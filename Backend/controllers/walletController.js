const oracledb = require('oracledb');
const marketService = require('../services/marketService');
const { logAuditEvent } = require('../services/auditService');

function getClientMeta(req) {
  return {
    ip: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'SmartLanka-App'
  };
}

const getWalletDetails = async (req, res) => {
  let connection;
  try {
    const userId = req.user.id;
    connection = await oracledb.getConnection();
    
    // 1. Get wallet cash balances
    const walletResult = await connection.execute(
      `SELECT BALANCE_LKR, USD_BALANCE FROM WALLETS WHERE USER_ID = :userId`,
      [userId],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    
    if (walletResult.rows.length === 0) {
      return res.status(404).json({ success: false, code: 'WALLET_NOT_FOUND', message: 'Wallet not found' });
    }
    
    const availableBalance = parseFloat(walletResult.rows[0].BALANCE_LKR || 0.0);
    const usdBalance = parseFloat(walletResult.rows[0].USD_BALANCE || 0.0);

    // 2. Get total invested amount from active stock portfolios
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
      availableBalance,
      usdBalance,
      investedAmount,
      currency: 'LKR'
    });
  } catch (error) {
    console.error('Wallet Fetch Details Error:', error.message);
    res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Server error fetching wallet details' });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) {}
    }
  }
};

const getWalletBalance = async (req, res) => {
  let connection;
  try {
    const userId = req.user.id;
    connection = await oracledb.getConnection();
    const result = await connection.execute(
      `SELECT BALANCE_LKR, USD_BALANCE FROM WALLETS WHERE USER_ID = :userId`,
      [userId],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, code: 'WALLET_NOT_FOUND', message: 'Wallet not found' });
    }

    res.json({
      success: true,
      data: {
        balance: parseFloat(result.rows[0].BALANCE_LKR),
        usdBalance: parseFloat(result.rows[0].USD_BALANCE || 0.0),
        currency: 'LKR'
      }
    });
  } catch (error) {
    console.error('Wallet Fetch Error:', error.message);
    res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Server error fetching wallet balance' });
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
    const userId = req.user.id;

    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      return res.status(422).json({ success: false, code: 'INVALID_AMOUNT', message: 'Invalid deposit amount' });
    }

    const numAmount = parseFloat(amount);
    connection = await oracledb.getConnection();

    // 1. Update balance in WALLETS table
    await connection.execute(
      `UPDATE WALLETS SET BALANCE_LKR = BALANCE_LKR + :numAmount, UPDATED_AT = CURRENT_TIMESTAMP WHERE USER_ID = :userId`,
      { numAmount, userId }
    );

    // 2. Log transaction
    await connection.execute(
      `INSERT INTO TRANSACTIONS (USER_ID, SYMBOL, TRANSACTION_TYPE, QUANTITY, PRICE, TOTAL_AMOUNT, STATUS) 
       VALUES (:userId, 'LKR', 'DEPOSIT', 1, :numAmount, :numAmount, 'COMPLETED')`,
      { userId, numAmount }
    );

    await connection.commit();

    // Audit log
    const clientMeta = getClientMeta(req);
    await logAuditEvent({
      userId,
      action: 'VIRTUAL_DEPOSIT',
      entity: 'WALLET',
      entityId: userId,
      ipAddress: clientMeta.ip,
      userAgent: clientMeta.userAgent,
      details: `Deposited LKR ${numAmount.toLocaleString()} virtual demo funds.`
    });

    res.json({
      success: true,
      message: `Successfully deposited LKR ${numAmount.toLocaleString()} demo funds.`
    });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (e) {}
    }
    console.error('Deposit Error:', error.message);
    res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Server error during deposit' });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) {}
    }
  }
};

const convertCurrency = async (req, res) => {
  let connection;
  try {
    const { fromCurrency, toCurrency, amount } = req.body;
    const userId = req.user.id;

    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      return res.status(422).json({ success: false, code: 'INVALID_AMOUNT', message: 'Please provide a valid conversion amount.' });
    }

    const numAmount = parseFloat(amount);
    const forex = await marketService.getForexRates();
    const usdLkrRate = forex['USD/LKR'].rate;

    connection = await oracledb.getConnection();

    // Lock wallet row
    const walletRes = await connection.execute(
      `SELECT BALANCE_LKR, USD_BALANCE FROM WALLETS WHERE USER_ID = :userId FOR UPDATE`,
      [userId],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (walletRes.rows.length === 0) {
      return res.status(404).json({ success: false, code: 'WALLET_NOT_FOUND', message: 'Wallet not found' });
    }

    const currentLkr = parseFloat(walletRes.rows[0].BALANCE_LKR || 0.0);
    const currentUsd = parseFloat(walletRes.rows[0].USD_BALANCE || 0.0);

    let newLkr = currentLkr;
    let newUsd = currentUsd;
    let convertedAmount = 0;

    if (fromCurrency === 'LKR' && toCurrency === 'USD') {
      if (currentLkr < numAmount) {
        return res.status(400).json({
          success: false,
          code: 'INSUFFICIENT_FUNDS',
          message: `Insufficient LKR balance for conversion. Available: LKR ${currentLkr.toFixed(2)}`
        });
      }
      convertedAmount = parseFloat((numAmount / usdLkrRate).toFixed(2));
      newLkr = currentLkr - numAmount;
      newUsd = currentUsd + convertedAmount;
    } else if (fromCurrency === 'USD' && toCurrency === 'LKR') {
      if (currentUsd < numAmount) {
        return res.status(400).json({
          success: false,
          code: 'INSUFFICIENT_FUNDS',
          message: `Insufficient USD balance for conversion. Available: USD ${currentUsd.toFixed(2)}`
        });
      }
      convertedAmount = parseFloat((numAmount * usdLkrRate).toFixed(2));
      newUsd = currentUsd - numAmount;
      newLkr = currentLkr + convertedAmount;
    } else {
      return res.status(422).json({
        success: false,
        code: 'UNSUPPORTED_CONVERSION',
        message: 'Currently supporting conversions between LKR and USD.'
      });
    }

    // Update wallet balances
    await connection.execute(
      `UPDATE WALLETS SET BALANCE_LKR = :newLkr, USD_BALANCE = :newUsd, UPDATED_AT = CURRENT_TIMESTAMP WHERE USER_ID = :userId`,
      { newLkr, newUsd, userId }
    );

    // Record conversion transaction
    await connection.execute(
      `INSERT INTO TRANSACTIONS (USER_ID, SYMBOL, TRANSACTION_TYPE, QUANTITY, PRICE, TOTAL_AMOUNT, STATUS)
       VALUES (:userId, :pair, 'CONVERSION', :convertedAmount, :usdLkrRate, :numAmount, 'COMPLETED')`,
      { userId, pair: `${fromCurrency}/${toCurrency}`, convertedAmount, usdLkrRate, numAmount }
    );

    await connection.commit();

    const clientMeta = getClientMeta(req);
    await logAuditEvent({
      userId,
      action: 'CURRENCY_CONVERSION',
      entity: 'WALLET',
      entityId: userId,
      ipAddress: clientMeta.ip,
      userAgent: clientMeta.userAgent,
      details: `Converted ${numAmount} ${fromCurrency} -> ${convertedAmount} ${toCurrency} @ rate ${usdLkrRate}`
    });

    res.json({
      success: true,
      message: `Successfully converted ${numAmount.toLocaleString()} ${fromCurrency} to ${convertedAmount.toLocaleString()} ${toCurrency}!`,
      conversion: {
        fromCurrency,
        toCurrency,
        originalAmount: numAmount,
        convertedAmount,
        rate: usdLkrRate
      },
      wallet: {
        balanceLKR: newLkr,
        usdBalance: newUsd
      }
    });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (e) {}
    }
    console.error('Conversion Error:', error.message);
    res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Server error during currency conversion' });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) {}
    }
  }
};

const getTransactions = async (req, res) => {
  let connection;
  try {
    const userId = req.user.id;
    connection = await oracledb.getConnection();
    const result = await connection.execute(
      `SELECT TRANSACTION_ID AS ID, SYMBOL, TOTAL_AMOUNT AS AMOUNT, QUANTITY, PRICE, TRANSACTION_TYPE AS TYPE, STATUS, CREATED_AT 
       FROM TRANSACTIONS 
       WHERE USER_ID = :userId 
       ORDER BY CREATED_AT DESC 
       FETCH NEXT 20 ROWS ONLY`,
      [userId],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const formatted = result.rows.map(row => ({
      ID: row.ID,
      SYMBOL: row.SYMBOL,
      AMOUNT: parseFloat(row.AMOUNT),
      QUANTITY: parseFloat(row.QUANTITY || 0.0),
      PRICE: parseFloat(row.PRICE || 0.0),
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
    res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Server error fetching transactions' });
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
  convertCurrency,
  getTransactions
};
