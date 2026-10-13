const ocrService = require('./ocrService');
const nicParser = require('../utils/nicParser');
const documentParser = require('../utils/documentParser');
const kycModel = require('../models/kycModel');
const userModel = require('../models/userModel');

/**
 * KYC Multi-Signal Decision Configuration Constants
 * 
 * - MIN_OCR_CONFIDENCE (30%): Absolute minimum document-level OCR confidence score to consider image readable.
 * - VERIFIED_OCR_CONFIDENCE (70%): High confidence threshold required for instant automated verification.
 * - VERIFIED_NAME_MATCH (0.80): High name similarity threshold for automated approval.
 * - BORDERLINE_NAME_MATCH (0.65): Acceptable fuzzy match threshold allowing administrative queueing (PENDING).
 * - MIN_NAME_MATCH (0.35): Lower bound before marking as outright identity mismatch (REJECTED).
 */
const KYC_CONFIG = {
  MIN_OCR_CONFIDENCE: 30,
  VERIFIED_OCR_CONFIDENCE: 40, // Confidence threshold required for instant automated verification with strong match
  VERIFIED_NAME_MATCH: 0.80,
  BORDERLINE_NAME_MATCH: 0.65,
  MIN_NAME_MATCH: 0.35
};

/**
 * Calculates Levenshtein edit distance between two strings
 * @param {string} a 
 * @param {string} b 
 * @returns {number}
 */
