/**
 * SmartLanka Trade — AI Recommendation Backtesting & Research Evaluation Engine
 * 
 * Strict Scientific Standards:
 * 1. Zero Data Leakage: At timestamp T, only candles strictly preceding and including T are visible to indicator calculation.
 * 2. Multi-Horizon Assessment: Predictive returns evaluated across 1h, 4h, and 24h future periods.
 * 3. Academic Evaluation Metrics: Precision, Recall, F1-Score, Directional Accuracy, Confusion Matrix, and Confidence/Risk stratification.
 * 4. Offline Paper Trading Simulation: Non-custodial isolated virtual balance (LKR 1,000,000) simulation.
 */

const axios = require('axios');
const technicalIndicators = require('../utils/technicalIndicators');
const { extractFeatures, evaluateSignals } = require('./aiRecommendationService');

// Return thresholds for categorizing actual price movement
const HORIZON_THRESHOLDS = {
  1: 0.35,   // 1h: +/- 0.35%
  4: 0.75,   // 4h: +/- 0.75%
  24: 1.50   // 24h: +/- 1.50%
};

/**
 * Validates candle data integrity
 * @param {Array} candles 
 * @returns {{ validCandles: Array, skippedCount: number, errorCount: number }}
 */
function validateAndSanitizeCandles(candles) {
  if (!Array.isArray(candles) || candles.length === 0) {
    return { validCandles: [], skippedCount: 0, errorCount: 0 };
  }

  const validCandles = [];
  let errorCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const timestamp = Number(c[0] || c.timestamp || c.time);
    const open = parseFloat(c[1] || c.open);
    const high = parseFloat(c[2] || c.high);
    const low = parseFloat(c[3] || c.low);
    const close = parseFloat(c[4] || c.close);
    const volume = parseFloat(c[5] || c.volume);

    // Validate finite numeric values and basic OHLC constraints
    if (
      isNaN(timestamp) || isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close) || isNaN(volume) ||
      open <= 0 || high <= 0 || low <= 0 || close <= 0 ||
      high < low || high < open || high < close || low > open || low > close
    ) {
      errorCount++;
      continue;
    }

    // Ensure strict ascending timestamp order
    if (validCandles.length > 0 && timestamp <= validCandles[validCandles.length - 1].timestamp) {
      skippedCount++;
      continue;
    }

    validCandles.push({
      timestamp,
      open,
      high,
      low,
      close,
      volume
    });
  }

  return { validCandles, skippedCount, errorCount };
}

/**
 * Fetches historical Kline candles from Binance API
 * @param {string} symbol 
 * @param {string} interval 
 * @param {number} limit 
 * @param {number|null} startTime 
 * @param {number|null} endTime 
 */
