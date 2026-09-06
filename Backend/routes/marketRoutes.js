const express = require("express");
const router = express.Router();
const { getPrice, getMultiplePrices, getAllPrices, getLive, getKlines } = require("../controllers/marketController");

router.get("/price-lkr", getPrice);
router.get("/prices-lkr", getMultiplePrices);
router.get("/all-prices-lkr", getAllPrices);
router.get("/live", getLive);
router.get("/klines", getKlines);
router.get("/klines/:symbol", getKlines);

module.exports = router;
