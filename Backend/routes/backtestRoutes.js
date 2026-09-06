const express = require('express');
const router = express.Router();
const backtestController = require('../controllers/backtestController');
const { protect } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/adminMiddleware');

// Backtest routes protected for Admin & Research Evaluation
router.post('/run', protect, requireAdmin, backtestController.executeBacktest);
router.post('/multi', protect, requireAdmin, backtestController.executeMultiSymbolBacktest);

module.exports = router;
