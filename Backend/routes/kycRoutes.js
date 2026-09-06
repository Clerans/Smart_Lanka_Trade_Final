const express = require('express');
const router = express.Router();
const { verifyNic, getStatus } = require('../controllers/kycController');
const { protect } = require('../middleware/authMiddleware');

router.post('/verify-nic', protect, verifyNic);
router.get('/status', protect, getStatus);

module.exports = router;
