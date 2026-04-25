const express = require('express');
const router = express.Router();
const { getWalletBalance, depositMoney, getTransactions } = require('../controllers/walletController');
const { protect } = require('../middleware/authMiddleware');

router.get('/balance', protect, getWalletBalance);
router.post('/deposit', protect, depositMoney);
router.get('/transactions', protect, getTransactions);

module.exports = router;
