/**
 * Technical Indicators Calculation Utility
 * SmartLanka Trade AI Engine
 * 
 * Provides mathematically accurate calculations for:
 * - SMA (Simple Moving Average)
 * - EMA (Exponential Moving Average)
 * - RSI (Relative Strength Index using Wilder's Smoothing)
 * - MACD (Moving Average Convergence Divergence)
 * - Bollinger Bands (Upper, Middle, Lower)
 * - ATR (Average True Range)
 * - Historical Volatility (Standard deviation of returns)
 * - Momentum / Rate of Change (ROC)
 */

/**
 * Calculates Simple Moving Average (SMA)
 * @param {number[]} data - Array of price values (e.g. closing prices)
 * @param {number} period - Number of periods
 * @returns {number|null} Current SMA value or null if insufficient data
 */
function calculateSMA(data, period) {
  if (!Array.isArray(data) || data.length < period || period <= 0) {
    return null;
  }
  const slice = data.slice(-period);
  const sum = slice.reduce((acc, val) => acc + (parseFloat(val) || 0), 0);
  return sum / period;
}

/**
 * Calculates full SMA series
 * @param {number[]} data 
 * @param {number} period 
 * @returns {number[]} Array of SMA values
 */
function calculateSMASeries(data, period) {
  if (!Array.isArray(data) || data.length < period || period <= 0) return [];
  const result = [];
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    const sum = slice.reduce((acc, val) => acc + (parseFloat(val) || 0), 0);
    result.push(sum / period);
  }
  return result;
}

/**
 * Calculates Exponential Moving Average (EMA) series
 * @param {number[]} data - Array of price values
 * @param {number} period - Number of periods
 * @returns {number[]} Array of EMA values matching data slice starting from period-1
 */
function calculateEMASeries(data, period) {
  if (!Array.isArray(data) || data.length < period || period <= 0) {
    return [];
  }
  const k = 2 / (period + 1);
  const result = [];
  
  // First EMA value is SMA of the first `period` elements
  let firstSMA = 0;
  for (let i = 0; i < period; i++) {
    firstSMA += parseFloat(data[i]) || 0;
  }
  firstSMA /= period;
  result.push(firstSMA);

  let prevEMA = firstSMA;
  for (let i = period; i < data.length; i++) {
    const currentPrice = parseFloat(data[i]) || 0;
    const currentEMA = (currentPrice * k) + (prevEMA * (1 - k));
    result.push(currentEMA);
    prevEMA = currentEMA;
  }
  return result;
}

/**
 * Calculates latest EMA value
 * @param {number[]} data 
 * @param {number} period 
 * @returns {number|null}
 */
function calculateEMA(data, period) {
  const series = calculateEMASeries(data, period);
  return series.length > 0 ? series[series.length - 1] : null;
}

/**
 * Calculates Relative Strength Index (RSI) using standard Wilder's Smoothing
 * @param {number[]} closes - Array of closing prices
 * @param {number} period - Period length (default: 14)
 * @returns {number|null} RSI value between 0 and 100
 */
