const kycService = require('../services/kycService');
const kycModel = require('../models/kycModel');

/**
 * POST /api/kyc/extract
 * Stage B: Extracts OCR raw text and structured fields from uploaded document image(s)
 * Does NOT automatically verify the document. Returns extracted fields for user review.
 */
exports.extractOCR = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in.'
      });
    }

    const frontFile = req.files?.document?.[0] || req.file;
    const backFile = req.files?.backDocument?.[0];

    if (!frontFile && !backFile) {
      return res.status(400).json({
        success: false,
        code: 'NO_FILE_UPLOADED',
        message: 'Please upload an identity document image to extract information.'
      });
    }

    const frontImagePath = frontFile ? frontFile.path : backFile.path;
    const backImagePath = (frontFile && backFile) ? backFile.path : null;
    const documentType = (req.body.documentType || 'NIC').toUpperCase();

    const result = await kycService.extractDocumentOCR(
      userId,
      documentType,
      frontImagePath,
      backImagePath
    );

    return res.status(200).json({
      success: true,
      message: 'Document information extracted successfully. Please review and correct the details before proceeding.',
      data: result
    });
  } catch (error) {
    console.error('KYC extraction error:', error.message || error);
    const statusCode = error.code === 'UNREADABLE_DOCUMENT' ? 400 : 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'OCR_EXTRACTION_ERROR',
      message: error.message || 'Failed to extract text from identity document',
      data: {
        ocrConfidence: error.ocrConfidence || 0,
        rawOcrText: error.rawOcrText || ''
      }
    });
  }
};

/**
 * POST /api/kyc/confirm
 * Stage E & F: Confirms user-reviewed information and performs authoritative backend verification
 */
exports.confirmAndVerify = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in.'
      });
    }

    const { documentId, documentType = 'NIC', confirmedData } = req.body;

    if (!documentId) {
      return res.status(400).json({
        success: false,
        code: 'MISSING_DOCUMENT_ID',
        message: 'documentId reference is required to confirm verification.'
      });
    }

    if (!confirmedData || typeof confirmedData !== 'object') {
      return res.status(400).json({
        success: false,
        code: 'MISSING_CONFIRMED_DATA',
        message: 'Please provide your reviewed and confirmed document details.'
      });
    }

    const result = await kycService.confirmAndVerifyKYC(
      userId,
      parseInt(documentId, 10),
      documentType,
      confirmedData
    );

    const message = result.verificationStatus === 'VERIFIED'
      ? 'Identity verification successful! Your account is now fully verified.'
      : result.verificationStatus === 'PENDING'
      ? 'Identity details submitted successfully and pending administrative review.'
      : 'Identity verification was unsuccessful. Please review the reason and resubmit.';

    return res.status(200).json({
      success: true,
      message,
      data: result
    });
  } catch (error) {
    console.error('KYC confirmation error:', error.message || error);
    const statusCode = error.code === 'FORBIDDEN_SESSION' ? 403
      : (error.code?.startsWith('INVALID_') || error.code?.startsWith('MISSING_') ? 400 : 500);

    return res.status(statusCode).json({
      success: false,
      code: error.code || 'CONFIRMATION_ERROR',
      message: error.message || 'Failed to complete identity verification.'
    });
  }
};

/**
 * POST /api/kyc/verify
 * Legacy / Direct Upload & Verify route (preserves full backward compatibility)
 */
exports.uploadAndVerify = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in.'
      });
    }

    const frontFile = req.files?.document?.[0] || req.file;
    const backFile = req.files?.backDocument?.[0];

    if (!frontFile && !backFile) {
      return res.status(400).json({
        success: false,
        code: 'NO_FILE_UPLOADED',
        message: 'Please upload an identity document image (NIC front and/or back).'
      });
    }

    const imagePath = frontFile ? frontFile.path : backFile.path;
    const backImagePath = (frontFile && backFile) ? backFile.path : null;
    const manualNIC = req.body.manualNIC || null;

    const result = await kycService.processKYCVerification(userId, imagePath, manualNIC, backImagePath);

    return res.status(200).json({
      success: true,
      message: result.verificationStatus === 'VERIFIED' 
        ? 'KYC Verification successful! Your account is now verified.'
        : result.verificationStatus === 'PENDING'
        ? 'KYC Document submitted and pending administrative review.'
        : 'KYC Verification rejected. Please review the reason and resubmit.',
      data: result
    });
  } catch (error) {
    console.error('KYC verification error:', error.message);
    return res.status(500).json({
      success: false,
      code: 'KYC_PROCESSING_ERROR',
      message: error.message || 'Failed to process identity verification'
    });
  }
};

/**
 * GET /api/kyc/status
 * Get current KYC status for authenticated user
 */
