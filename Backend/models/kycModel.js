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
        DOCUMENT_PATH,
        CONFIRMED_NAME,
        CONFIRMED_DOB,
        CONFIRMED_GENDER,
        CONFIRMED_DATA,
        RAW_OCR_JSON
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
        :documentPath,
        :confirmedName,
        :confirmedDob,
        :confirmedGender,
        :confirmedData,
        :rawOcrJson
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
      confirmedName: docData.confirmedName || null,
      confirmedDob: docData.confirmedDob || null,
      confirmedGender: docData.confirmedGender || null,
      confirmedData: docData.confirmedData ? JSON.stringify(docData.confirmedData).substring(0, 3999) : null,
      rawOcrJson: docData.rawOcrJson ? JSON.stringify(docData.rawOcrJson).substring(0, 3999) : null,
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
        CONFIRMED_NAME, CONFIRMED_DOB, CONFIRMED_GENDER, CONFIRMED_DATA, RAW_OCR_JSON,
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
        CONFIRMED_NAME, CONFIRMED_DOB, CONFIRMED_GENDER, CONFIRMED_DATA, RAW_OCR_JSON,
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
        CONFIRMED_NAME, CONFIRMED_DOB, CONFIRMED_GENDER, CONFIRMED_DATA, RAW_OCR_JSON,
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
 * Updates KYC document with user-reviewed & confirmed data, and sets the verification status
 * Strictly checks user ownership via USER_ID = :userId
 * @param {number} docId 
 * @param {number} userId 
 * @param {object} updateData 
 */
async function updateKYCConfirmation(docId, userId, updateData) {
  let connection;
  try {
    connection = await oracledb.getConnection();
    const sql = `
      UPDATE KYC_DOCUMENTS
      SET DOCUMENT_NUMBER = COALESCE(:documentNumber, DOCUMENT_NUMBER),
          CONFIRMED_NAME = :confirmedName,
          CONFIRMED_DOB = :confirmedDob,
          CONFIRMED_GENDER = :confirmedGender,
          CONFIRMED_DATA = :confirmedData,
          VERIFICATION_STATUS = :verificationStatus,
          REJECTION_REASON = :rejectionReason,
          VERIFIED_AT = CASE WHEN :verificationStatus = 'VERIFIED' THEN CURRENT_TIMESTAMP ELSE NULL END
      WHERE ID = :docId AND USER_ID = :userId
    `;

    const binds = {
      documentNumber: updateData.documentNumber || null,
      confirmedName: updateData.confirmedName || null,
      confirmedDob: updateData.confirmedDob || null,
      confirmedGender: updateData.confirmedGender || null,
      confirmedData: updateData.confirmedData ? JSON.stringify(updateData.confirmedData).substring(0, 3999) : null,
      verificationStatus: updateData.verificationStatus,
      rejectionReason: updateData.rejectionReason || null,
      docId,
      userId
    };

    const result = await connection.execute(sql, binds);
    await connection.commit();
    return result.rowsAffected > 0;
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (rErr) {}
    }
    throw error;
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
        k.CONFIRMED_NAME, k.CONFIRMED_DOB, k.CONFIRMED_GENDER, k.CONFIRMED_DATA,
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

/**
 * Atomically updates both KYC_DOCUMENTS and SL_USERS in a single database transaction
 * @param {number} docId 
 * @param {number} userId 
 * @param {string} status - 'VERIFIED' | 'REJECTED' | 'PENDING'
 * @param {string|null} rejectionReason 
 * @param {number|null} verifiedBy 
 * @param {string|null} nicNumber 
 */
async function updateAdminKYCDecision(docId, userId, status, rejectionReason = null, verifiedBy = null, nicNumber = null) {
  let connection;
  try {
    connection = await oracledb.getConnection();

    // 1. Update KYC Document record
    await connection.execute(
      `UPDATE KYC_DOCUMENTS
       SET VERIFICATION_STATUS = :status,
           REJECTION_REASON = :rejectionReason,
           VERIFIED_AT = CURRENT_TIMESTAMP,
           VERIFIED_BY = :verifiedBy
       WHERE ID = :docId`,
      { status, rejectionReason, verifiedBy, docId }
    );

    // 2. Update User Profile KYC Status
    await connection.execute(
      `UPDATE SL_USERS
       SET KYC_STATUS = :status,
           NIC_NUMBER = COALESCE(:nicNumber, NIC_NUMBER),
           UPDATED_AT = CURRENT_TIMESTAMP
       WHERE ID = :userId`,
      { status, nicNumber, userId }
    );

    // 3. Commit transaction atomically
    await connection.commit();
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (rErr) {}
    }
    throw error;
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
  updateKYCConfirmation,
  updateKYCStatus,
  updateUserKYCStatus,
  updateAdminKYCDecision,
  getPendingKYC
};
