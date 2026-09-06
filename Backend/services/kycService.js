const oracledb = require('oracledb');
const userModel = require('../models/userModel');
const { logAuditEvent } = require('./auditService');

/**
 * SMARTLANKA TRADE — OCR KYC EXTRACTION & VERIFICATION SERVICE
 * Parses Sri Lankan NIC (National Identity Card) and Passport documents
 */

// Parse Sri Lankan NIC format (Old 9-digit + V/X or New 12-digit)
function parseSriLankanNIC(nicInput) {
  const nic = nicInput.trim().toUpperCase().replace(/[\s-]/g, '');
  
  let birthYear = null;
  let dayOfYear = null;
  let gender = 'MALE';
  let isValid = false;

  // Old Format: 9 digits + 'V' or 'X' (e.g. 920450239V)
  const oldRegex = /^([0-9]{2})([0-9]{3})([0-9]{4})([VX])$/;
  // New Format: 12 digits (e.g. 199204502391)
  const newRegex = /^([0-9]{4})([0-9]{3})([0-9]{5})$/;

  if (oldRegex.test(nic)) {
    const match = nic.match(oldRegex);
    birthYear = 1900 + parseInt(match[1], 10);
    dayOfYear = parseInt(match[2], 10);
    isValid = true;
  } else if (newRegex.test(nic)) {
    const match = nic.match(newRegex);
    birthYear = parseInt(match[1], 10);
    dayOfYear = parseInt(match[2], 10);
    isValid = true;
  }

  if (isValid && dayOfYear) {
    if (dayOfYear > 500) {
      gender = 'FEMALE';
      dayOfYear -= 500;
    }
    // Estimate Month & Day
    const date = new Date(birthYear, 0, dayOfYear);
    const dobFormatted = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${birthYear}`;
    
    return {
      isValid: true,
      nicNumber: nic,
      birthYear,
      dob: dobFormatted,
      gender
    };
  }

  return {
    isValid: false,
    nicNumber: nic,
    error: 'NIC format does not match Sri Lankan 9-digit (old) or 12-digit (new) standards.'
  };
}

async function submitKYCDocument(userId, { docType = 'SRI_LANKAN_NIC', nicNumber, fullName, dob, ocrRawText, clientMeta = {} }) {
  const parsed = parseSriLankanNIC(nicNumber);
  if (!parsed.isValid) {
    const err = new Error(parsed.error);
    err.code = 'INVALID_NIC_FORMAT';
    err.status = 422;
    throw err;
  }

  const finalDob = dob || parsed.dob;
  const finalGender = parsed.gender;
  let connection;

  try {
    connection = await oracledb.getConnection();

    await connection.execute(
      `MERGE INTO SL_KYC_DOCUMENTS k
       USING (SELECT :userId AS user_id FROM dual) src
       ON (k.user_id = src.user_id)
       WHEN MATCHED THEN
         UPDATE SET k.doc_type = :docType,
                    k.nic_number = :nicNumber,
                    k.full_name = :fullName,
                    k.dob = :finalDob,
                    k.gender = :finalGender,
                    k.status = 'VERIFIED',
                    k.ocr_raw_text = :ocrRawText,
                    k.verified_at = CURRENT_TIMESTAMP
       WHEN NOT MATCHED THEN
         INSERT (USER_ID, DOC_TYPE, NIC_NUMBER, FULL_NAME, DOB, GENDER, STATUS, OCR_RAW_TEXT, VERIFIED_AT)
         VALUES (:userId, :docType, :nicNumber, :fullName, :finalDob, :finalGender, 'VERIFIED', :ocrRawText, CURRENT_TIMESTAMP)`,
      {
        userId,
        docType: docType || 'SRI_LANKAN_NIC',
        nicNumber: parsed.nicNumber,
        fullName: fullName ? fullName.trim().toUpperCase() : 'VERIFIED INVESTOR',
        finalDob,
        finalGender,
        ocrRawText: ocrRawText || `OCR EXTR: ${parsed.nicNumber} | ${fullName}`
      },
      { autoCommit: true }
    );

    // Update User KYC Status
    await userModel.updateKycStatus(userId, 'VERIFIED');

    await logAuditEvent({
      userId,
      action: 'KYC_AUTO_VERIFIED',
      entity: 'KYC',
      entityId: parsed.nicNumber,
      ipAddress: clientMeta.ip,
      userAgent: clientMeta.userAgent,
      details: `OCR KYC verified for NIC: ${parsed.nicNumber}, Name: ${fullName}`
    });

    return {
      success: true,
      status: 'VERIFIED',
      message: 'Identity verification completed successfully! Your account is now Tier 2 Verified.',
      extractedData: {
        docType,
        nicNumber: parsed.nicNumber,
        fullName: fullName.trim().toUpperCase(),
        dateOfBirth: finalDob,
        gender: finalGender,
        tier: 'Tier 2 (CSE Trader)'
      }
    };
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) {}
    }
  }
}

async function getKYCStatus(userId) {
  let connection;
  try {
    connection = await oracledb.getConnection();
    const result = await connection.execute(
      `SELECT DOC_TYPE, NIC_NUMBER, FULL_NAME, DOB, GENDER, STATUS, VERIFIED_AT, CREATED_AT 
       FROM SL_KYC_DOCUMENTS WHERE USER_ID = :userId`,
      [userId],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (result.rows.length === 0) {
      return {
        status: 'UNVERIFIED',
        tier: 'Tier 1 (Unverified)',
        isVerified: false
      };
    }

    const doc = result.rows[0];
    return {
      status: doc.STATUS,
      isVerified: doc.STATUS === 'VERIFIED',
      tier: doc.STATUS === 'VERIFIED' ? 'Tier 2 (CSE Verified)' : 'Tier 1 (Pending)',
      document: {
        docType: doc.DOC_TYPE,
        nicNumber: doc.NIC_NUMBER,
        fullName: doc.FULL_NAME,
        dob: doc.DOB,
        gender: doc.GENDER,
        verifiedAt: doc.VERIFIED_AT
      }
    };
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) {}
    }
  }
}

module.exports = {
  parseSriLankanNIC,
  submitKYCDocument,
  getKYCStatus
};
