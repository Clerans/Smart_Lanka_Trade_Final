const express = require('express');
const router = express.Router();
const { getWalletDetails, getWalletBalance, depositMoney, getTransactions } = require('../controllers/walletController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getWalletDetails);
router.get('/balance', protect, getWalletBalance);
router.post('/deposit', protect, depositMoney);
router.get('/transactions', protect, getTransactions);

module.exports = router;
