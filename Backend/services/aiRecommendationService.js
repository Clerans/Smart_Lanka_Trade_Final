const technicalIndicators = require('../utils/technicalIndicators');
const marketDataService = require('./marketDataService');

// In-memory cache for recommendations
// Key: `${symbol}_${interval}` -> { data: recommendation, timestamp: number }
const recommendationCache = new Map();
const REC_CACHE_TTL_MS = 60 * 1000; // 1 minute TTL

// Configurable Scoring Constants
const CONFIG = {
  THRESHOLDS: {
    BUY: 3.0,
    SELL: -3.0,
  },
  WEIGHTS: {
    PRICE_VS_SMA20: 1.0,
    SMA20_VS_SMA50: 1.5,
    EMA20_VS_SMA20: 1.0,
    RSI_BULLISH: 1.5,
    RSI_BEARISH: -1.5,
    RSI_OVERBOUGHT: -0.5,
    RSI_OVERSOLD: 1.0,
    MACD_POSITIVE: 1.5,
    MACD_NEGATIVE: -1.5,
    BOLLINGER_UPPER: -0.5,
    BOLLINGER_LOWER: 0.5,
    VOLUME_CONFIRMATION: 1.0,
  },
  RISK_THRESHOLDS: {
    LOW_ATR_PCT: 1.5,
    HIGH_ATR_PCT: 3.5,
  }
};

/**
 * Calculates all technical indicators from raw candles
 * @param {Array<{ timestamp: number, open: number, high: number, low: number, close: number, volume: number }>} candles 
 */
function extractFeatures(candles) {
  if (!candles || candles.length < 50) {
    throw new Error(`Insufficient historical candles for feature extraction (found ${candles ? candles.length : 0}, required at least 50)`);
  }

  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume);
  const currentPrice = closes[closes.length - 1];

  const sma20 = technicalIndicators.calculateSMA(closes, 20);
  const sma50 = technicalIndicators.calculateSMA(closes, 50);
  const ema20 = technicalIndicators.calculateEMA(closes, 20);
  const rsi = technicalIndicators.calculateRSI(closes, 14);
  const macdData = technicalIndicators.calculateMACD(closes, 12, 26, 9);
  const bollinger = technicalIndicators.calculateBollingerBands(closes, 20, 2);
  const atr = technicalIndicators.calculateATR(candles, 14);
  const volatility = technicalIndicators.calculateVolatility(closes, 20);
  const momentum = technicalIndicators.calculateMomentum(closes, 10);
  const volumeRatio = technicalIndicators.calculateVolumeRatio(volumes, 20);

  // Price change over last 24 periods / 24h
  const open24 = candles.length >= 24 ? candles[candles.length - 24].open : candles[0].open;
  const change24h = open24 > 0 ? ((currentPrice - open24) / open24) * 100 : 0;

  return {
    currentPrice: parseFloat(currentPrice.toFixed(4)),
    change24h: parseFloat(change24h.toFixed(2)),
    sma20: sma20 !== null ? parseFloat(sma20.toFixed(4)) : null,
    sma50: sma50 !== null ? parseFloat(sma50.toFixed(4)) : null,
    ema20: ema20 !== null ? parseFloat(ema20.toFixed(4)) : null,
    rsi: rsi !== null ? parseFloat(rsi.toFixed(2)) : null,
    macd: macdData ? macdData.macd : 0,
    macdSignal: macdData ? macdData.signal : 0,
    macdHistogram: macdData ? macdData.histogram : 0,
    bollinger: bollinger || { upper: currentPrice, middle: currentPrice, lower: currentPrice, bandwidth: 0 },
    atr: atr !== null ? parseFloat(atr.toFixed(4)) : null,
    volatility: volatility !== null ? parseFloat(volatility.toFixed(6)) : 0.02,
    momentum: momentum !== null ? momentum : 0,
    volumeRatio: volumeRatio !== null ? volumeRatio : 1.0
  };
}

/**
 * Determines overall market trend
 */
function determineTrend(price, sma20, sma50, ema20) {
  if (!sma20 || !sma50) return 'NEUTRAL';
  if (price > sma20 && sma20 > sma50) {
    return 'BULLISH';
  }
  if (price < sma20 && sma20 < sma50) {
    return 'BEARISH';
  }
  if (price > sma20 && ema20 > sma20) {
    return 'BULLISH';
  }
  if (price < sma20 && ema20 < sma20) {
    return 'BEARISH';
  }
  return 'NEUTRAL';
}

/**
 * Generates recommendation, confidence score, risk level, and explanations
 * @param {object} features 
 * @param {object} liveRateData 
 */