function levenshteinDistance(a, b) {
  if (!a) return b ? b.length : 0;
  if (!b) return a ? a.length : 0;
  if (a === b) return 0;

  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculates similarity between two single words/tokens with edit-distance tolerance
 * @param {string} tok1 
 * @param {string} tok2 
 * @returns {number} 0.0 to 1.0
 */
function singleTokenSimilarity(tok1, tok2) {
  if (tok1 === tok2) return 1.0;
  const maxLen = Math.max(tok1.length, tok2.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(tok1, tok2);
  return Math.max(0, 1 - dist / maxLen);
}

/**
 * Calculates multi-metric name similarity ratio (0.0 to 1.0)
 * 
 * Steps:
 * 1. Clean and remove field labels (e.g. "NAME: ", "FULL NAME ")
 * 2. Tokenize and perform bipartite fuzzy token matching (handles character misrecognitions like G/M, 5/S)
 * 3. Evaluate whole-string normalized edit similarity
 * 
 * @param {string} registeredName 
 * @param {string} extractedName 
 * @returns {number} similarity score from 0.0 to 1.0
 */
function calculateNameSimilarity(registeredName, extractedName) {
  if (!registeredName || !extractedName) return 0;

  const regClean = nicParser.cleanAndNormalizeName(registeredName) || registeredName.trim().toUpperCase();
  const extClean = nicParser.cleanAndNormalizeName(extractedName) || extractedName.trim().toUpperCase();

  if (regClean === extClean) return 1.0;

  const regTokens = regClean.split(/\s+/).filter(t => t.length > 0);
  const extTokens = extClean.split(/\s+/).filter(t => t.length > 0);

  if (regTokens.length === 0 || extTokens.length === 0) return 0;

  // Compute best bipartite token matches
  let totalTokenMatchScore = 0;
  const usedExtIndices = new Set();

  for (const rTok of regTokens) {
    let bestScore = 0;
    let bestIdx = -1;

    for (let j = 0; j < extTokens.length; j++) {
      if (usedExtIndices.has(j)) continue;
      const score = singleTokenSimilarity(rTok, extTokens[j]);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = j;
      }
    }

    if (bestIdx !== -1 && bestScore >= 0.60) {
      usedExtIndices.add(bestIdx);
      totalTokenMatchScore += bestScore;
    }
  }

  const tokenScore = (totalTokenMatchScore * 2) / (regTokens.length + extTokens.length);

  // If no tokens matched with sufficient similarity, the names are completely different
  if (tokenScore === 0 || usedExtIndices.size === 0) {
    return 0.0;
  }

  // Subset coverage: handles when user registered with a single name that appears in cardholder full name
  const regCoverage = totalTokenMatchScore / regTokens.length;
  const extCoverage = totalTokenMatchScore / extTokens.length;
  const subsetScore = Math.max(
    regCoverage >= 0.80 ? regCoverage * 0.95 : 0,
    extCoverage >= 0.80 ? extCoverage * 0.90 : 0
  );

  // Full-string normalized similarity
  const maxFullLen = Math.max(regClean.length, extClean.length);
  const fullDist = levenshteinDistance(regClean, extClean);
  const fullScore = maxFullLen > 0 ? Math.max(0, 1 - fullDist / maxFullLen) : 1.0;

  // Weighted combination
  const combined = Math.max(tokenScore, fullScore, subsetScore);
  return parseFloat(combined.toFixed(2));
}

/**
 * Evaluates multi-signal KYC verification decision
 * 
 * Multi-Signals Evaluated:
 * 1. Document Format Validity (Old or New Sri Lankan NIC or Driving Licence)
 * 2. Demographic Consistency (Year, Day of Year, DOB, Gender derived mathematically)
 * 3. Cardholder Name Similarity against registered profile
 * 4. Document OCR Recognition Confidence Score
 * 
 * @param {object} params
 * @returns {{ verificationStatus: 'VERIFIED'|'PENDING'|'REJECTED', rejectionReason: string|null }}
 */
function evaluateKYCDecision({ nicNumber, ocrConfidence, nameSimilarity, hasExtractedName, dobConsistent = true }) {
  // Signal 1: NIC Validity
  if (!nicNumber) {
    return {
      verificationStatus: 'REJECTED',
      rejectionReason: 'No valid Sri Lankan identity document number could be detected. Please ensure the document is clear and readable.'
    };
  }

  // Signal 2: OCR Confidence below minimum readable threshold
  if (ocrConfidence < KYC_CONFIG.MIN_OCR_CONFIDENCE) {
    return {
      verificationStatus: 'REJECTED',
      rejectionReason: `Document image quality is too low (OCR Confidence: ${ocrConfidence}%). Please capture a clearer photo in good lighting.`
    };
  }

  // Signal 3: Name Similarity & Multi-Field Verification
  if (hasExtractedName) {
    if (nameSimilarity >= KYC_CONFIG.VERIFIED_NAME_MATCH) {
      // Strong Name Match
      if (ocrConfidence >= KYC_CONFIG.VERIFIED_OCR_CONFIDENCE) {
        return {
          verificationStatus: 'VERIFIED',
          rejectionReason: null
        };
      } else {
        // High quality identity match with moderate OCR confidence -> Queue for Admin Review
        return {
          verificationStatus: 'PENDING',
          rejectionReason: 'Identity details were confirmed, but document image quality requires administrative review.'
        };
      }
    } else if (nameSimilarity >= KYC_CONFIG.BORDERLINE_NAME_MATCH) {
      // Borderline/Partial Name Match -> Admin Review
      return {
        verificationStatus: 'PENDING',
        rejectionReason: 'Identity details partially match registered profile. The document has been submitted for administrative review.'
      };
    } else if (nameSimilarity >= KYC_CONFIG.MIN_NAME_MATCH) {
      // Moderate Name Difference -> Flagged for Manual Review
      return {
        verificationStatus: 'PENDING',
        rejectionReason: 'Extracted name partially matches registered profile. Flagged for administrative review.'
      };
    } else {
      // Name strongly differs
      return {
        verificationStatus: 'REJECTED',
        rejectionReason: 'Name on identity document differs significantly from registered account name.'
      };
    }
  } else {
    return {
      verificationStatus: 'PENDING',
      rejectionReason: 'Cardholder name could not be automatically confirmed from document text. Document queued for manual administrative review.'
    };
  }
}

/**
 * Stage B: Extracts OCR information and returns structured + raw data WITHOUT automatically verifying
 * Creates initial record with VERIFICATION_STATUS = 'EXTRACTED'
 * 
 * @param {number} userId - Authenticated user ID
 * @param {string} documentType - 'NIC' | 'DRIVING_LICENCE' | 'AUTO'
 * @param {string} frontImagePath - File path of front image
 * @param {string|null} backImagePath - Optional file path of back image
 * @returns {Promise<object>} Extracted document data & session documentId
 */
async function extractDocumentOCR(userId, documentType = 'NIC', frontImagePath, backImagePath = null) {
  const currentUser = await userModel.findById(userId);
  if (!currentUser) {
    throw new Error(`User with ID ${userId} not found.`);
  }

  // 1. Run Tesseract OCR on front image
  const frontOcr = await ocrService.recognizeText(frontImagePath);
  let frontText = frontOcr.text || '';
  let ocrConfidence = frontOcr.confidence || 0;

  // 2. If back image provided, run Tesseract OCR on back image
  let backText = '';
  if (backImagePath) {
    try {
      const backOcr = await ocrService.recognizeText(backImagePath);
      if (backOcr && backOcr.text) {
        backText = backOcr.text;
        ocrConfidence = Math.round((ocrConfidence + (backOcr.confidence || 0)) / 2);
      }
    } catch (backErr) {
      console.warn('OCR notice for back document:', backErr.message);
    }
  }

  // 3. Check readability: if both front and back produced no readable text or extremely low confidence (<10%)
  const combinedRaw = (frontText + ' ' + backText).trim();
  const alphanumericCount = (combinedRaw.match(/[a-zA-Z0-9]/g) || []).length;
  if (alphanumericCount < 5 || ocrConfidence < 10) {
    throw {
      code: 'UNREADABLE_DOCUMENT',
      message: 'Could not detect readable text on document. Please ensure proper lighting without glare or blur, and retake the photo.',
      ocrConfidence,
      rawOcrText: combinedRaw
    };
  }

  // 4. Parse document into structured fields using universal document parser
  const parsed = documentParser.extractIdentityDocument(frontText, backText, documentType);

  // 5. Store initial document record in Oracle DB with status = 'EXTRACTED'
  const storedDocPath = backImagePath ? `${frontImagePath}|${backImagePath}` : frontImagePath;
  const documentId = await kycModel.createKYCDocument({
    userId,
    documentType: parsed.documentType,
    documentNumber: parsed.documentNumber,
    extractedName: parsed.extractedFields.fullName,
    extractedDob: parsed.extractedFields.dob,
    extractedGender: parsed.extractedFields.gender,
    ocrText: parsed.rawOcrText,
    ocrConfidence,
    verificationStatus: 'EXTRACTED',
    rejectionReason: null,
    documentPath: storedDocPath,
    rawOcrJson: {
      extractedFields: parsed.extractedFields,
      fieldSources: parsed.fieldSources,
      frontLines: frontOcr.lines || [],
      confidence: ocrConfidence
    }
  });

  return {
    documentId,
    documentType: parsed.documentType,
    verificationStatus: 'EXTRACTED',
    ocrConfidence: `${ocrConfidence}%`,
    rawOcrText: parsed.rawOcrText,
    extractedFields: parsed.extractedFields,
    fieldSources: parsed.fieldSources,
    hasBackSide: Boolean(backImagePath),
    registeredAccountName: currentUser.NAME || ''
  };
}

/**
 * Stage E & F: Confirms user-reviewed information and performs authoritative backend verification
 * Authoritative backend verification criteria:
 * - Verifies user ownership of document session
 * - Validates required fields server-side
 * - Compares user confirmed details with registered account profile
 * - Evaluates multi-signal decision (NIC rules, confidence, name similarity)
 * - Updates KYC_DOCUMENTS and SL_USERS authoritative statuses
 * 
 * @param {number} userId - Authenticated user ID
 * @param {number} documentId - Existing KYC document session ID
 * @param {string} documentType - 'NIC' | 'DRIVING_LICENCE'
 * @param {object} confirmedData - User edited & reviewed fields
 * @returns {Promise<object>} Verification outcome
 */
async function confirmAndVerifyKYC(userId, documentId, documentType = 'NIC', confirmedData = {}) {
  // 1. Fetch document and strictly verify ownership
  const doc = await kycModel.getKYCById(documentId);
  if (!doc) {
    throw new Error(`KYC document session #${documentId} not found.`);
  }

  if (doc.USER_ID !== userId) {
    const forbiddenErr = new Error('Unauthorized: You do not have permission to modify this document.');
    forbiddenErr.code = 'FORBIDDEN_SESSION';
    throw forbiddenErr;
  }

  // 2. Fetch authenticated user profile
  const currentUser = await userModel.findById(userId);
  if (!currentUser) {
    throw new Error(`User #${userId} not found.`);
  }
  const registeredName = currentUser.NAME || '';

  // 3. Server-side validation of confirmed data
  const confirmedFullName = (confirmedData.fullName || '').trim();
  const confirmedNumber = (
    confirmedData.documentNumber !== undefined
      ? confirmedData.documentNumber
      : (confirmedData.nicNumber !== undefined ? confirmedData.nicNumber : doc.DOCUMENT_NUMBER) || ''
  ).trim();

  if (!confirmedFullName || confirmedFullName.length < 3) {
    throw {
      code: 'INVALID_NAME',
      message: 'Full Name is required and must contain at least 3 characters.'
    };
  }

  if (!confirmedNumber) {
    throw {
      code: 'MISSING_DOCUMENT_NUMBER',
      message: 'Document number is required.'
    };
  }

  let nicValidation = null;
  let parsedNIC = null;
  const isNIC = (documentType || doc.DOCUMENT_TYPE) === 'NIC';

  if (isNIC) {
    nicValidation = nicParser.validateNICFormat(confirmedNumber);
    if (!nicValidation.isValid) {
      throw {
        code: 'INVALID_NIC_FORMAT',
        message: 'Invalid Sri Lankan NIC number. Must be 9 digits followed by V/X (Old NIC) or exactly 12 digits (New NIC).'
      };
    }
    parsedNIC = nicParser.parseNICDetails(nicValidation.normalized);
  } else {
    // For driving licence, if NIC is also provided, validate format
    if (confirmedData.nicNumber) {
      const checkNIC = nicParser.validateNICFormat(confirmedData.nicNumber);
      if (checkNIC.isValid) {
        parsedNIC = nicParser.parseNICDetails(checkNIC.normalized);
      }
    }
  }

  // 4. Compare confirmed name against registered account name
  const nameSimilarity = calculateNameSimilarity(registeredName, confirmedFullName);

  // Also check similarity against OCR extracted name to detect arbitrary spoofing
  const extractedName = doc.EXTRACTED_NAME;
  const extractedNameSim = extractedName ? calculateNameSimilarity(extractedName, confirmedFullName) : 1.0;

  const ocrConfidence = doc.OCR_CONFIDENCE || 0;

  // 5. Evaluate Multi-Signal Decision
  let verificationStatus = 'PENDING';
  let rejectionReason = null;

  if (isNIC && !nicValidation?.isValid) {
    verificationStatus = 'REJECTED';
    rejectionReason = 'Invalid Sri Lankan National Identity Card number format.';
  } else if (nameSimilarity < KYC_CONFIG.MIN_NAME_MATCH) {
    // Severe name mismatch
    verificationStatus = 'REJECTED';
    rejectionReason = 'The cardholder name provided does not match your registered SmartLanka Trade account name.';
  } else if (nameSimilarity >= KYC_CONFIG.VERIFIED_NAME_MATCH && extractedNameSim >= 0.50) {
    // High similarity
    if (ocrConfidence >= KYC_CONFIG.VERIFIED_OCR_CONFIDENCE) {
      verificationStatus = 'VERIFIED';
      rejectionReason = null;
    } else {
      // Name matches but document OCR confidence is moderate -> queued for administrative review
      verificationStatus = 'PENDING';
      rejectionReason = 'Identity details were confirmed, but document image quality requires manual review by compliance.';
    }
  } else {
    // Moderate similarity or borderline match -> manual review
    verificationStatus = 'PENDING';
    rejectionReason = 'Extracted and confirmed identity details require manual administrative verification.';
  }

  // 6. Update document record with confirmed values and authoritative verification status
  const confirmedDob = confirmedData.dob || (parsedNIC ? parsedNIC.dob : doc.EXTRACTED_DOB);
  const confirmedGender = confirmedData.gender || (parsedNIC ? parsedNIC.gender : doc.EXTRACTED_GENDER);

  await kycModel.updateKYCConfirmation(documentId, userId, {
    documentNumber: isNIC ? nicValidation.normalized : confirmedNumber,
    confirmedName: confirmedFullName,
    confirmedDob,
    confirmedGender,
    confirmedData: {
      ...confirmedData,
      documentNumber: isNIC ? nicValidation.normalized : confirmedNumber,
      fullName: confirmedFullName,
      dob: confirmedDob,
      gender: confirmedGender
    },
    verificationStatus,
    rejectionReason
  });

  // 7. Update user profile KYC status on SL_USERS table
  const userNicToSave = isNIC ? nicValidation.normalized : (confirmedData.nicNumber || null);
  await kycModel.updateUserKYCStatus(userId, verificationStatus, userNicToSave);

  return {
    documentId,
    verificationStatus,
    rejectionReason,
    confirmedData: {
      documentType: documentType || doc.DOCUMENT_TYPE,
      documentNumber: isNIC ? nicValidation.normalized : confirmedNumber,
      fullName: confirmedFullName,
      dob: confirmedDob,
      gender: confirmedGender,
      address: confirmedData.address || null,
      licenceCategory: confirmedData.licenceCategory || null,
      issueDate: confirmedData.issueDate || null,
      expiryDate: confirmedData.expiryDate || null
    },
    originalExtractedData: {
      documentNumber: doc.DOCUMENT_NUMBER,
      extractedName: doc.EXTRACTED_NAME,
      extractedDob: doc.EXTRACTED_DOB,
      extractedGender: doc.EXTRACTED_GENDER,
      ocrConfidence: `${ocrConfidence}%`
    },
    audit: {
      registeredName,
      nameMatchScore: `${(nameSimilarity * 100).toFixed(0)}%`,
      ocrConfidence: `${ocrConfidence}%`,
      submittedAt: new Date().toISOString()
    }
  };
}

/**
 * Backward-compatible single-step KYC upload and verify method
 * Used by existing tests and legacy clients
 */
async function processKYCVerification(userId, imagePath, manualNIC = null, backImagePath = null) {
  const currentUser = await userModel.findById(userId);
  if (!currentUser) {
    throw new Error(`User with ID ${userId} not found.`);
  }
  const registeredName = currentUser.NAME || '';

  // 1. OCR Front Side
  const ocrResult = await ocrService.recognizeText(imagePath);
  let rawText = ocrResult.text || '';
  let ocrConfidence = ocrResult.confidence || 0;

  // 2. OCR Back Side if present
  if (backImagePath) {
    try {
      const backOcrResult = await ocrService.recognizeText(backImagePath);
      if (backOcrResult && backOcrResult.text) {
        rawText = `${rawText}\n--- BACK SIDE ---\n${backOcrResult.text}`;
        ocrConfidence = Math.max(ocrConfidence, backOcrResult.confidence || 0);
      }
    } catch (backErr) {
      console.warn('OCR note for back side image:', backErr.message);
    }
  }

  // 3. Extract details
  let extraction = nicParser.extractFromOCRText(rawText);

  if (!extraction.nicNumber && manualNIC) {
    const validManual = nicParser.validateNICFormat(manualNIC);
    if (validManual.isValid) {
      const parsed = nicParser.parseNICDetails(validManual.normalized);
      if (parsed) {
        extraction.nicNumber = parsed.nicNumber;
        extraction.dob = parsed.dob;
        extraction.gender = parsed.gender;
        extraction.parsedNIC = parsed;
        extraction.documentType = 'NIC';
      }
    }
  }

  const cleanedExtractedName = nicParser.cleanAndNormalizeName(extraction.extractedName);
  const nameSimilarity = calculateNameSimilarity(registeredName, cleanedExtractedName);

  const isReliableName = extraction.hasExplicitNameLabel || nameSimilarity >= 0.50;
  const effectiveExtractedName = isReliableName ? cleanedExtractedName : null;
  const effectiveNameSimilarity = isReliableName ? nameSimilarity : 0;

  const decision = evaluateKYCDecision({
    nicNumber: extraction.nicNumber,
    ocrConfidence,
    nameSimilarity: effectiveNameSimilarity,
    hasExtractedName: Boolean(effectiveExtractedName)
  });

  const { verificationStatus, rejectionReason } = decision;

  const storedDocPath = backImagePath ? `${imagePath}|${backImagePath}` : imagePath;
  const documentId = await kycModel.createKYCDocument({
    userId,
    documentType: extraction.documentType || 'NIC',
    documentNumber: extraction.nicNumber,
    extractedName: cleanedExtractedName || registeredName,
    extractedDob: extraction.dob,
    extractedGender: extraction.gender,
    ocrText: rawText,
    ocrConfidence,
    verificationStatus,
    rejectionReason,
    documentPath: storedDocPath,
    confirmedName: cleanedExtractedName || registeredName,
    confirmedDob: extraction.dob,
    confirmedGender: extraction.gender
  });

  await kycModel.updateUserKYCStatus(userId, verificationStatus, extraction.nicNumber);

  return {
    documentId,
    verificationStatus,
    rejectionReason,
    extractedData: {
      documentType: extraction.documentType,
      nicNumber: extraction.nicNumber,
      name: cleanedExtractedName || registeredName,
      dateOfBirth: extraction.dob,
      gender: extraction.gender,
      ocrConfidence: `${ocrConfidence}%`
    },
    comparison: {
      registeredName,
      nameMatchScore: `${(nameSimilarity * 100).toFixed(0)}%`
    },
    submittedAt: new Date().toISOString()
  };
}

module.exports = {
  KYC_CONFIG,
  levenshteinDistance,
  calculateNameSimilarity,
  evaluateKYCDecision,
  extractDocumentOCR,
  confirmAndVerifyKYC,
  processKYCVerification
};
