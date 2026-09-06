const oracledb = require('oracledb');

/**
 * Log an audit event into SL_AUDIT_LOGS table.
 * Supports security events, trading actions, KYC approvals, and admin events.
 */
async function logAuditEvent({ userId = null, action, entity, entityId = null, ipAddress = null, userAgent = null, details = null, status = 'SUCCESS' }) {
  let connection;
  try {
    connection = await oracledb.getConnection();
    const detailsStr = typeof details === 'object' ? JSON.stringify(details) : details;
    
    await connection.execute(
      `INSERT INTO SL_AUDIT_LOGS (USER_ID, ACTION, ENTITY, ENTITY_ID, IP_ADDRESS, USER_AGENT, DETAILS, STATUS)
       VALUES (:userId, :action, :entity, :entityId, :ipAddress, :userAgent, :detailsStr, :status)`,
      {
        userId,
        action,
        entity,
        entityId: entityId ? String(entityId) : null,
        ipAddress: ipAddress ? String(ipAddress).substring(0, 64) : '127.0.0.1',
        userAgent: userAgent ? String(userAgent).substring(0, 255) : 'SmartLanka-Client/1.0',
        detailsStr: detailsStr ? String(detailsStr).substring(0, 1000) : null,
        status: status || 'SUCCESS'
      },
      { autoCommit: true }
    );
  } catch (err) {
    // Non-blocking fallback to console if DB fails so main execution continues
    console.warn(`[AUDIT LOG FAILED] action=${action} entity=${entity}: ${err.message}`);
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) {}
    }
  }
}

async function getRecentAuditLogs(limit = 50) {
  let connection;
  try {
    connection = await oracledb.getConnection();
    const result = await connection.execute(
      `SELECT AUDIT_ID, USER_ID, ACTION, ENTITY, ENTITY_ID, IP_ADDRESS, USER_AGENT, DETAILS, STATUS, CREATED_AT
       FROM SL_AUDIT_LOGS
       ORDER BY CREATED_AT DESC
       FETCH NEXT :limit ROWS ONLY`,
      { limit },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return result.rows || [];
  } catch (err) {
    console.error('Error fetching audit logs:', err.message);
    return [];
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) {}
    }
  }
}

module.exports = {
  logAuditEvent,
  getRecentAuditLogs
};
