const express = require("express");
const router = express.Router();
const { getPrice, getMultiplePrices, getAllPrices } = require("../controllers/marketController");

router.get("/price-lkr", getPrice);
router.get("/prices-lkr", getMultiplePrices);
router.get("/all-prices-lkr", getAllPrices);

module.exports = router;
