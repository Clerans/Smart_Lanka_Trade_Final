const {
  ALLOWED_SYMBOLS,
  normalizeSymbol,
  getPriceInLKR,
  getMultiplePricesInLKR,
  getAllPricesInLKR,
  getLivePrices
} = require("../services/marketService");

const ALLOWED_INTERVALS = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];

exports.getPrice = async (req, res) => {
  try {
    const rawSymbol = req.query.symbol || "BTCUSDT";
    if (!rawSymbol || typeof rawSymbol !== 'string') {
      return res.status(400).json({
        success: false,
        code: 'INVALID_SYMBOL',
        message: `Invalid symbol '${rawSymbol}'. Allowed symbols: ${ALLOWED_SYMBOLS.join(', ')}`
      });
    }

    const symbol = normalizeSymbol(rawSymbol);

    if (!symbol || !ALLOWED_SYMBOLS.includes(symbol)) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_SYMBOL',
        message: `Invalid symbol '${rawSymbol}'. Allowed symbols: ${ALLOWED_SYMBOLS.join(', ')}`
      });
    }

    const data = await getPriceInLKR(symbol);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: "Failed to fetch market data",
    });
  }
};

exports.getMultiplePrices = async (req, res) => {
  try {
    const rawSymbols = req.query.symbols ? req.query.symbols.split(',') : ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "ADAUSDT"];
    const includeSparkline = req.query.sparkline === 'true';

    const normalizedSymbols = [];
    for (const raw of rawSymbols) {
      if (!raw || typeof raw !== 'string') continue;
      const sym = normalizeSymbol(raw);
      if (!sym || !ALLOWED_SYMBOLS.includes(sym)) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_SYMBOL',
          message: `Invalid symbol '${raw}'. Allowed symbols: ${ALLOWED_SYMBOLS.join(', ')}`
        });
      }
      normalizedSymbols.push(sym);
    }

    if (normalizedSymbols.length === 0) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_SYMBOLS',
        message: 'No valid symbols provided.'
      });
    }

    const data = await getMultiplePricesInLKR(normalizedSymbols, includeSparkline);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
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
      code: 'SERVER_ERROR',
      message: "Failed to fetch all market data",
    });
  }
};

exports.getLive = async (req, res) => {
  try {
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

exports.getKlines = async (req, res) => {
  try {
    const { getKlinesWithIndicators } = require("../services/marketDataService");
    const rawSymbol = req.params.symbol || req.query.symbol || "BTCUSDT";
    let interval = (req.query.interval || "1h").toLowerCase().trim();
    let limit = parseInt(req.query.limit || "100", 10);

    const symbol = normalizeSymbol(rawSymbol);

    if (!symbol || !ALLOWED_SYMBOLS.includes(symbol)) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_SYMBOL',
        message: `Invalid symbol '${rawSymbol}'. Allowed symbols: ${ALLOWED_SYMBOLS.join(', ')}`
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