function evaluateSignals(features, liveRateData) {
  let score = 0;
  let totalSignalsEvaluated = 0;
  let alignedBullishSignals = 0;
  let alignedBearishSignals = 0;
  const reasons = [];

  const {
    currentPrice,
    change24h,
    sma20,
    sma50,
    ema20,
    rsi,
    macd,
    macdSignal,
    macdHistogram,
    bollinger,
    atr,
    volatility,
    momentum,
    volumeRatio
  } = features;

  // 1. Price vs SMA 20
  if (sma20 !== null) {
    totalSignalsEvaluated++;
    if (currentPrice > sma20) {
      score += CONFIG.WEIGHTS.PRICE_VS_SMA20;
      alignedBullishSignals++;
      reasons.push(`Price ($${currentPrice.toLocaleString()}) is trading above the 20-period SMA ($${sma20.toLocaleString()})`);
    } else {
      score -= CONFIG.WEIGHTS.PRICE_VS_SMA20;
      alignedBearishSignals++;
      reasons.push(`Price ($${currentPrice.toLocaleString()}) is trading below the 20-period SMA ($${sma20.toLocaleString()})`);
    }
  }

  // 2. SMA 20 vs SMA 50 (Golden Cross / Death Cross alignment)
  if (sma20 !== null && sma50 !== null) {
    totalSignalsEvaluated++;
    if (sma20 >= sma50) {
      score += CONFIG.WEIGHTS.SMA20_VS_SMA50;
      alignedBullishSignals++;
      reasons.push('20-period SMA is above 50-period SMA, confirming medium-term upward trend');
    } else {
      score -= CONFIG.WEIGHTS.SMA20_VS_SMA50;
      alignedBearishSignals++;
      reasons.push('20-period SMA is below 50-period SMA, indicating medium-term downward pressure');
    }
  }

  // 3. EMA 20 vs SMA 20 (Short-term momentum)
  if (ema20 !== null && sma20 !== null) {
    totalSignalsEvaluated++;
    if (ema20 >= sma20) {
      score += CONFIG.WEIGHTS.EMA20_VS_SMA20;
      alignedBullishSignals++;
      reasons.push('Short-term 20 EMA is trending above 20 SMA with positive momentum');
    } else {
      score -= CONFIG.WEIGHTS.EMA20_VS_SMA20;
      alignedBearishSignals++;
      reasons.push('Short-term 20 EMA is below 20 SMA, signaling cooling momentum');
    }
  }

  // 4. RSI (14) Evaluation
  if (rsi !== null) {
    totalSignalsEvaluated++;
    if (rsi >= 50 && rsi <= 70) {
      score += CONFIG.WEIGHTS.RSI_BULLISH;
      alignedBullishSignals++;
      reasons.push(`RSI (${rsi}) indicates steady bullish momentum without overbought risk`);
    } else if (rsi > 70) {
      score += CONFIG.WEIGHTS.RSI_OVERBOUGHT;
      alignedBearishSignals++;
      reasons.push(`RSI (${rsi}) is in overbought territory (>70); potential short-term pullback`);
    } else if (rsi < 30) {
      score += CONFIG.WEIGHTS.RSI_OVERSOLD;
      alignedBullishSignals++;
      reasons.push(`RSI (${rsi}) is deeply oversold (<30); potential accumulation/rebound zone`);
    } else {
      score += CONFIG.WEIGHTS.RSI_BEARISH;
      alignedBearishSignals++;
      reasons.push(`RSI (${rsi}) is in bearish territory (<50)`);
    }
  }

  // 5. MACD (12, 26, 9)
  if (macdHistogram !== undefined) {
    totalSignalsEvaluated++;
    if (macdHistogram > 0) {
      score += CONFIG.WEIGHTS.MACD_POSITIVE;
      alignedBullishSignals++;
      reasons.push(`MACD histogram is positive (${macdHistogram}) with MACD line above signal line`);
    } else {
      score -= CONFIG.WEIGHTS.MACD_POSITIVE;
      alignedBearishSignals++;
      reasons.push(`MACD histogram is negative (${macdHistogram}), indicating selling pressure`);
    }
  }

  // 6. Bollinger Bands
  if (bollinger) {
    if (currentPrice > bollinger.upper) {
      score += CONFIG.WEIGHTS.BOLLINGER_UPPER;
      reasons.push('Price pierced upper Bollinger Band; volatility breakout with resistance caution');
    } else if (currentPrice < bollinger.lower) {
      score += CONFIG.WEIGHTS.BOLLINGER_LOWER;
      reasons.push('Price tested lower Bollinger Band; technical support bounce zone');
    }
  }

  // 7. Volume Confirmation
  if (volumeRatio > 1.2) {
    if (change24h > 0) {
      score += CONFIG.WEIGHTS.VOLUME_CONFIRMATION;
      alignedBullishSignals++;
      reasons.push(`Volume is ${volumeRatio}x above 20-period average, confirming buying conviction`);
    } else if (change24h < 0) {
      score -= CONFIG.WEIGHTS.VOLUME_CONFIRMATION;
      alignedBearishSignals++;
      reasons.push(`High trading volume (${volumeRatio}x average) observed on negative price action`);
    }
  }

  // Determine Recommendation
  let recommendation = 'HOLD';
  if (score >= CONFIG.THRESHOLDS.BUY) {
    recommendation = 'BUY';
  } else if (score <= CONFIG.THRESHOLDS.SELL) {
    recommendation = 'SELL';
  }

  // Determine Model Confidence (0 - 100%)
  // Reflects signal agreement
  let confidence = 50;
  if (totalSignalsEvaluated > 0) {
    const dominantCount = Math.max(alignedBullishSignals, alignedBearishSignals);
    const agreementRatio = dominantCount / totalSignalsEvaluated;
    
    // Scale agreement ratio (0.5 -> 50%, 1.0 -> 92%)
    confidence = Math.round(45 + (agreementRatio * 45) + (Math.min(Math.abs(score) / 8, 1) * 10));
    confidence = Math.max(35, Math.min(confidence, 96));
  }

  // Determine Risk Level (LOW, MEDIUM, HIGH)
  const atrPercent = (atr && currentPrice > 0) ? (atr / currentPrice) * 100 : (volatility * 100);
  const signalDisagreement = Math.min(alignedBullishSignals, alignedBearishSignals) >= 2;

  let risk = 'MEDIUM';
  if (atrPercent < CONFIG.RISK_THRESHOLDS.LOW_ATR_PCT && !signalDisagreement && confidence >= 70) {
    risk = 'LOW';
  } else if (atrPercent > CONFIG.RISK_THRESHOLDS.HIGH_ATR_PCT || (signalDisagreement && confidence < 60) || Math.abs(change24h) > 6) {
    risk = 'HIGH';
  }

  const trend = determineTrend(currentPrice, sma20, sma50, ema20);

  // Interpretation summary for user
  const usdToLkr = liveRateData ? liveRateData.usdToLkr : 305.0;
  const priceLKR = liveRateData ? liveRateData.priceLKR : currentPrice * usdToLkr;

  let summary = '';
  if (recommendation === 'BUY') {
    summary = `Bullish technical setup with strong moving average alignment and positive MACD histogram. Multi-indicator agreement supports entry with ${confidence}% model confidence.`;
  } else if (recommendation === 'SELL') {
    summary = `Bearish pressure detected across key moving averages and negative momentum oscillators. Model recommends risk mitigation/sell with ${confidence}% confidence.`;
  } else {
    summary = `Market is currently consolidating within Bollinger Bands with mixed momentum signals. Model suggests waiting for a clearer directional breakout.`;
  }

  return {
    recommendation,
    confidence,
    risk,
    trend,
    score: parseFloat(score.toFixed(2)),
    priceUSD: currentPrice,
    priceLKR: parseFloat(priceLKR.toFixed(2)),
    change24h,
    usdToLkr: parseFloat(usdToLkr.toFixed(2)),
    indicators: {
      rsi,
      sma20,
      sma50,
      ema20,
      macd,
      macdSignal,
      macdHistogram,
      volatility: parseFloat(volatility.toFixed(6)),
      atr,
      bollinger: {
        upper: bollinger.upper,
        middle: bollinger.middle,
        lower: bollinger.lower,
        bandwidth: bollinger.bandwidth
      },
      momentum,
      volumeRatio
    },
    reasons,
    summary,
    generatedAt: new Date().toISOString()
  };
}

