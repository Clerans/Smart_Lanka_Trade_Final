const express = require('express');
const router = express.Router();
const {
  getWalletDetails,
  getWalletBalance,
  depositMoney,
  initiateDeposit,
  verifyDeposit,
  requestWithdrawal,
  lookupRecipient,
  executeTransfer,
  getTransactions,
  getTransactionDetails
} = require('../controllers/walletController');
const { getWalletOverview } = require('../controllers/walletOverviewController');
const { protect } = require('../middleware/authMiddleware');
const { rateLimit } = require('express-rate-limit');

// Strict rate limiter for sensitive transfer and enumeration-target endpoints
const transferLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // 15 requests per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: 'TOO_MANY_REQUESTS',
    message: 'Too many transfer/lookup attempts from this IP, please try again later.'
  }
});

// High-performance aggregated Wallet Overview endpoint
router.get('/overview', protect, getWalletOverview);

// Wallet Balance & Details
router.get('/', protect, getWalletDetails);
router.get('/balance', protect, getWalletBalance);

// Funding & Deposit Lifecycle
router.post('/deposit', protect, depositMoney);
router.post('/deposit/initiate', protect, initiateDeposit);
router.post('/deposit/verify', protect, verifyDeposit);

// Withdrawal
router.post('/withdraw', protect, requestWithdrawal);

// Internal P2P Transfers
router.get('/recipient/:uid', protect, transferLimiter, lookupRecipient);
router.get('/users/:uid', protect, transferLimiter, lookupRecipient);
router.post('/transfer', protect, transferLimiter, executeTransfer);

// Transactions & Receipts
router.get('/transactions', protect, getTransactions);
router.get('/transactions/:id', protect, getTransactionDetails);

module.exports = router;