async function fetchHistoricalKlines(symbol = 'BTCUSDT', interval = '1h', limit = 500, startTime = null, endTime = null) {
  let url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${Math.min(limit, 1000)}`;
  if (startTime) url += `&startTime=${startTime}`;
  if (endTime) url += `&endTime=${endTime}`;

  const response = await axios.get(url, { timeout: 15000 });
  return response.data;
}

/**
 * Calculates classification metrics safely without division by zero
 */
function calculateClassificationMetrics(tp, fp, fn, total) {
  const precision = (tp + fp) > 0 ? tp / (tp + fp) : 0;
  const recall = (tp + fn) > 0 ? tp / (tp + fn) : 0;
  const f1 = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const accuracy = total > 0 ? tp / total : 0;

  return {
    accuracy: parseFloat(accuracy.toFixed(4)),
    precision: parseFloat(precision.toFixed(4)),
    recall: parseFloat(recall.toFixed(4)),
    f1Score: parseFloat(f1.toFixed(4))
  };
}

/**
 * Runs walk-forward backtest evaluation across multi-horizons
 * @param {object} config 
 */
async function runBacktest(config = {}) {
  const symbol = config.symbol || 'BTCUSDT';
  const interval = config.interval || '1h';
  const limit = config.limit || 500;
  const horizons = config.horizons || [1, 4, 24];
  const minLookback = config.minLookback || 50;
  const startingCapitalLKR = config.startingCapitalLKR || 1000000.00;

  let rawCandles = config.candles;
  if (!rawCandles) {
    rawCandles = await fetchHistoricalKlines(symbol, interval, limit, config.startTime, config.endTime);
  }

  const { validCandles, skippedCount, errorCount } = validateAndSanitizeCandles(rawCandles);

  if (validCandles.length < minLookback + Math.max(...horizons)) {
    throw new Error(`Insufficient historical candles for backtesting: got ${validCandles.length}, required at least ${minLookback + Math.max(...horizons)}`);
  }

  const evaluations = [];
  const maxHorizon = Math.max(...horizons);

  // Walk-forward simulation: strictly [0 ... t] at timestamp T (No Data Leakage)
  for (let t = minLookback; t < validCandles.length - maxHorizon; t++) {
    const historicalSlice = validCandles.slice(0, t + 1);
    const currentCandle = validCandles[t];
    const currentPrice = currentCandle.close;

    // Calculate technical indicators using ONLY data up to T
    const indicators = calculateIndicators(historicalSlice);
    if (!indicators || !indicators.rsi) continue;

    // Generate AI Recommendation at timestamp T
    const rec = evaluateTechnicalSignals(indicators, currentPrice, symbol);
    if (!rec) continue;

    // Evaluate future outcomes across each horizon
    const horizonOutcomes = {};
    for (const h of horizons) {
      const futureCandle = validCandles[t + h];
      const futurePrice = futureCandle.close;
      const futureReturnPct = ((futurePrice - currentPrice) / currentPrice) * 100;
      const threshold = HORIZON_THRESHOLDS[h] || 0.5;

      let actualDirection = 'NEUTRAL';
      if (futureReturnPct > threshold) actualDirection = 'UP';
      else if (futureReturnPct < -threshold) actualDirection = 'DOWN';

      let isCorrect = false;
      if (rec.action === 'BUY' && actualDirection === 'UP') isCorrect = true;
      else if (rec.action === 'SELL' && actualDirection === 'DOWN') isCorrect = true;
      else if (rec.action === 'HOLD' && actualDirection === 'NEUTRAL') isCorrect = true;

      horizonOutcomes[h] = {
        futurePrice,
        returnPct: parseFloat(futureReturnPct.toFixed(4)),
        actualDirection,
        isCorrect
      };
    }

    evaluations.push({
      timestamp: currentCandle.timestamp,
      date: new Date(currentCandle.timestamp).toISOString(),
      price: currentPrice,
      recommendation: rec.action,
      confidence: rec.confidence,
      riskLevel: rec.riskLevel,
      rsi: indicators.rsi,
      macd: indicators.macd?.macd,
      outcomes: horizonOutcomes
    });
  }

  // --- COMPUTE AGGREGATE METRICS PER HORIZON ---
  const horizonResults = {};
  const confusionMatrices = {};

  for (const h of horizons) {
    let tpBuy = 0, fpBuy = 0, fnBuy = 0;
    let tpSell = 0, fpSell = 0, fnSell = 0;
    let tpHold = 0, fpHold = 0, fnHold = 0;
    let correctCount = 0;
    const total = evaluations.length;

    const matrix = {
      BUY: { UP: 0, NEUTRAL: 0, DOWN: 0 },
      HOLD: { UP: 0, NEUTRAL: 0, DOWN: 0 },
      SELL: { UP: 0, NEUTRAL: 0, DOWN: 0 }
    };

    const buyReturns = [];
    const sellReturns = [];
    const holdReturns = [];

    evaluations.forEach(e => {
      const out = e.outcomes[h];
      const pred = e.recommendation;
      const act = out.actualDirection;

      if (matrix[pred] && matrix[pred][act] !== undefined) {
        matrix[pred][act]++;
      }

      if (out.isCorrect) correctCount++;

      if (pred === 'BUY') {
        buyReturns.push(out.returnPct);
        if (act === 'UP') tpBuy++;
        else fpBuy++;
        if (act === 'UP' && pred !== 'BUY') fnBuy++;
      } else if (pred === 'SELL') {
        sellReturns.push(out.returnPct);
        if (act === 'DOWN') tpSell++;
        else fpSell++;
        if (act === 'DOWN' && pred !== 'SELL') fnSell++;
      } else {
        holdReturns.push(out.returnPct);
        if (act === 'NEUTRAL') tpHold++;
        else fpHold++;
        if (act === 'NEUTRAL' && pred !== 'HOLD') fnHold++;
      }
    });

    const buyMetrics = calculateClassificationMetrics(tpBuy, fpBuy, fnBuy, evaluations.filter(e => e.recommendation === 'BUY').length);
    const sellMetrics = calculateClassificationMetrics(tpSell, fpSell, fnSell, evaluations.filter(e => e.recommendation === 'SELL').length);
    const holdMetrics = calculateClassificationMetrics(tpHold, fpHold, fnHold, evaluations.filter(e => e.recommendation === 'HOLD').length);

    const macroPrecision = (buyMetrics.precision + sellMetrics.precision + holdMetrics.precision) / 3;
    const macroRecall = (buyMetrics.recall + sellMetrics.recall + holdMetrics.recall) / 3;
    const macroF1 = (macroPrecision + macroRecall) > 0 ? (2 * macroPrecision * macroRecall) / (macroPrecision + macroRecall) : 0;
    const overallAccuracy = total > 0 ? correctCount / total : 0;

    const avgBuyReturn = buyReturns.length > 0 ? buyReturns.reduce((a, b) => a + b, 0) / buyReturns.length : 0;
    const avgSellReturn = sellReturns.length > 0 ? sellReturns.reduce((a, b) => a + b, 0) / sellReturns.length : 0;
    const avgHoldReturn = holdReturns.length > 0 ? holdReturns.reduce((a, b) => a + b, 0) / holdReturns.length : 0;

    horizonResults[h] = {
      horizon: `${h}h`,
      sampleCount: total,
      accuracy: parseFloat((overallAccuracy * 100).toFixed(2)),
      macroPrecision: parseFloat(macroPrecision.toFixed(4)),
      macroRecall: parseFloat(macroRecall.toFixed(4)),
      macroF1Score: parseFloat(macroF1.toFixed(4)),
      buyCount: buyReturns.length,
      sellCount: sellReturns.length,
      holdCount: holdReturns.length,
      averageBuyReturnPct: parseFloat(avgBuyReturn.toFixed(2)),
      averageSellReturnPct: parseFloat(avgSellReturn.toFixed(2)),
      averageHoldReturnPct: parseFloat(avgHoldReturn.toFixed(2)),
      buyPrecision: buyMetrics.precision,
      sellPrecision: sellMetrics.precision,
      holdPrecision: holdMetrics.precision
    };

    confusionMatrices[h] = matrix;
  }

  // --- CONFIDENCE STRATIFICATION (Evaluated at primary 1h horizon) ---
  const confidenceBands = {
    '0-49%': { count: 0, correct: 0, returns: [] },
    '50-69%': { count: 0, correct: 0, returns: [] },
    '70-79%': { count: 0, correct: 0, returns: [] },
    '80-89%': { count: 0, correct: 0, returns: [] },
    '90-100%': { count: 0, correct: 0, returns: [] }
  };

  evaluations.forEach(e => {
    const conf = e.confidence;
    let band = '0-49%';
    if (conf >= 90) band = '90-100%';
    else if (conf >= 80) band = '80-89%';
    else if (conf >= 70) band = '70-79%';
    else if (conf >= 50) band = '50-69%';

    const out1h = e.outcomes[1] || e.outcomes[horizons[0]];
    confidenceBands[band].count++;
    if (out1h.isCorrect) confidenceBands[band].correct++;
    confidenceBands[band].returns.push(out1h.returnPct);
  });

  const confidenceAnalysis = {};
  for (const [band, data] of Object.entries(confidenceBands)) {
    const acc = data.count > 0 ? (data.correct / data.count) * 100 : 0;
    const avgRet = data.returns.length > 0 ? data.returns.reduce((a, b) => a + b, 0) / data.returns.length : 0;
    confidenceAnalysis[band] = {
      sampleCount: data.count,
      accuracyPct: parseFloat(acc.toFixed(2)),
      averageReturnPct: parseFloat(avgRet.toFixed(2))
    };
  }

  // --- RISK STRATIFICATION ---
  const riskGroups = {
    'LOW': { count: 0, correct: 0, returns: [] },
    'MEDIUM': { count: 0, correct: 0, returns: [] },
    'HIGH': { count: 0, correct: 0, returns: [] }
  };

  evaluations.forEach(e => {
    const risk = e.riskLevel || 'MEDIUM';
    const out1h = e.outcomes[1] || e.outcomes[horizons[0]];
    if (riskGroups[risk]) {
      riskGroups[risk].count++;
      if (out1h.isCorrect) riskGroups[risk].correct++;
      riskGroups[risk].returns.push(out1h.returnPct);
    }
  });

  const riskAnalysis = {};
  for (const [risk, data] of Object.entries(riskGroups)) {
    const acc = data.count > 0 ? (data.correct / data.count) * 100 : 0;
    const avgRet = data.returns.length > 0 ? data.returns.reduce((a, b) => a + b, 0) / data.returns.length : 0;
    riskAnalysis[risk] = {
      sampleCount: data.count,
      accuracyPct: parseFloat(acc.toFixed(2)),
      averageReturnPct: parseFloat(avgRet.toFixed(2))
    };
  }

  // --- OFFLINE PAPER TRADING SIMULATION (LKR 1,000,000) ---
  let capitalLKR = startingCapitalLKR;
  let holdings = 0;
  let tradeCount = 0;
  let winningTrades = 0;
  let losingTrades = 0;
  let peakEquity = capitalLKR;
  let maxDrawdownPct = 0;
  const TAKER_FEE_PCT = 0.0010; // 0.10%

  for (let i = 0; i < evaluations.length; i++) {
    const e = evaluations[i];
    const priceLKR = e.price * 328.2; // USD to LKR conversion factor

    if (e.recommendation === 'BUY' && capitalLKR > 10000 && holdings === 0) {
      // Allocate 50% capital
      const tradeAmount = capitalLKR * 0.5;
      const fee = tradeAmount * TAKER_FEE_PCT;
      holdings = (tradeAmount - fee) / priceLKR;
      capitalLKR -= tradeAmount;
      tradeCount++;
    } else if (e.recommendation === 'SELL' && holdings > 0) {
      const proceeds = holdings * priceLKR;
      const fee = proceeds * TAKER_FEE_PCT;
      const netProceeds = proceeds - fee;
      const entryEstimated = (proceeds / (1 + (e.outcomes[1]?.returnPct || 0) / 100));
      if (netProceeds > entryEstimated) winningTrades++;
      else losingTrades++;

      capitalLKR += netProceeds;
      holdings = 0;
      tradeCount++;
    }

    const currentTotalEquity = capitalLKR + (holdings * priceLKR);
    if (currentTotalEquity > peakEquity) peakEquity = currentTotalEquity;
    const currentDrawdown = ((peakEquity - currentTotalEquity) / peakEquity) * 100;
    if (currentDrawdown > maxDrawdownPct) maxDrawdownPct = currentDrawdown;
  }

  // Liquidate at end of backtest period
  const finalPriceLKR = evaluations[evaluations.length - 1].price * 328.2;
  const finalEquityLKR = capitalLKR + (holdings * finalPriceLKR);
  const totalReturnPct = ((finalEquityLKR - startingCapitalLKR) / startingCapitalLKR) * 100;
  const winRatePct = tradeCount > 0 ? (winningTrades / tradeCount) * 100 : 0;

  const paperTradingSimulation = {
    startingCapitalLKR: parseFloat(startingCapitalLKR.toFixed(2)),
    endingEquityLKR: parseFloat(finalEquityLKR.toFixed(2)),
    totalReturnPct: parseFloat(totalReturnPct.toFixed(2)),
    totalTrades: tradeCount,
    winningTrades,
    losingTrades,
    winRatePct: parseFloat(winRatePct.toFixed(2)),
    maxDrawdownPct: parseFloat(maxDrawdownPct.toFixed(2))
  };

  return {
    symbol,
    interval,
    period: {
      from: validCandles[minLookback].timestamp,
      to: validCandles[validCandles.length - 1 - maxHorizon].timestamp,
      startDate: new Date(validCandles[minLookback].timestamp).toISOString(),
      endDate: new Date(validCandles[validCandles.length - 1 - maxHorizon].timestamp).toISOString()
    },
    dataset: {
      totalCandlesLoaded: rawCandles.length,
      validCandlesCount: validCandles.length,
      evaluatedPoints: evaluations.length,
      skippedCount,
      errorCount
    },
    horizonResults,
    confusionMatrices,
    confidenceAnalysis,
    riskAnalysis,
    paperTradingSimulation
  };
}

/**
 * Runs backtest over all supported crypto pairs
 */
async function runMultiSymbolBacktest(symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT']) {
  const multiResults = {};
  for (const sym of symbols) {
    try {
      console.log(`⏳ Running empirical backtest for ${sym}...`);
      const res = await runBacktest({ symbol: sym, interval: '1h', limit: 500 });
      multiResults[sym] = res;
    } catch (err) {
      console.error(`❌ Backtest failed for ${sym}:`, err.message);
      multiResults[sym] = { error: err.message };
    }
  }
  return multiResults;
}

module.exports = {
  validateAndSanitizeCandles,
  fetchHistoricalKlines,
  calculateClassificationMetrics,
  runBacktest,
  runMultiSymbolBacktest,
  HORIZON_THRESHOLDS
};
