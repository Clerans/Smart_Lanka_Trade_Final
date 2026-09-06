const kycService = require('../services/kycService');

function getClientMeta(req) {
  return {
    ip: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'SmartLanka-App'
  };
}

exports.verifyNic = async (req, res) => {
  try {
    const { nicNumber, fullName, dob, docType, ocrRawText } = req.body;
    const userId = req.user.id;

    if (!nicNumber || !fullName) {
      return res.status(422).json({
        success: false,
        code: 'MISSING_FIELDS',
        message: 'NIC number and full name are required for verification.'
      });
    }

    const result = await kycService.submitKYCDocument(userId, {
      docType: docType || 'SRI_LANKAN_NIC',
      nicNumber,
      fullName,
      dob,
      ocrRawText,
      clientMeta: getClientMeta(req)
    });

    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      code: err.code || 'KYC_ERROR',
      message: err.message || 'Identity verification failed.'
    });
  }
};

exports.getStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const status = await kycService.getKYCStatus(userId);
    res.json({
      success: true,
      ...status
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      code: 'KYC_ERROR',
      message: err.message || 'Failed to retrieve KYC status.'
    });
  }
};
