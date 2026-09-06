const fs = require('fs');
const path = require('path');
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
        message: 'Authentication required'
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
        ? 'KYC Document submitted and pending verification.'
        : 'KYC Verification could not be completed with the uploaded document.',
      data: result
    });
  } catch (error) {
    console.error('KYC upload error:', error.message);
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
 * Get KYC submission history
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

    return res.status(200).json({
      success: true,
      count: history.length,
      data: history
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

    return res.status(200).json({
      success: true,
      count: pendingList.length,
      data: pendingList
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

    if (!['VERIFIED', 'REJECTED', 'PENDING'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be VERIFIED, REJECTED, or PENDING.'
      });
    }

    const doc = await kycModel.getKYCById(parseInt(id, 10));
    if (!doc) {
      return res.status(404).json({
        success: false,
        message: 'KYC Document record not found'
      });
    }

    await kycModel.updateKYCStatus(parseInt(id, 10), status, rejectionReason || null, adminId);
    await kycModel.updateUserKYCStatus(doc.USER_ID, status, doc.DOCUMENT_NUMBER);

    return res.status(200).json({
      success: true,
      message: `KYC application #${id} updated to ${status}`
    });
  } catch (error) {
    console.error('Error updating KYC status:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to update KYC status'
    });
  }
};
