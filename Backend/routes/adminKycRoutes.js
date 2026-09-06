const express = require('express');
const router = express.Router();
const kycController = require('../controllers/kycController');
const { protect } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/adminMiddleware');

// Admin KYC Review Endpoints (Requires valid JWT authentication + ADMIN role)
router.get('/pending', protect, requireAdmin, kycController.adminGetPending);
router.put('/:id/status', protect, requireAdmin, kycController.adminUpdateStatus);

module.exports = router;
