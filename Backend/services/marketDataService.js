const axios = require('axios');
const marketService = require('./marketService');

// In-memory cache for candlestick data to prevent rate limits
// Key: `${symbol}_${interval}_${limit}` -> { data: candles, timestamp: number }
const klineCache = new Map();
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes TTL

const SUPPORTED_SYMBOLS = [
  'BTCUSDT',
  'ETHUSDT',
  'BNBUSDT',
  'SOLUSDT',
  'XRPUSDT',
  'ADAUSDT',
  'DOGEUSDT'
];

const VALID_INTERVALS = ['15m', '30m', '1h', '4h', '1d'];

/**
 * Validates trading symbol
 * @param {string} symbol 
 * @returns {string} normalized symbol
 */
function validateSymbol(symbol) {
  if (!symbol || typeof symbol !== 'string') {
    throw new Error('Invalid symbol parameter');
  }
  let normalized = symbol.toUpperCase().trim();
  if (!normalized.endsWith('USDT')) {
    normalized = normalized + 'USDT';
  }
  if (!SUPPORTED_SYMBOLS.includes(normalized)) {
    if (normalized.length < 5) {
      throw new Error(`Symbol '${symbol}' is not supported. Supported symbols: ${SUPPORTED_SYMBOLS.join(', ')}`);
    }
  }
  return normalized;
}

/**
 * Validates candlestick interval
 * @param {string} interval 
 * @returns {string}
 */
function validateInterval(interval = '1h') {
  if (!VALID_INTERVALS.includes(interval)) {
    return '1h'; // Default to 1h
  }
  return interval;
}

/**
 * Fetches historical candlestick (Kline) data from Binance with caching
 * @param {string} symbol - e.g. "BTCUSDT"
 * @param {string} interval - e.g. "1h"
 * @param {number} limit - number of candles (default: 100)
 * @returns {Promise<Array<{ timestamp: number, open: number, high: number, low: number, close: number, volume: number, closeTime: number }>>}
 */
async function getHistoricalCandles(symbol = 'BTCUSDT', interval = '1h', limit = 100) {
  const normSymbol = validateSymbol(symbol);
  const normInterval = validateInterval(interval);
  const safeLimit = Math.min(Math.max(limit, 30), 500);

  const cacheKey = `${normSymbol}_${normInterval}_${safeLimit}`;
  const cached = klineCache.get(cacheKey);

  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const url = `https://api.binance.com/api/v3/klines?symbol=${normSymbol}&interval=${normInterval}&limit=${safeLimit}`;
    const response = await axios.get(url, { timeout: 8000 });

    if (!Array.isArray(response.data) || response.data.length === 0) {
      throw new Error(`No candle data returned for ${normSymbol}`);
    }

    const candles = response.data.map(k => ({
      timestamp: parseInt(k[0], 10),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
      closeTime: parseInt(k[6], 10)
    }));

    klineCache.set(cacheKey, {
      data: candles,
      timestamp: Date.now()
    });

    return candles;
  } catch (error) {
    console.error(`⚠️ Binance Kline fetch error for ${normSymbol} (${normInterval}):`, error.message);

    // If we have stale cache, return it as fallback
    if (cached) {
      console.log(`ℹ️ Returning stale Kline cache for ${normSymbol}`);
      return cached.data;
    }

    throw new Error(`Failed to retrieve market candlestick data: ${error.message}`);
  }
}

/**
 * Gets live price and USD->LKR conversion for a symbol
 * @param {string} symbol 
 */
async function getLivePriceData(symbol = 'BTCUSDT') {
  const normSymbol = validateSymbol(symbol);
  return await marketService.getPriceInLKR(normSymbol);
}

module.exports = {
  SUPPORTED_SYMBOLS,
  VALID_INTERVALS,
  validateSymbol,
  validateInterval,
  getHistoricalCandles,
  getLivePriceData
};
