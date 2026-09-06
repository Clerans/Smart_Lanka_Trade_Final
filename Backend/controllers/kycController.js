const kycService = require('../services/kycService');
const kycModel = require('../models/kycModel');

/**
 * POST /api/kyc/verify
 * Uploads NIC image and performs OCR verification
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

    if (!req.file) {
      return res.status(400).json({
        success: false,
        code: 'NO_FILE_UPLOADED',
        message: 'Please upload an identity document image (NIC / Passport).'
      });
    }

    const imagePath = req.file.path;
    const manualNIC = req.body.manualNIC || null;

    const result = await kycService.processKYCVerification(userId, imagePath, manualNIC);

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

    // Sanitize any internal paths for client privacy
    const sanitizedHistory = history.map(item => ({
      id: item.ID,
      userId: item.USER_ID,
      documentType: item.DOCUMENT_TYPE,
      documentNumber: item.DOCUMENT_NUMBER,
      extractedName: item.EXTRACTED_NAME,
      extractedDob: item.EXTRACTED_DOB,
      extractedGender: item.EXTRACTED_GENDER,
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

    // Rejection reason validation: required when status is REJECTED
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

    // Update KYC_DOCUMENTS and SL_USERS atomically in a database transaction
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
