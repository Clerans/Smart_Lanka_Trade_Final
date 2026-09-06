const express = require('express');
const router = express.Router();
const {
  getAllQuotes,
  getQuoteBySymbol,
  getMultipleQuotes,
  getCandles,
  getForex,
  getLive
} = require('../controllers/marketController');

// CSE Stock Market Data Endpoints
router.get('/all-prices-lkr', getAllQuotes);
router.get('/price-lkr', getQuoteBySymbol);
router.get('/prices-lkr', getMultipleQuotes);
router.get('/live', getLive);
router.get('/candles', getCandles);
router.get('/candles/:symbol', getCandles);
router.get('/forex', getForex);

module.exports = router;
