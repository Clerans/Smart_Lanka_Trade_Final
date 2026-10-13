const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const kycController = require('../controllers/kycController');
const { protect } = require('../middleware/authMiddleware');

// Controlled upload directory (outside public static access)
const uploadDir = path.join(__dirname, '..', 'uploads', 'kyc');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer disk storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Authenticated user ID is strictly guaranteed because `protect` runs before upload
    const userId = req.user?.id || 'secure';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const rawExt = path.extname(file.originalname).toLowerCase();
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(rawExt) ? rawExt : '.jpg';
    cb(null, `kyc-usr${userId}-${uniqueSuffix}${safeExt}`);
  }
});

// File filter: validate MIME types strictly
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];

  if (allowedMimeTypes.includes(file.mimetype) && allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are permitted for KYC documents.'), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB maximum file size
  fileFilter
});

// Error-handling wrapper for multer upload (supports front 'document' and optional 'backDocument')
const handleUpload = (req, res, next) => {
  upload.fields([
    { name: 'document', maxCount: 1 },
    { name: 'backDocument', maxCount: 1 }
  ])(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          code: 'FILE_TOO_LARGE',
          message: 'Document file size exceeds 5MB limit.'
        });
      }
      return res.status(400).json({
        success: false,
        code: 'UPLOAD_ERROR',
        message: err.message
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_FILE_TYPE',
        message: err.message
      });
    }
    next();
  });
};

// KYC User Routes (Protected with authentication before file upload)
// Stage B: OCR extraction without automatic verification
router.post('/extract', protect, handleUpload, kycController.extractOCR);

// Stage E & F: Review confirmation and authoritative backend verification
router.post('/confirm', protect, kycController.confirmAndVerify);

// Legacy single-step upload and verify route (preserved for backward compatibility)
router.post('/verify', protect, handleUpload, kycController.uploadAndVerify);

router.get('/status', protect, kycController.getKYCStatus);
router.get('/history', protect, kycController.getKYCHistory);

module.exports = router;
