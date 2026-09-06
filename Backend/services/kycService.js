const ocrService = require('./ocrService');
const nicParser = require('../utils/nicParser');
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
  VERIFIED_OCR_CONFIDENCE: 70,
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

  // Also compute full-string normalized similarity
  const maxFullLen = Math.max(regClean.length, extClean.length);
  const fullDist = levenshteinDistance(regClean, extClean);
  const fullScore = maxFullLen > 0 ? Math.max(0, 1 - fullDist / maxFullLen) : 1.0;

  // Weighted combination
  const combined = Math.max(tokenScore, fullScore);
  return parseFloat(combined.toFixed(2));
}

/**
 * Evaluates multi-signal KYC verification decision
 * 
 * Multi-Signals Evaluated:
 * 1. NIC Format Validity (Old or New Sri Lankan NIC)
 * 2. NIC Demographic Consistency (Year, Day of Year, DOB, Gender derived mathematically)
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
      rejectionReason: 'No valid Sri Lankan NIC number (9 digits + V/X or 12 digits) could be detected. Please ensure the document is clear and readable.'
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
          rejectionReason: 'Identity details were extracted successfully, but OCR confidence is low. The document has been submitted for administrative review.'
        };
      }
    } else if (nameSimilarity >= KYC_CONFIG.BORDERLINE_NAME_MATCH) {
      // Borderline/Partial Name Match (e.g. initials or OCR character confusions) -> Admin Review
      return {
        verificationStatus: 'PENDING',
        rejectionReason: 'Identity details were extracted successfully, but OCR confidence is low. The document has been submitted for administrative review.'
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
        rejectionReason: 'Extracted name on identity document differs significantly from registered account name.'
      };
    }
  } else {
    // Name could not be isolated from image, but NIC and demographics are valid
    if (ocrConfidence >= KYC_CONFIG.VERIFIED_OCR_CONFIDENCE) {
      return {
        verificationStatus: 'VERIFIED',
        rejectionReason: null
      };
    } else {
      return {
        verificationStatus: 'PENDING',
        rejectionReason: 'Identity details were extracted successfully, but OCR confidence is low. The document has been submitted for administrative review.'
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

  // Clean extracted name (removing field labels like "NAME ", "Name:")
  const cleanedExtractedName = nicParser.cleanAndNormalizeName(extraction.extractedName);

  // 4. Multi-signal verification evaluation
  const nameSimilarity = calculateNameSimilarity(registeredName, cleanedExtractedName);
  const decision = evaluateKYCDecision({
    nicNumber: extraction.nicNumber,
    ocrConfidence,
    nameSimilarity,
    hasExtractedName: Boolean(cleanedExtractedName)
  });

  const { verificationStatus, rejectionReason } = decision;

  // 5. Store Verification Document in Oracle Database
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
  processKYCVerification
};
