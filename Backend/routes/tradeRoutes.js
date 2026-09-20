const express = require('express');
const router = express.Router();
const { buyOrder, sellOrder } = require('../controllers/tradeController');
const { protect, requireVerifiedEmail } = require('../middleware/authMiddleware');

router.post('/buy', protect, requireVerifiedEmail, buyOrder);
router.post('/sell', protect, requireVerifiedEmail, sellOrder);

module.exports = router;

