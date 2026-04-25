const oracledb = require('oracledb');

const createAlert = async (userId, symbol, targetPrice, alertType) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    const result = await connection.execute(
      `INSERT INTO SL_ALERTS (USER_ID, SYMBOL, TARGET_PRICE, ALERT_TYPE) 
       VALUES (:userId, :symbol, :targetPrice, :alertType)`,
      { userId, symbol, targetPrice, alertType },
      { autoCommit: true }
    );
    return result;
  } catch (err) {
    console.error('Error creating alert:', err.message);
    throw err;
  } finally {
    if (connection) await connection.close();
  }
};

const getActiveAlerts = async () => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    const result = await connection.execute(
      `SELECT a.ID, a.USER_ID, a.SYMBOL, a.TARGET_PRICE, a.ALERT_TYPE, u.EMAIL, u.EXPO_PUSH_TOKEN 
       FROM SL_ALERTS a
       JOIN SL_USERS u ON a.USER_ID = u.ID
       WHERE a.IS_ACTIVE = 1`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return result.rows;
  } catch (err) {
    console.error('Error fetching active alerts:', err.message);
    throw err;
  } finally {
    if (connection) await connection.close();
  }
};

const getUserAlerts = async (userId) => {
    let connection;
    try {
      connection = await oracledb.getConnection();
      const result = await connection.execute(
        `SELECT * FROM SL_ALERTS WHERE USER_ID = :userId ORDER BY CREATED_AT DESC`,
        { userId },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      return result.rows;
    } catch (err) {
      console.error('Error fetching user alerts:', err.message);
      throw err;
    } finally {
      if (connection) await connection.close();
    }
  };

const markAlertTriggered = async (alertId) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    await connection.execute(
      `UPDATE SL_ALERTS SET IS_ACTIVE = 0 WHERE ID = :alertId`,
      { alertId },
      { autoCommit: true }
    );
  } catch (err) {
    console.error('Error marking alert triggered:', err.message);
    throw err;
  } finally {
    if (connection) await connection.close();
  }
};

const deleteAlert = async (alertId, userId) => {
    let connection;
    try {
      connection = await oracledb.getConnection();
      await connection.execute(
        `DELETE FROM SL_ALERTS WHERE ID = :alertId AND USER_ID = :userId`,
        { alertId, userId },
        { autoCommit: true }
      );
    } catch (err) {
      console.error('Error deleting alert:', err.message);
      throw err;
    } finally {
      if (connection) await connection.close();
    }
  };

module.exports = {
  createAlert,
  getActiveAlerts,
  markAlertTriggered,
  getUserAlerts,
  deleteAlert
};