exports.getKYCStatus = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const kycDoc = await kycModel.getKYCByUser(userId);

    let parsedConfirmedData = null;
    if (kycDoc?.CONFIRMED_DATA) {
      try {
        parsedConfirmedData = JSON.parse(kycDoc.CONFIRMED_DATA);
      } catch (e) {}
    }

    return res.status(200).json({
      success: true,
      data: {
        status: kycDoc ? kycDoc.VERIFICATION_STATUS : 'NOT_SUBMITTED',
        document: kycDoc ? {
          id: kycDoc.ID,
          documentType: kycDoc.DOCUMENT_TYPE,
          documentNumber: kycDoc.DOCUMENT_NUMBER,
          extractedName: kycDoc.EXTRACTED_NAME,
          extractedDob: kycDoc.EXTRACTED_DOB,
          extractedGender: kycDoc.EXTRACTED_GENDER,
          confirmedName: kycDoc.CONFIRMED_NAME,
          confirmedDob: kycDoc.CONFIRMED_DOB,
          confirmedGender: kycDoc.CONFIRMED_GENDER,
          confirmedData: parsedConfirmedData,
          confidence: kycDoc.OCR_CONFIDENCE,
          rejectionReason: kycDoc.REJECTION_REASON,
          submittedAt: kycDoc.SUBMITTED_AT,
          verifiedAt: kycDoc.VERIFIED_AT
        } : null
      }
    });
  } catch (error) {
    console.error('Error fetching KYC status:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve KYC status'
    });
  }
};

/**
 * GET /api/kyc/history
 * Get KYC submission history for authenticated user
 */
exports.getKYCHistory = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const history = await kycModel.getKYCHistory(userId);

    const sanitizedHistory = history.map(item => ({
      id: item.ID,
      userId: item.USER_ID,
      documentType: item.DOCUMENT_TYPE,
      documentNumber: item.DOCUMENT_NUMBER,
      extractedName: item.EXTRACTED_NAME,
      extractedDob: item.EXTRACTED_DOB,
      extractedGender: item.EXTRACTED_GENDER,
      confirmedName: item.CONFIRMED_NAME,
      confirmedDob: item.CONFIRMED_DOB,
      confirmedGender: item.CONFIRMED_GENDER,
      ocrConfidence: item.OCR_CONFIDENCE,
      verificationStatus: item.VERIFICATION_STATUS,
      rejectionReason: item.REJECTION_REASON,
      submittedAt: item.SUBMITTED_AT,
      verifiedAt: item.VERIFIED_AT
    }));

    return res.status(200).json({
      success: true,
      count: sanitizedHistory.length,
      data: sanitizedHistory
    });
  } catch (error) {
    console.error('Error fetching KYC history:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve KYC history'
    });
  }
};

/**
 * Admin: GET /api/admin/kyc/pending
 */
exports.adminGetPending = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '20', 10);
    const pendingList = await kycModel.getPendingKYC(limit);

    const sanitizedList = pendingList.map(item => ({
      id: item.ID,
      userId: item.USER_ID,
      userName: item.USER_NAME,
      userEmail: item.USER_EMAIL,
      documentType: item.DOCUMENT_TYPE,
      documentNumber: item.DOCUMENT_NUMBER,
      extractedName: item.EXTRACTED_NAME,
      extractedDob: item.EXTRACTED_DOB,
      extractedGender: item.EXTRACTED_GENDER,
      confirmedName: item.CONFIRMED_NAME,
      confirmedDob: item.CONFIRMED_DOB,
      confirmedGender: item.CONFIRMED_GENDER,
      ocrConfidence: item.OCR_CONFIDENCE,
      verificationStatus: item.VERIFICATION_STATUS,
      submittedAt: item.SUBMITTED_AT
    }));

    return res.status(200).json({
      success: true,
      count: sanitizedList.length,
      data: sanitizedList
    });
  } catch (error) {
    console.error('Error fetching pending KYC:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve pending KYC applications'
    });
  }
};

/**
 * Admin: PUT /api/admin/kyc/:id/status
 */
exports.adminUpdateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;
    const adminId = req.user?.id;

    const docId = parseInt(id, 10);
    if (isNaN(docId) || docId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid KYC document ID.'
      });
    }

    if (!['VERIFIED', 'REJECTED', 'PENDING'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be VERIFIED, REJECTED, or PENDING.'
      });
    }

    if (status === 'REJECTED' && (!rejectionReason || !rejectionReason.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required when rejecting a KYC application.'
      });
    }

    const doc = await kycModel.getKYCById(docId);
    if (!doc) {
      return res.status(404).json({
        success: false,
        message: 'KYC Document record not found.'
      });
    }

    await kycModel.updateAdminKYCDecision(
      docId,
      doc.USER_ID,
      status,
      status === 'REJECTED' ? rejectionReason.trim() : null,
      adminId,
      doc.DOCUMENT_NUMBER
    );

    return res.status(200).json({
      success: true,
      message: `KYC application #${docId} successfully updated to ${status}.`
    });
  } catch (error) {
    console.error('Error updating KYC status:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to update KYC status'
    });
  }
};
