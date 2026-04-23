const express = require('express');
const router = express.Router();
const { getWalletBalance } = require('../controllers/walletController');
const { protect } = require('../middleware/authMiddleware');

// router.get('/balance', protect, getWalletBalance);
router.get('/balance', getWalletBalance);

module.exports = router;