function calculateRSI(closes, period = 14) {
  if (!Array.isArray(closes) || closes.length < period + 1) {
    return null;
  }

  const changes = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }

  let gains = 0;
  let losses = 0;

  // First period average gain/loss
  for (let i = 0; i < period; i++) {
    const change = changes[i];
    if (change >= 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  // Smooth using Wilder's method for subsequent periods
  for (let i = period; i < changes.length; i++) {
    const change = changes[i];
    const currentGain = change >= 0 ? change : 0;
    const currentLoss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;
  }

  if (avgLoss === 0) {
    return avgGain === 0 ? 50 : 100;
  }

  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  return parseFloat(rsi.toFixed(2));
}

/**
 * Calculates Moving Average Convergence Divergence (MACD)
 * @param {number[]} closes - Array of closing prices
 * @param {number} fastPeriod - Fast EMA period (default: 12)
 * @param {number} slowPeriod - Slow EMA period (default: 26)
 * @param {number} signalPeriod - Signal line EMA period (default: 9)
 * @returns {{ macd: number, signal: number, histogram: number }|null}
 */
function calculateMACD(closes, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  if (!Array.isArray(closes) || closes.length < slowPeriod + signalPeriod) {
    return null;
  }

  const fastEMA = calculateEMASeries(closes, fastPeriod);
  const slowEMA = calculateEMASeries(closes, slowPeriod);

  // Align series: fastEMA starts at fastPeriod-1, slowEMA starts at slowPeriod-1
  const offset = slowPeriod - fastPeriod;
  const macdLine = [];
  for (let i = 0; i < slowEMA.length; i++) {
    macdLine.push(fastEMA[i + offset] - slowEMA[i]);
  }

  if (macdLine.length < signalPeriod) {
    return null;
  }

  const signalLine = calculateEMASeries(macdLine, signalPeriod);
  const currentMACD = macdLine[macdLine.length - 1];
  const currentSignal = signalLine[signalLine.length - 1];
  const histogram = currentMACD - currentSignal;

  return {
    macd: parseFloat(currentMACD.toFixed(4)),
    signal: parseFloat(currentSignal.toFixed(4)),
    histogram: parseFloat(histogram.toFixed(4))
  };
}

/**
 * Calculates Bollinger Bands (Upper, Middle, Lower)
 * @param {number[]} closes - Array of closing prices
 * @param {number} period - Period (default: 20)
 * @param {number} multiplier - Standard deviation multiplier (default: 2)
 * @returns {{ upper: number, middle: number, lower: number, bandwidth: number }|null}
 */
function calculateBollingerBands(closes, period = 20, multiplier = 2) {
  if (!Array.isArray(closes) || closes.length < period) {
    return null;
  }

  const slice = closes.slice(-period);
  const sma = slice.reduce((a, b) => a + b, 0) / period;
  
  const variance = slice.reduce((sum, val) => sum + Math.pow(val - sma, 2), 0) / period;
  const stdDev = Math.sqrt(variance);

  const upper = sma + (multiplier * stdDev);
  const lower = sma - (multiplier * stdDev);
  const bandwidth = sma > 0 ? (upper - lower) / sma : 0;

  return {
    upper: parseFloat(upper.toFixed(4)),
    middle: parseFloat(sma.toFixed(4)),
    lower: parseFloat(lower.toFixed(4)),
    bandwidth: parseFloat(bandwidth.toFixed(4))
  };
}

/**
 * Calculates Average True Range (ATR)
 * @param {Array<{ high: number, low: number, close: number }>} candles 
 * @param {number} period - default: 14
 * @returns {number|null}
 */
function calculateATR(candles, period = 14) {
  if (!Array.isArray(candles) || candles.length < period + 1) {
    return null;
  }

  const trueRanges = [];
  for (let i = 1; i < candles.length; i++) {
    const current = candles[i];
    const prev = candles[i - 1];

    const tr1 = current.high - current.low;
    const tr2 = Math.abs(current.high - prev.close);
    const tr3 = Math.abs(current.low - prev.close);

    trueRanges.push(Math.max(tr1, tr2, tr3));
  }

  // First ATR is simple average of first `period` TRs
  let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;

  // Subsequent smoothed ATR
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
  }

  return parseFloat(atr.toFixed(4));
}

/**
 * Calculates Historical Volatility (Standard Deviation of log returns normalized)
 * @param {number[]} closes 
 * @param {number} period - default: 20
 * @returns {number|null}
 */
function calculateVolatility(closes, period = 20) {
  if (!Array.isArray(closes) || closes.length < period + 1) {
    return null;
  }

  const returns = [];
  const slice = closes.slice(-(period + 1));
  for (let i = 1; i < slice.length; i++) {
    const prev = slice[i - 1];
    if (prev > 0) {
      returns.push(Math.log(slice[i] / prev));
    }
  }

  if (returns.length === 0) return null;

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  return parseFloat(stdDev.toFixed(6));
}

/**
 * Calculates Price Momentum (Rate of Change % over N periods)
 * @param {number[]} closes 
 * @param {number} period - default: 10
 * @returns {number|null}
 */
function calculateMomentum(closes, period = 10) {
  if (!Array.isArray(closes) || closes.length < period + 1) {
    return null;
  }
  const current = closes[closes.length - 1];
  const previous = closes[closes.length - 1 - period];
  if (previous === 0) return 0;
  const roc = ((current - previous) / previous) * 100;
  return parseFloat(roc.toFixed(2));
}

/**
 * Calculates Volume Ratio (Current Volume / 20-period Average Volume)
 * @param {number[]} volumes 
 * @param {number} period - default: 20
 * @returns {number|null}
 */
function calculateVolumeRatio(volumes, period = 20) {
  if (!Array.isArray(volumes) || volumes.length < period) {
    return null;
  }
  const currentVol = volumes[volumes.length - 1];
  const avgVol = calculateSMA(volumes, period);
  if (!avgVol || avgVol === 0) return 1.0;
  return parseFloat((currentVol / avgVol).toFixed(2));
}

module.exports = {
  calculateSMA,
  calculateSMASeries,
  calculateEMA,
  calculateEMASeries,
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateATR,
  calculateVolatility,
  calculateMomentum,
  calculateVolumeRatio
};
