const express = require('express');
const router = express.Router();
const { buyOrder, sellOrder } = require('../controllers/tradeController');
const { protect } = require('../middleware/authMiddleware');

router.post('/buy', protect, buyOrder);
router.post('/sell', protect, sellOrder);

module.exports = router;
