const express = require('express');
const router = express.Router();
const kycController = require('../controllers/kycController');
const { protect } = require('../middleware/authMiddleware');

// Admin KYC review endpoints
router.get('/pending', protect, kycController.adminGetPending);
router.put('/:id/status', protect, kycController.adminUpdateStatus);

module.exports = router;
