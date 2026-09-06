const ocrService = require('./ocrService');
const nicParser = require('../utils/nicParser');
const kycModel = require('../models/kycModel');
const userModel = require('../models/userModel');

/**
 * KYC Decision Configuration Constants
 * 
 * - MIN_OCR_CONFIDENCE (40%): Minimum OCR confidence score required to consider document readable.
 * - VERIFIED_OCR_CONFIDENCE (70%): High confidence threshold required for automated instant verification.
 * - VERIFIED_NAME_MATCH (0.65): Minimum token similarity score between OCR extracted name and registered user name.
 * - MIN_NAME_MATCH (0.35): Lower bound for name similarity before marking as mismatch.
 */
const KYC_CONFIG = {
  MIN_OCR_CONFIDENCE: 40,
  VERIFIED_OCR_CONFIDENCE: 70,
  VERIFIED_NAME_MATCH: 0.65,
  MIN_NAME_MATCH: 0.35
};

/**
 * Calculates string similarity ratio (0.0 to 1.0) based on token overlap & Levenshtein distance
 * @param {string} registeredName 
 * @param {string} extractedName 
 * @returns {number}
 */
function calculateNameSimilarity(registeredName, extractedName) {
  if (!registeredName || !extractedName) return 0;

  const regClean = registeredName.trim().toUpperCase().replace(/[^A-Z\s]/g, '');
  const extClean = extractedName.trim().toUpperCase().replace(/[^A-Z\s]/g, '');

  if (regClean === extClean) return 1.0;

  const regTokens = regClean.split(/\s+/).filter(t => t.length > 1);
  const extTokens = extClean.split(/\s+/).filter(t => t.length > 1);

  if (regTokens.length === 0 || extTokens.length === 0) return 0;

  // Count token matches
  let matchingCount = 0;
  for (const rTok of regTokens) {
    for (const eTok of extTokens) {
      if (rTok === eTok || (rTok.length > 3 && eTok.length > 3 && (rTok.includes(eTok) || eTok.includes(rTok)))) {
        matchingCount++;
        break;
      }
    }
  }

  const tokenScore = (matchingCount * 2) / (regTokens.length + extTokens.length);
  return parseFloat(tokenScore.toFixed(2));
}

/**
 * Evaluates multi-signal KYC verification decision
 * 
 * Signals considered:
 * 1. NIC Format Validity (Old or New Sri Lankan NIC)
 * 2. OCR Recognition Confidence Score
 * 3. Name Similarity between OCR extracted text and registered profile
 * 4. Extracted demographic fields (DOB, Gender consistency)
 * 
 * @param {object} params
 * @returns {{ verificationStatus: 'VERIFIED'|'PENDING'|'REJECTED', rejectionReason: string|null }}
 */
function evaluateKYCDecision({ nicNumber, ocrConfidence, nameSimilarity, hasExtractedName }) {
  // Signal 1: NIC validity
  if (!nicNumber) {
    return {
      verificationStatus: 'REJECTED',
      rejectionReason: 'No valid Sri Lankan NIC number (9 digits + V/X or 12 digits) could be detected. Please ensure the document is clear and readable.'
    };
  }

  // Signal 2: OCR confidence below minimum readable threshold
  if (ocrConfidence < KYC_CONFIG.MIN_OCR_CONFIDENCE) {
    return {
      verificationStatus: 'REJECTED',
      rejectionReason: `Document image quality is too low (OCR Confidence: ${ocrConfidence}%). Please capture a clearer photo in good lighting.`
    };
  }

  // Signal 3 & 4: Multi-signal evaluation with name similarity
  if (hasExtractedName) {
    if (nameSimilarity >= KYC_CONFIG.VERIFIED_NAME_MATCH) {
      if (ocrConfidence >= KYC_CONFIG.VERIFIED_OCR_CONFIDENCE) {
        return {
          verificationStatus: 'VERIFIED',
          rejectionReason: null
        };
      } else {
        // Name matches well but confidence is moderate
        return {
          verificationStatus: 'PENDING',
          rejectionReason: 'Document validated with moderate OCR confidence. Submitted for administrative confirmation.'
        };
      }
    } else if (nameSimilarity >= KYC_CONFIG.MIN_NAME_MATCH) {
      // Partial name match (e.g. initials vs full name) -> Send to Admin Queue
      return {
        verificationStatus: 'PENDING',
        rejectionReason: 'Extracted name partially matches registered profile. Marked for administrative review.'
      };
    } else {
      // Name strongly differs -> Mark PENDING or REJECTED
      return {
        verificationStatus: 'PENDING',
        rejectionReason: 'Extracted name on identity document differs from registered account name. Flagged for manual review.'
      };
    }
  } else {
    // Name could not be isolated, but NIC is valid
    if (ocrConfidence >= KYC_CONFIG.VERIFIED_OCR_CONFIDENCE) {
      return {
        verificationStatus: 'VERIFIED',
        rejectionReason: null
      };
    } else {
      return {
        verificationStatus: 'PENDING',
        rejectionReason: 'Valid NIC detected with moderate clarity. Pending final administrative review.'
      };
    }
  }
}

/**
 * Processes KYC Document upload and runs end-to-end verification
 * @param {number} userId - Authenticated user ID (from JWT req.user.id)
 * @param {string} imagePath - Filepath of uploaded image
 * @param {string|null} manualNIC - Optional NIC provided in form
 */
async function processKYCVerification(userId, imagePath, manualNIC = null) {
  // 1. Fetch authenticated user record directly by ID (No full user table scanning)
  const currentUser = await userModel.findById(userId);
  if (!currentUser) {
    throw new Error(`User with ID ${userId} not found.`);
  }

  const registeredName = currentUser.NAME || '';

  // 2. Perform OCR Text Recognition
  const ocrResult = await ocrService.recognizeText(imagePath);
  const rawText = ocrResult.text;
  const ocrConfidence = ocrResult.confidence;

  // 3. Extract structured document details via Sri Lankan NIC parser
  let extraction = nicParser.extractFromOCRText(rawText);

  // If OCR missed the NIC but user provided manual NIC that validates, verify format
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

  // 4. Multi-signal verification evaluation
  const nameSimilarity = calculateNameSimilarity(registeredName, extraction.extractedName);
  const decision = evaluateKYCDecision({
    nicNumber: extraction.nicNumber,
    ocrConfidence,
    nameSimilarity,
    hasExtractedName: Boolean(extraction.extractedName)
  });

  const { verificationStatus, rejectionReason } = decision;

  // 5. Store Verification Document in Oracle Database
  const documentId = await kycModel.createKYCDocument({
    userId,
    documentType: extraction.documentType || 'NIC',
    documentNumber: extraction.nicNumber,
    extractedName: extraction.extractedName || registeredName,
    extractedDob: extraction.dob,
    extractedGender: extraction.gender,
    ocrText: rawText,
    ocrConfidence,
    verificationStatus,
    rejectionReason,
    documentPath: imagePath
  });

  // 6. Update user's KYC status on SL_USERS table
  await kycModel.updateUserKYCStatus(userId, verificationStatus, extraction.nicNumber);

  return {
    documentId,
    verificationStatus,
    rejectionReason,
    extractedData: {
      documentType: extraction.documentType,
      nicNumber: extraction.nicNumber,
      name: extraction.extractedName || registeredName,
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
  calculateNameSimilarity,
  evaluateKYCDecision,
  processKYCVerification
};
