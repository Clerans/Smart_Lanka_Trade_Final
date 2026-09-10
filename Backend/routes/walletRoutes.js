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
const { protect } = require('../middleware/authMiddleware');

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
router.get('/recipient/:uid', protect, lookupRecipient);
router.get('/users/:uid', protect, lookupRecipient);
router.post('/transfer', protect, executeTransfer);

// Transactions & Receipts
router.get('/transactions', protect, getTransactions);
router.get('/transactions/:id', protect, getTransactionDetails);

module.exports = router;
