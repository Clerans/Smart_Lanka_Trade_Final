const oracledb = require('oracledb');
const userModel = require('../models/userModel');
const { getRecentAuditLogs } = require('../services/auditService');
const marketService = require('../services/marketService');

exports.getDashboardStats = async (req, res) => {
  let connection;
  try {
    connection = await oracledb.getConnection();

    // 1. Total users
    const usersRes = await connection.execute(
      `SELECT COUNT(*) AS TOTAL_USERS,
              SUM(CASE WHEN IS_VERIFIED = 1 THEN 1 ELSE 0 END) AS VERIFIED_USERS,
              SUM(CASE WHEN KYC_STATUS = 'VERIFIED' THEN 1 ELSE 0 END) AS KYC_VERIFIED
       FROM SL_USERS`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    // 2. Trading stats
    const tradeRes = await connection.execute(
      `SELECT COUNT(*) AS TOTAL_TRADES,
              NVL(SUM(TOTAL_AMOUNT), 0) AS TOTAL_VOLUME_LKR
       FROM TRANSACTIONS`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const quotes = await marketService.getAllStockQuotes();

    res.json({
      success: true,
      systemHealth: {
        status: 'HEALTHY',
        database: 'Oracle Database 23ai / Express Connected',
        marketDataProvider: 'CSE Real-Time Cache Active',
        aiService: 'LSTM & ARIMA Predictor Operational',
        uptime: process.uptime()
      },
      metrics: {
        totalUsers: usersRes.rows[0].TOTAL_USERS,
        verifiedUsers: usersRes.rows[0].VERIFIED_USERS,
        kycVerifiedUsers: usersRes.rows[0].KYC_VERIFIED,
        totalTradesExecuted: tradeRes.rows[0].TOTAL_TRADES,
        totalVolumeLKR: parseFloat(tradeRes.rows[0].TOTAL_VOLUME_LKR),
        activeStocksCount: quotes.length
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      code: 'ADMIN_ERROR',
      message: err.message || 'Error loading dashboard statistics.'
    });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) {}
    }
  }
};

exports.getUsers = async (req, res) => {
  try {
    const users = await userModel.findAllUsers();
    res.json({
      success: true,
      total: users.length,
      users
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      code: 'ADMIN_ERROR',
      message: err.message || 'Error loading users.'
    });
  }
};

exports.getAuditLogs = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const logs = await getRecentAuditLogs(limit);
    res.json({
      success: true,
      total: logs.length,
      logs
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      code: 'ADMIN_ERROR',
      message: err.message || 'Error loading audit logs.'
    });
  }
};

exports.updateUserRole = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role || !['INVESTOR', 'ADMIN'].includes(role.toUpperCase())) {
      return res.status(422).json({
        success: false,
        code: 'INVALID_ROLE',
        message: "Role must be 'INVESTOR' or 'ADMIN'."
      });
    }

    connection = await oracledb.getConnection();
    await connection.execute(
      `UPDATE SL_USERS SET ROLE = :role, UPDATED_AT = CURRENT_TIMESTAMP WHERE ID = :id`,
      { role: role.toUpperCase(), id },
      { autoCommit: true }
    );

    res.json({
      success: true,
      message: `User role updated to ${role.toUpperCase()}`
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      code: 'ADMIN_ERROR',
      message: err.message || 'Error updating user role.'
    });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) {}
    }
  }
};
