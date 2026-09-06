const oracledb = require('oracledb');

/**
 * Creates a KYC verification document record in Oracle DB
 * @param {object} docData 
 * @returns {Promise<number>} created document ID
 */
async function createKYCDocument(docData) {
  let connection;
  try {
    connection = await oracledb.getConnection();
    const sql = `
      INSERT INTO KYC_DOCUMENTS (
        USER_ID,
        DOCUMENT_TYPE,
        DOCUMENT_NUMBER,
        EXTRACTED_NAME,
        EXTRACTED_DOB,
        EXTRACTED_GENDER,
        OCR_TEXT,
        OCR_CONFIDENCE,
        VERIFICATION_STATUS,
        REJECTION_REASON,
        DOCUMENT_PATH
      ) VALUES (
        :userId,
        :documentType,
        :documentNumber,
        :extractedName,
        :extractedDob,
        :extractedGender,
        :ocrText,
        :ocrConfidence,
        :verificationStatus,
        :rejectionReason,
        :documentPath
      ) RETURNING ID INTO :id
    `;

    const binds = {
      userId: docData.userId,
      documentType: docData.documentType || 'NIC',
      documentNumber: docData.documentNumber || null,
      extractedName: docData.extractedName || null,
      extractedDob: docData.extractedDob || null,
      extractedGender: docData.extractedGender || null,
      ocrText: docData.ocrText ? docData.ocrText.substring(0, 3999) : null,
      ocrConfidence: docData.ocrConfidence || 0,
      verificationStatus: docData.verificationStatus || 'PENDING',
      rejectionReason: docData.rejectionReason || null,
      documentPath: docData.documentPath || null,
      id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
    };

    const result = await connection.execute(sql, binds);
    await connection.commit();
    return result.outBinds.id[0];
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) {}
    }
  }
}

/**
 * Gets the latest KYC document for a user
 * @param {number} userId 
 */
async function getKYCByUser(userId) {
  let connection;
  try {
    connection = await oracledb.getConnection();
    const sql = `
      SELECT 
        ID, USER_ID, DOCUMENT_TYPE, DOCUMENT_NUMBER,
        EXTRACTED_NAME, EXTRACTED_DOB, EXTRACTED_GENDER,
        OCR_CONFIDENCE, VERIFICATION_STATUS, REJECTION_REASON,
        DOCUMENT_PATH, SUBMITTED_AT, VERIFIED_AT, VERIFIED_BY
      FROM KYC_DOCUMENTS
      WHERE USER_ID = :userId
      ORDER BY SUBMITTED_AT DESC
      FETCH FIRST 1 ROWS ONLY
    `;

    const result = await connection.execute(sql, [userId], { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return result.rows[0] || null;
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) {}
    }
  }
}

/**
 * Gets all KYC history for a user
 * @param {number} userId 
 */
async function getKYCHistory(userId) {
  let connection;
  try {
    connection = await oracledb.getConnection();
    const sql = `
      SELECT 
        ID, USER_ID, DOCUMENT_TYPE, DOCUMENT_NUMBER,
        EXTRACTED_NAME, EXTRACTED_DOB, EXTRACTED_GENDER,
        OCR_CONFIDENCE, VERIFICATION_STATUS, REJECTION_REASON,
        SUBMITTED_AT, VERIFIED_AT
      FROM KYC_DOCUMENTS
      WHERE USER_ID = :userId
      ORDER BY SUBMITTED_AT DESC
    `;

    const result = await connection.execute(sql, [userId], { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return result.rows;
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) {}
    }
  }
}

/**
 * Gets KYC record by ID
 * @param {number} id 
 */
async function getKYCById(id) {
  let connection;
  try {
    connection = await oracledb.getConnection();
    const sql = `
      SELECT 
        ID, USER_ID, DOCUMENT_TYPE, DOCUMENT_NUMBER,
        EXTRACTED_NAME, EXTRACTED_DOB, EXTRACTED_GENDER,
        OCR_TEXT, OCR_CONFIDENCE, VERIFICATION_STATUS, REJECTION_REASON,
        DOCUMENT_PATH, SUBMITTED_AT, VERIFIED_AT, VERIFIED_BY
      FROM KYC_DOCUMENTS
      WHERE ID = :id
    `;

    const result = await connection.execute(sql, [id], { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return result.rows[0] || null;
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) {}
    }
  }
}

/**
 * Updates KYC Document status (for admin approval/rejection or auto-decision)
 * @param {number} id 
 * @param {string} status 
 * @param {string|null} rejectionReason 
 * @param {number|null} verifiedBy 
 */
async function updateKYCStatus(id, status, rejectionReason = null, verifiedBy = null) {
  let connection;
  try {
    connection = await oracledb.getConnection();
    const sql = `
      UPDATE KYC_DOCUMENTS
      SET VERIFICATION_STATUS = :status,
          REJECTION_REASON = :rejectionReason,
          VERIFIED_AT = CURRENT_TIMESTAMP,
          VERIFIED_BY = :verifiedBy
      WHERE ID = :id
    `;

    await connection.execute(sql, { status, rejectionReason, verifiedBy, id });
    await connection.commit();
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) {}
    }
  }
}

/**
 * Updates user's KYC status and NIC number on SL_USERS table
 * @param {number} userId 
 * @param {string} status - 'VERIFIED' | 'PENDING' | 'REJECTED' | 'NOT_SUBMITTED'
 * @param {string|null} nicNumber 
 */
async function updateUserKYCStatus(userId, status, nicNumber = null) {
  let connection;
  try {
    connection = await oracledb.getConnection();
    const sql = `
      UPDATE SL_USERS
      SET KYC_STATUS = :status,
          NIC_NUMBER = COALESCE(:nicNumber, NIC_NUMBER),
          UPDATED_AT = CURRENT_TIMESTAMP
      WHERE ID = :userId
    `;

    await connection.execute(sql, { status, nicNumber, userId });
    await connection.commit();
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) {}
    }
  }
}

/**
 * Retrieves pending KYC applications for admin review
 * @param {number} limit 
 */
async function getPendingKYC(limit = 20) {
  let connection;
  try {
    connection = await oracledb.getConnection();
    const sql = `
      SELECT 
        k.ID, k.USER_ID, u.NAME AS USER_NAME, u.EMAIL AS USER_EMAIL,
        k.DOCUMENT_TYPE, k.DOCUMENT_NUMBER, k.EXTRACTED_NAME,
        k.EXTRACTED_DOB, k.EXTRACTED_GENDER, k.OCR_CONFIDENCE,
        k.VERIFICATION_STATUS, k.DOCUMENT_PATH, k.SUBMITTED_AT
      FROM KYC_DOCUMENTS k
      JOIN SL_USERS u ON k.USER_ID = u.ID
      WHERE k.VERIFICATION_STATUS = 'PENDING'
      ORDER BY k.SUBMITTED_AT ASC
      FETCH FIRST :limit ROWS ONLY
    `;

    const result = await connection.execute(sql, { limit }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return result.rows;
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) {}
    }
  }
}

module.exports = {
  createKYCDocument,
  getKYCByUser,
  getKYCHistory,
  getKYCById,
  updateKYCStatus,
  updateUserKYCStatus,
  getPendingKYC
};
