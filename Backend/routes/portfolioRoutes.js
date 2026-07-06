const express = require('express');
const router = express.Router();
const { getPortfolio } = require('../controllers/portfolioController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getPortfolio);

module.exports = router;
