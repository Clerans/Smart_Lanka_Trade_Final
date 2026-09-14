const oracledb = require('oracledb');
const paymentService = require('../services/paymentService');
const walletFundingService = require('../services/walletFundingService');
const userModel = require('../models/userModel');

/**
 * 1. Get complete wallet details
 */
const getWalletDetails = async (req, res) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Authentication required.' });
  }
  let connection;
  try {
    const userId = req.user.id;
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

    // 3. Get user UID
    const user = await userModel.findById(userId);

    res.json({
      success: true,
      balanceLKR,
      investedAmount,
      availableBalance,
      accountUid: user ? user.ACCOUNT_UID : null
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

/**
 * 2. Get wallet balance
 */
const getWalletBalance = async (req, res) => {
  let connection;
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Authentication required.' });
    }
    const userId = req.user.id;
    
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

/**
 * 3. Deposit Money (Full Payment Lifecycle via PaymentService)
 */
const depositMoney = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Authentication required.' });
    }
    const { amount, method = 'CARD', idempotencyKey, simulateFailure } = req.body;
    const userId = req.user.id;

    // Phase 1: Initiate payment intent via payment provider
    const initResult = await paymentService.initiateDeposit({
      userId,
      amount,
      method,
      idempotencyKey,
      metadata: { simulateFail: !!simulateFailure }
    });

    if (!initResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Deposit initialization failed.'
      });
    }

    // Phase 2: Settle payment with provider
    const settleResult = await paymentService.verifyAndSettleDeposit({
      userId,
      transactionId: initResult.transactionId,
      providerReference: initResult.providerReference,
      simulateFailure: !!simulateFailure
    });

    res.json({
      success: true,
      message: settleResult.message,
      data: settleResult
    });
  } catch (error) {
    console.error('Deposit Error:', error.message);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Server error during deposit processing.'
    });
  }
};

/**
 * 4. Initiate Deposit (2-step flow)
 */
const initiateDeposit = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Authentication required.' });
    }
    const { amount, method = 'CARD', idempotencyKey } = req.body;
    const userId = req.user.id;

    const result = await paymentService.initiateDeposit({
      userId,
      amount,
      method,
      idempotencyKey
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Initiate Deposit Error:', error.message);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Server error initiating deposit.'
    });
  }
};

/**
 * 5. Verify Deposit (2-step flow)
 */
const verifyDeposit = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Authentication required.' });
    }
    const { transactionId, providerReference, simulateFailure } = req.body;
    const userId = req.user.id;

    const result = await paymentService.verifyAndSettleDeposit({
      userId,
      transactionId,
      providerReference,
      simulateFailure: !!simulateFailure
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Verify Deposit Error:', error.message);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Server error verifying deposit.'
    });
  }
};

/**
 * 6. Request Withdrawal
 */
const requestWithdrawal = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Authentication required.' });
    }
    const { amount, method = 'BANK_ACCOUNT', destination, bankName, idempotencyKey } = req.body;
    const userId = req.user.id;

    const result = await walletFundingService.requestWithdrawal({
      userId,
      amount,
      method,
      destination,
      bankName,
      idempotencyKey
    });

    res.json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    console.error('Withdrawal Error:', error.message);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Server error processing withdrawal.'
    });
  }
};

/**
 * 7. Recipient Lookup by UID
 */
const lookupRecipient = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Authentication required.' });
    }
    const { uid } = req.params;
    const senderUserId = req.user.id;

    const result = await walletFundingService.lookupRecipient(uid, senderUserId);
    res.json({
      success: true,
      data: result.recipient
    });
  } catch (error) {
    console.error('Recipient Lookup Error:', error.message);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Error looking up recipient.'
    });
  }
};

/**
 * 8. Internal Transfer
 */
const executeTransfer = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Authentication required.' });
    }
    const { recipientUid, amount, message, idempotencyKey } = req.body;
    const senderUserId = req.user.id;

    const result = await walletFundingService.executeInternalTransfer({
      senderUserId,
      recipientUid,
      amount,
      message,
      idempotencyKey
    });

    res.json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    console.error('Transfer Error:', error.message);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Server error executing internal transfer.'
    });
  }
};

/**
 * 9. Get Transactions History
 */
const getTransactions = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Authentication required.' });
    }
    const userId = req.user.id;
    const { limit = 20, type = 'ALL' } = req.query;

    const formatted = await walletFundingService.getTransactionHistory({
      userId,
      limit: parseInt(limit, 10),
      type
    });

    res.json({
      success: true,
      data: formatted
    });
  } catch (error) {
    console.error('Transactions Fetch Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Server error fetching transactions'
    });
  }
};

/**
 * 10. Get Single Transaction Details
 */
const getTransactionDetails = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Authentication required.' });
    }
    const { id } = req.params;
    const userId = req.user.id;

    const details = await walletFundingService.getTransactionDetails(id, userId);
    res.json({
      success: true,
      data: details
    });
  } catch (error) {
    console.error('Transaction Details Fetch Error:', error.message);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Server error fetching transaction details.'
    });
  }
};

module.exports = {
  getWalletDetails,
  getWalletBalance,
  depositMoney,
  initiateDeposit,
  verifyDeposit,
  requestWithdrawal,
  lookupRecipient,
  executeTransfer,
  getTransactions,
  getTransactionDetails
};
