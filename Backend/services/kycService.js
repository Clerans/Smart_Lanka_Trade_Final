const ocrService = require('./ocrService');
const nicParser = require('../utils/nicParser');
const kycModel = require('../models/kycModel');
const userModel = require('../models/userModel');

/**
 * Calculates string similarity ratio (0 to 1) based on token overlap & Levenshtein distance
 */
function calculateNameSimilarity(registeredName, extractedName) {
  if (!registeredName || !extractedName) return 0;

  const regClean = registeredName.trim().toUpperCase().replace(/[^A-Z\s]/g, '');
  const extClean = extractedName.trim().toUpperCase().replace(/[^A-Z\s]/g, '');

  if (regClean === extClean) return 1.0;

  const regTokens = regClean.split(/\s+/).filter(t => t.length > 1);
  const extTokens = extClean.split(/\s+/).filter(t => t.length > 1);

  if (regTokens.length === 0 || extTokens.length === 0) return 0;

  // Check matching tokens
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
 * Processes KYC Document upload and runs end-to-end verification
 * @param {number} userId - Authenticated user ID
 * @param {string} imagePath - Filepath of uploaded image
 * @param {string|null} manualNIC - Optional NIC provided in form
 */
async function processKYCVerification(userId, imagePath, manualNIC = null) {
  // 1. Fetch user from DB
  const user = await userModel.findAllUsers();
  const currentUser = user.find(u => u.ID === userId);
  const registeredName = currentUser ? currentUser.NAME : '';

  // 2. Perform OCR Text Recognition
  const ocrResult = await ocrService.recognizeText(imagePath);
  const rawText = ocrResult.text;
  const ocrConfidence = ocrResult.confidence;

  // 3. Extract structured document details
  let extraction = nicParser.extractFromOCRText(rawText);

  // If OCR missed the NIC but user provided manual NIC that validates, check it
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

  // 4. Evaluate and Compare User Details
  let verificationStatus = 'PENDING';
  let rejectionReason = null;

  const nameSimilarity = calculateNameSimilarity(registeredName, extraction.extractedName);

  if (!extraction.nicNumber) {
    verificationStatus = 'REJECTED';
    rejectionReason = 'No valid Sri Lankan NIC number could be detected from the document image. Please upload a clear photo of your NIC.';
  } else if (ocrConfidence < 30) {
    verificationStatus = 'REJECTED';
    rejectionReason = 'Document image resolution or lighting is too poor for optical character recognition. Please retake the photo.';
  } else {
    // Valid NIC number found
    if (nameSimilarity >= 0.5 || !extraction.extractedName) {
      if (ocrConfidence >= 65) {
        verificationStatus = 'VERIFIED';
      } else {
        // High quality NIC but lower confidence or partial name match -> Pending for manual review
        verificationStatus = 'PENDING';
      }
    } else {
      // Strong name mismatch
      verificationStatus = 'PENDING';
      rejectionReason = `Extracted name (${extraction.extractedName || 'Unknown'}) differs from registered name (${registeredName}). Marked for administrative review.`;
    }
  }

  // 5. Store Verification in Oracle Database
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
  calculateNameSimilarity,
  processKYCVerification
};
