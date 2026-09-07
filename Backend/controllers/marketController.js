const { getPriceInLKR, getMultiplePricesInLKR, getAllPricesInLKR } = require("../services/marketService");

exports.getPrice = async (req, res) => {
  try {
    const symbol = req.query.symbol || "BTCUSDT";

    const data = await getPriceInLKR(symbol);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch market data",
    });
  }
};

exports.getMultiplePrices = async (req, res) => {
  try {
    const symbols = req.query.symbols ? req.query.symbols.split(',') : ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "ADAUSDT"];
    const includeSparkline = req.query.sparkline === 'true';

    const data = await getMultiplePricesInLKR(symbols, includeSparkline);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch multiple market data",
    });
  }
};

exports.getAllPrices = async (req, res) => {
  try {
    const data = await getAllPricesInLKR();
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch all market data",
    });
  }
};

exports.getLive = async (req, res) => {
  try {
    const { getLivePrices } = require("../services/marketService");
    const data = await getLivePrices();
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('getLive Error:', error.message);
    res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: 'Failed to fetch live market prices'
    });
  }
};

const ALLOWED_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'ADAUSDT', 'XRPUSDT', 'DOGEUSDT'];
const ALLOWED_INTERVALS = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];

exports.getKlines = async (req, res) => {
  try {
    const { getKlinesWithIndicators } = require("../services/marketDataService");
    let symbol = (req.params.symbol || req.query.symbol || "BTCUSDT").toUpperCase().trim();
    let interval = (req.query.interval || "1h").toLowerCase().trim();
    let limit = parseInt(req.query.limit || "100", 10);

    if (!ALLOWED_SYMBOLS.includes(symbol)) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_SYMBOL',
        message: `Invalid symbol '${symbol}'. Allowed symbols: ${ALLOWED_SYMBOLS.join(', ')}`
      });
    }

    if (!ALLOWED_INTERVALS.includes(interval)) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_INTERVAL',
        message: `Invalid interval '${interval}'. Supported intervals: ${ALLOWED_INTERVALS.join(', ')}`
      });
    }

    if (isNaN(limit) || limit < 5 || limit > 500) {
      limit = Math.min(Math.max(limit || 100, 5), 500);
    }

    const data = await getKlinesWithIndicators(symbol, interval, limit);
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('getKlines Error:', error.message);
    res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: error.message || 'Failed to fetch candlestick data'
    });
  }
};
