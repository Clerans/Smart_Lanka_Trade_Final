const axios = require('axios');
const marketService = require('./marketService');
const {
  calculateSMASeries,
  calculateEMASeries,
  calculateRSI,
  calculateMACD,
  calculateBollingerBands
} = require('../utils/technicalIndicators');

// In-memory cache for candlestick data to prevent rate limits
// Key: `${symbol}_${interval}_${limit}` -> { data: result, timestamp: number }
const klineCache = new Map();
const CACHE_TTL_MS = 60 * 1000; // 1 minute TTL for fresh live charts

const SUPPORTED_SYMBOLS = [
  'BTCUSDT',
  'ETHUSDT',
  'BNBUSDT',
  'SOLUSDT',
  'XRPUSDT',
  'ADAUSDT',
  'DOGEUSDT'
];

const VALID_INTERVALS = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];

/**
 * Validates trading symbol
 * @param {string} symbol 
 * @returns {string} normalized symbol
 */
function validateSymbol(symbol) {
  if (!symbol || typeof symbol !== 'string') {
    throw new Error('Invalid symbol parameter');
  }
  let normalized = symbol.toUpperCase().trim().replace('/', '').replace('LKR', 'USDT');
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
  const safeLimit = Math.min(Math.max(limit, 20), 500);

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
 * Fetches historical candles formatted with LKR conversion and technical indicators
 * @param {string} symbol 
 * @param {string} interval 
 * @param {number} limit 
 */
async function getKlinesWithIndicators(symbol = 'BTCUSDT', interval = '1h', limit = 100) {
  const normSymbol = validateSymbol(symbol);
  const normInterval = validateInterval(interval);
  
  const [candles, usdToLkr, ticker] = await Promise.all([
    getHistoricalCandles(normSymbol, normInterval, limit),
    marketService.getUSDToLKR(),
    marketService.getCryptoTicker(normSymbol)
  ]);

  const closePrices = candles.map(c => c.close);
  const sma20Series = calculateSMASeries(closePrices, 20);
  const ema50Series = calculateEMASeries(closePrices, Math.min(50, closePrices.length - 1));
  const currentRSI = calculateRSI(closePrices, 14);
  const currentMACD = calculateMACD(closePrices);
  const currentBB = calculateBollingerBands(closePrices, 20, 2);

  // Map candles with LKR prices
  const formattedCandles = candles.map((c, index) => {
    // Offset for SMA 20: starts at index 19
    const sma20 = index >= 19 ? sma20Series[index - 19] : null;
    // Offset for EMA 50
    const emaOffset = Math.min(50, closePrices.length - 1) - 1;
    const ema50 = index >= emaOffset ? ema50Series[index - emaOffset] : null;

    return {
      timestamp: c.timestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
      closeTime: c.closeTime,
      openLKR: c.open * usdToLkr,
      highLKR: c.high * usdToLkr,
      lowLKR: c.low * usdToLkr,
      closeLKR: c.close * usdToLkr,
      sma20: sma20 ? parseFloat(sma20.toFixed(4)) : null,
      sma20LKR: sma20 ? parseFloat((sma20 * usdToLkr).toFixed(2)) : null,
      ema50: ema50 ? parseFloat(ema50.toFixed(4)) : null,
      ema50LKR: ema50 ? parseFloat((ema50 * usdToLkr).toFixed(2)) : null
    };
  });

  return {
    symbol: normSymbol,
    coin: normSymbol.replace('USDT', ''),
    interval: normInterval,
    usdToLkr,
    currentPriceUSD: ticker.price,
    currentPriceLKR: ticker.price * usdToLkr,
    change24h: ticker.changePercent,
    indicators: {
      rsi14: currentRSI,
      macd: currentMACD,
      bollingerBands: currentBB
    },
    candles: formattedCandles
  };
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
  getKlinesWithIndicators,
  getLivePriceData
};
