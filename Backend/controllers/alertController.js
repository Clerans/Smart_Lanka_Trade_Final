const alertModel = require('../models/alertModel');
const userModel = require('../models/userModel'); // Assuming it exists to save push token

exports.createAlert = async (req, res) => {
  try {
    const { symbol, targetPrice, alertType } = req.body;
    const userId = req.user.id; // From auth middleware

    if (!symbol || !targetPrice || !alertType) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    await alertModel.createAlert(userId, symbol, targetPrice, alertType);
    res.status(201).json({ message: 'Alert created successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getUserAlerts = async (req, res) => {
  try {
    const userId = req.user.id;
    const alerts = await alertModel.getUserAlerts(userId);
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    await alertModel.deleteAlert(id, userId);
    res.json({ message: 'Alert deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.savePushToken = async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user.id;

    if (!token) return res.status(400).json({ error: 'Token is required' });

    // Update user's push token in DB
    const oracledb = require('oracledb');
    let connection;
    try {
      connection = await oracledb.getConnection();
      await connection.execute(
        `UPDATE SL_USERS SET EXPO_PUSH_TOKEN = :token WHERE ID = :userId`,
        { token, userId },
        { autoCommit: true }
      );
      res.json({ message: 'Push token saved successfully' });
    } finally {
      if (connection) await connection.close();
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
