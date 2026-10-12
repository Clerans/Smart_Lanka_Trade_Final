const express = require("express");
const router = express.Router();
const { 
  getPrice, 
  getMultiplePrices, 
  getAllPrices, 
  getLive, 
  getKlines,
  getCseWatchlist,
  getCseStock,
  getCseSession
} = require("../controllers/marketController");

router.get("/price-lkr", getPrice);
router.get("/prices-lkr", getMultiplePrices);
router.get("/all-prices-lkr", getAllPrices);
router.get("/live", getLive);
router.get("/klines", getKlines);
router.get("/klines/:symbol", getKlines);

// CSE Sri Lankan Stocks Market Data Routes
router.get("/cse/watchlist", getCseWatchlist);
router.get("/cse/stock/:symbol", getCseStock);
router.get("/cse/session", getCseSession);

module.exports = router;