/**
 * Generates recommendation for a single symbol
 * @param {string} symbol - e.g. "BTCUSDT"
 * @param {string} interval - default: "1h"
 */
async function getRecommendation(symbol = 'BTCUSDT', interval = '1h') {
  const normSymbol = marketDataService.validateSymbol(symbol);
  const normInterval = marketDataService.validateInterval(interval);

  const cacheKey = `${normSymbol}_${normInterval}`;
  const cached = recommendationCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < REC_CACHE_TTL_MS) {
    return cached.data;
  }

  // Fetch candles & live exchange rates in parallel
  const [candles, liveRateData] = await Promise.all([
    marketDataService.getHistoricalCandles(normSymbol, normInterval, 100),
    marketDataService.getLivePriceData(normSymbol)
  ]);

  const features = extractFeatures(candles);
  const result = evaluateSignals(features, liveRateData);

  const payload = {
    symbol: normSymbol,
    coin: normSymbol.replace('USDT', ''),
    interval: normInterval,
    ...result
  };

  recommendationCache.set(cacheKey, {
    data: payload,
    timestamp: Date.now()
  });

  return payload;
}

/**
 * Generates recommendations for all supported assets
 * @param {string} interval - default: "1h"
 */
async function getAllRecommendations(interval = '1h') {
  const symbols = marketDataService.SUPPORTED_SYMBOLS;
  const results = await Promise.allSettled(
    symbols.map(sym => getRecommendation(sym, interval))
  );

  const recommendations = [];
  results.forEach((res, index) => {
    if (res.status === 'fulfilled') {
      recommendations.push(res.value);
    } else {
      console.error(`Error generating recommendation for ${symbols[index]}:`, res.reason?.message);
    }
  });

  return recommendations;
}

module.exports = {
  CONFIG,
  extractFeatures,
  determineTrend,
  evaluateSignals,
  getRecommendation,
  getAllRecommendations
};
