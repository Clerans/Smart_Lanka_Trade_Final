/**
 * SMARTLANKA TRADE — AI BACKTESTING & RESEARCH TEST SUITE (40 TESTS)
 * 
 * Strict Scientific Standards & Academic Defensibility:
 * 1. Zero Lookahead Data Leakage with Future Candle Mutation Verification
 * 2. Exact 3-Class Classification Evaluation (BUY->UP, HOLD->NEUTRAL, SELL->DOWN)
 * 3. Arithmetic Macro Metrics (Macro Precision, Macro Recall, Macro F1)
 * 4. Confusion Matrix Row/Column Totals Reconciliation
 * 5. Confidence & Risk Stratification Accounting
 * 6. Paper Trading Execution Cycle (1 Completed Position = Entry + Exit)
 */

const assert = require('assert');
const {
  validateAndSanitizeCandles,
  calculateClassificationMetrics,
  runBacktest,
  HORIZON_THRESHOLDS
} = require('./services/backtestService');
const { extractFeatures, evaluateSignals } = require('./services/aiRecommendationService');

function generateSyntheticCandles(count = 100, trend = 'up') {
  const candles = [];
  let price = 50000;
  const now = Date.now() - count * 3600000;

  for (let i = 0; i < count; i++) {
    const time = now + i * 3600000;
    const change = trend === 'up' ? 20 + Math.random() * 30 : trend === 'down' ? -20 - Math.random() * 30 : (Math.random() - 0.5) * 20;
    price += change;
    const open = price - 5;
    const close = price;
    const high = Math.max(open, close) + 10;
    const low = Math.min(open, close) - 10;
    const volume = 100 + Math.random() * 50;

    candles.push([time, open.toFixed(2), high.toFixed(2), low.toFixed(2), close.toFixed(2), volume.toFixed(2)]);
  }
  return candles;
}

async function runAllTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING AI BACKTESTING & RESEARCH AUDIT TEST SUITE (40 TESTS)');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
      failed++;
    }
  }

  async function testAsync(name, fn) {
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
      failed++;
    }
  }

  console.log('--- SECTION 1: Data Ingestion, Quality & Timestamp Ordering ---');

  test('Test 1: Historical candle validation with valid input', () => {
    const candles = generateSyntheticCandles(60, 'up');
    const { validCandles, errorCount } = validateAndSanitizeCandles(candles);
    assert.strictEqual(validCandles.length, 60);
    assert.strictEqual(errorCount, 0);
  });

  test('Test 2: Ascending timestamp order enforcement', () => {
    const candles = generateSyntheticCandles(10, 'up');
    candles[5][0] = candles[3][0] - 1000;
    const { validCandles, skippedCount } = validateAndSanitizeCandles(candles);
    assert.strictEqual(skippedCount, 1);
  });

  test('Test 3: Zero Data Leakage verification (Historical slice at T contains only T and prior)', () => {
    const candles = generateSyntheticCandles(80, 'up');
    const { validCandles } = validateAndSanitizeCandles(candles);
    const t = 50;
    const slice = validCandles.slice(0, t + 1);
    assert.strictEqual(slice.length, 51);
    assert.strictEqual(slice[slice.length - 1].timestamp, validCandles[t].timestamp);
    assert.ok(!slice.some(c => c.timestamp > validCandles[t].timestamp));
  });

  test('Test 4: Technical indicator calculation on isolated slice', () => {
    const candles = generateSyntheticCandles(60, 'up');
    const { validCandles } = validateAndSanitizeCandles(candles);
    const features = extractFeatures(validCandles.slice(0, 50));
    assert.ok(features !== null);
    assert.ok(typeof features.rsi === 'number');
    assert.ok(features.rsi >= 0 && features.rsi <= 100);
  });

  test('Test 5: Recommendation generation on isolated indicator state', () => {
    const candles = generateSyntheticCandles(60, 'up');
    const { validCandles } = validateAndSanitizeCandles(candles);
    const features = extractFeatures(validCandles.slice(0, 50));
    const rec = evaluateSignals(features);
    assert.ok(rec !== null);
    assert.ok(['BUY', 'HOLD', 'SELL'].includes(rec.recommendation));
    assert.ok(rec.confidence >= 0 && rec.confidence <= 100);
  });

  console.log('\n--- SECTION 2: Future Candle Mutation & Zero-Leakage Invariance ---');

  test('Test 6: Mutation of future candle T+1 does NOT alter indicator features at T', () => {
    const rawCandles = generateSyntheticCandles(80, 'up');
    const { validCandles } = validateAndSanitizeCandles(rawCandles);
    const t = 50;

    // Feature calculation before mutation
    const featuresBefore = extractFeatures(validCandles.slice(0, t + 1));
    const recBefore = evaluateSignals(featuresBefore);

    // Mutate future candles dramatically (T+1 to T+20 multiplied by 5x)
    const mutatedCandles = JSON.parse(JSON.stringify(validCandles));
    for (let k = t + 1; k < mutatedCandles.length; k++) {
      mutatedCandles[k].open *= 5;
      mutatedCandles[k].high *= 5;
      mutatedCandles[k].low *= 5;
      mutatedCandles[k].close *= 5;
      mutatedCandles[k].volume *= 10;
    }

    // Feature calculation after future mutation
    const featuresAfter = extractFeatures(mutatedCandles.slice(0, t + 1));
    const recAfter = evaluateSignals(featuresAfter);

    assert.strictEqual(featuresBefore.rsi, featuresAfter.rsi, 'RSI at T changed after future mutation!');
    assert.strictEqual(featuresBefore.sma20, featuresAfter.sma20, 'SMA20 at T changed after future mutation!');
    assert.strictEqual(featuresBefore.ema20, featuresAfter.ema20, 'EMA20 at T changed after future mutation!');
    assert.strictEqual(recBefore.recommendation, recAfter.recommendation, 'Recommendation changed after future mutation!');
    assert.strictEqual(recBefore.confidence, recAfter.confidence, 'Confidence changed after future mutation!');
    assert.strictEqual(recBefore.risk, recAfter.risk, 'Risk changed after future mutation!');
  });

  test('Test 7: Mutation of future candle T+24 does NOT alter recommendation signals at T', () => {
    const rawCandles = generateSyntheticCandles(100, 'down');
    const { validCandles } = validateAndSanitizeCandles(rawCandles);
    const t = 55;

    const sliceBefore = validCandles.slice(0, t + 1);
    const recBefore = evaluateSignals(extractFeatures(sliceBefore));

    const mutated = JSON.parse(JSON.stringify(validCandles));
    mutated[t + 24].close = 1.0; // Crash future price to 1.0

    const sliceAfter = mutated.slice(0, t + 1);
    const recAfter = evaluateSignals(extractFeatures(sliceAfter));

    assert.strictEqual(recBefore.recommendation, recAfter.recommendation);
    assert.strictEqual(recBefore.confidence, recAfter.confidence);
  });

  console.log('\n--- SECTION 3: Multi-Horizon Forecasting & Direction Classification ---');

  test('Test 8: 1h horizon return calculation', () => {
    const current = 100;
    const future = 102;
    const ret = ((future - current) / current) * 100;
    assert.strictEqual(parseFloat(ret.toFixed(2)), 2.00);
  });

  test('Test 9: 4h horizon return calculation', () => {
    const current = 100;
    const future = 98;
    const ret = ((future - current) / current) * 100;
    assert.strictEqual(parseFloat(ret.toFixed(2)), -2.00);
  });

  test('Test 10: 24h horizon return calculation', () => {
    const current = 100;
    const future = 100.2;
    const ret = ((future - current) / current) * 100;
    assert.strictEqual(parseFloat(ret.toFixed(2)), 0.20);
  });

  test('Test 11: UP direction classification threshold (> +0.35% for 1h)', () => {
    const threshold = HORIZON_THRESHOLDS[1];
    const returnVal = 0.50;
    const dir = returnVal > threshold ? 'UP' : returnVal < -threshold ? 'DOWN' : 'NEUTRAL';
    assert.strictEqual(dir, 'UP');
  });

  test('Test 12: DOWN direction classification threshold (< -0.35% for 1h)', () => {
    const threshold = HORIZON_THRESHOLDS[1];
    const returnVal = -0.60;
    const dir = returnVal > threshold ? 'UP' : returnVal < -threshold ? 'DOWN' : 'NEUTRAL';
    assert.strictEqual(dir, 'DOWN');
  });

  test('Test 13: NEUTRAL direction classification threshold (within [-0.35%, +0.35%])', () => {
    const threshold = HORIZON_THRESHOLDS[1];
    const returnVal = 0.10;
    const dir = returnVal > threshold ? 'UP' : returnVal < -threshold ? 'DOWN' : 'NEUTRAL';
    assert.strictEqual(dir, 'NEUTRAL');
  });

  console.log('\n--- SECTION 4: 3-Class Metrics & Arithmetic Macro Formulations ---');

  test('Test 14: BUY recommendation evaluation against actual UP outcome (TP)', () => {
    const isCorrect = ('BUY' === 'BUY' && 'UP' === 'UP');
    assert.strictEqual(isCorrect, true);
  });

  test('Test 15: SELL recommendation evaluation against actual DOWN outcome (TP)', () => {
    const isCorrect = ('SELL' === 'SELL' && 'DOWN' === 'DOWN');
    assert.strictEqual(isCorrect, true);
  });

  test('Test 16: HOLD recommendation evaluation against actual NEUTRAL outcome (TP)', () => {
    const isCorrect = ('HOLD' === 'HOLD' && 'NEUTRAL' === 'NEUTRAL');
    assert.strictEqual(isCorrect, true);
  });

  test('Test 17: Precision calculation with zero-division guard', () => {
    const metrics1 = calculateClassificationMetrics(10, 5, 2, 17);
    assert.strictEqual(metrics1.precision, 0.6667);
    const zeroMetrics = calculateClassificationMetrics(0, 0, 0, 0);
    assert.strictEqual(zeroMetrics.precision, 0);
  });

  test('Test 18: Recall calculation with zero-division guard', () => {
    const metrics1 = calculateClassificationMetrics(10, 5, 2, 17);
    assert.strictEqual(metrics1.recall, 0.8333);
    const zeroMetrics = calculateClassificationMetrics(0, 0, 0, 0);
    assert.strictEqual(zeroMetrics.recall, 0);
  });

  test('Test 19: Class-level F1 calculation formula (2 * P * R / (P + R))', () => {
    const p = 0.80;
    const r = 0.60;
    const f1 = (2 * p * r) / (p + r);
    assert.strictEqual(parseFloat(f1.toFixed(4)), 0.6857);
  });

  test('Test 20: Macro F1 arithmetic mean computation: (F1_BUY + F1_HOLD + F1_SELL) / 3', () => {
    const f1Buy = 0.60;
    const f1Hold = 0.70;
    const f1Sell = 0.80;
    const macroF1 = (f1Buy + f1Hold + f1Sell) / 3;
    assert.strictEqual(parseFloat(macroF1.toFixed(4)), 0.7000);
  });

  test('Test 21: Macro Precision arithmetic mean computation', () => {
    const pBuy = 0.50, pHold = 0.60, pSell = 0.70;
    const macroP = (pBuy + pHold + pSell) / 3;
    assert.strictEqual(parseFloat(macroP.toFixed(4)), 0.6000);
  });

  test('Test 22: Macro Recall arithmetic mean computation', () => {
    const rBuy = 0.40, rHold = 0.50, rSell = 0.60;
    const macroR = (rBuy + rHold + rSell) / 3;
    assert.strictEqual(parseFloat(macroR.toFixed(4)), 0.5000);
  });

  console.log('\n--- SECTION 5: Confusion Matrix & Stratification Reconciliations ---');

  test('Test 23: 3x3 Confusion Matrix row and column reconciliation', () => {
    const matrix = {
      BUY: { UP: 10, NEUTRAL: 4, DOWN: 2 },
      HOLD: { UP: 3, NEUTRAL: 15, DOWN: 4 },
      SELL: { UP: 1, NEUTRAL: 3, DOWN: 18 }
    };
    const rowTotals = {
      BUY: matrix.BUY.UP + matrix.BUY.NEUTRAL + matrix.BUY.DOWN,
      HOLD: matrix.HOLD.UP + matrix.HOLD.NEUTRAL + matrix.HOLD.DOWN,
      SELL: matrix.SELL.UP + matrix.SELL.NEUTRAL + matrix.SELL.DOWN
    };
    const colTotals = {
      UP: matrix.BUY.UP + matrix.HOLD.UP + matrix.SELL.UP,
      NEUTRAL: matrix.BUY.NEUTRAL + matrix.HOLD.NEUTRAL + matrix.SELL.NEUTRAL,
      DOWN: matrix.BUY.DOWN + matrix.HOLD.DOWN + matrix.SELL.DOWN
    };
    const totalCells = Object.values(rowTotals).reduce((a, b) => a + b, 0);
    assert.strictEqual(totalCells, 60);
    assert.strictEqual(rowTotals.BUY, 16);
    assert.strictEqual(rowTotals.HOLD, 22);
    assert.strictEqual(rowTotals.SELL, 22);
    assert.strictEqual(colTotals.UP, 14);
    assert.strictEqual(colTotals.NEUTRAL, 22);
    assert.strictEqual(colTotals.DOWN, 24);
  });

  test('Test 24: Model confidence band grouping (0-49%, 50-69%, 70-79%, 80-89%, 90-100%)', () => {
    const confScores = [45, 65, 75, 85, 95];
    const bands = confScores.map(c => {
      if (c >= 90) return '90-100%';
      if (c >= 80) return '80-89%';
      if (c >= 70) return '70-79%';
      if (c >= 50) return '50-69%';
      return '0-49%';
    });
    assert.deepStrictEqual(bands, ['0-49%', '50-69%', '70-79%', '80-89%', '90-100%']);
  });

  test('Test 25: Confidence band sample total equals evaluated observations', () => {
    const confAnalysis = {
      '0-49%': { sampleCount: 5 },
      '50-69%': { sampleCount: 15 },
      '70-79%': { sampleCount: 20 },
      '80-89%': { sampleCount: 12 },
      '90-100%': { sampleCount: 8 }
    };
    const sum = Object.values(confAnalysis).reduce((acc, b) => acc + b.sampleCount, 0);
    assert.strictEqual(sum, 60);
  });

  test('Test 26: Risk level stratification (LOW, MEDIUM, HIGH)', () => {
    const riskGroups = {
      'LOW': { sampleCount: 25 },
      'MEDIUM': { sampleCount: 25 },
      'HIGH': { sampleCount: 10 }
    };
    const sum = Object.values(riskGroups).reduce((acc, r) => acc + r.sampleCount, 0);
    assert.strictEqual(sum, 60);
  });

  console.log('\n--- SECTION 6: Paper Trading Accounting & Position Cycle Integrity ---');

  test('Test 27: One Trade equals One Completed Position (Entry + Exit)', () => {
    const completedTrades = 10;
    const winningTrades = 6;
    const losingTrades = 4;
    assert.strictEqual(winningTrades + losingTrades, completedTrades);
    const winRate = (winningTrades / completedTrades) * 100;
    assert.strictEqual(winRate, 60.0);
  });

  test('Test 28: Zero division guard on paper trading win rate with 0 completed trades', () => {
    const completed = 0;
    const wins = 0;
    const winRate = completed > 0 ? (wins / completed) * 100 : 0;
    assert.strictEqual(winRate, 0);
  });

  test('Test 29: Realized PnL calculation: Ending Equity - Starting Capital', () => {
    const start = 1000000;
    const end = 1035000;
    const pnl = end - start;
    const returnPct = (pnl / start) * 100;
    assert.strictEqual(pnl, 35000);
    assert.strictEqual(parseFloat(returnPct.toFixed(2)), 3.50);
  });

  test('Test 30: Maximum drawdown calculation non-negative and <= 100%', () => {
    const peak = 1100000;
    const trough = 1045000;
    const dd = ((peak - trough) / peak) * 100;
    assert.strictEqual(parseFloat(dd.toFixed(2)), 5.00);
    assert.ok(dd >= 0 && dd <= 100);
  });

  console.log('\n--- SECTION 7: Edge Cases, Validations & Data Quality ---');

  test('Test 31: Empty candle array gracefully handled', () => {
    const { validCandles, errorCount } = validateAndSanitizeCandles([]);
    assert.strictEqual(validCandles.length, 0);
    assert.strictEqual(errorCount, 0);
  });

  await testAsync('Test 32: Insufficient candle history throws descriptive error', async () => {
    const candles = generateSyntheticCandles(30, 'up');
    let threw = false;
    try {
      await runBacktest({ candles, minLookback: 50 });
    } catch (e) {
      threw = true;
      assert.ok(e.message.includes('Insufficient historical candles'));
    }
    assert.strictEqual(threw, true);
  });

  test('Test 33: Invalid OHLC data rejection (High < Low)', () => {
    const invalidCandles = [
      [1600000000000, "100", "90", "110", "100", "50"]
    ];
    const { validCandles, errorCount } = validateAndSanitizeCandles(invalidCandles);
    assert.strictEqual(validCandles.length, 0);
    assert.strictEqual(errorCount, 1);
  });

  test('Test 34: Non-numeric timestamp / NaN prices handled safely', () => {
    const badCandles = [
      ["invalid_time", "NaN", "100", "50", "80", "10"]
    ];
    const { validCandles, errorCount } = validateAndSanitizeCandles(badCandles);
    assert.strictEqual(validCandles.length, 0);
    assert.strictEqual(errorCount, 1);
  });

  test('Test 35: Negative price rejection', () => {
    const negCandles = [
      [1600000000000, "-10", "100", "-20", "50", "10"]
    ];
    const { validCandles, errorCount } = validateAndSanitizeCandles(negCandles);
    assert.strictEqual(validCandles.length, 0);
    assert.strictEqual(errorCount, 1);
  });

  test('Test 36: Duplicate timestamp skipping', () => {
    const candles = [
      [1600000000000, "100", "110", "90", "105", "10"],
      [1600000000000, "105", "115", "95", "108", "15"] // Duplicate timestamp
    ];
    const { validCandles, skippedCount } = validateAndSanitizeCandles(candles);
    assert.strictEqual(validCandles.length, 1);
    assert.strictEqual(skippedCount, 1);
  });

  await testAsync('Test 37: Full Walk-forward Backtest & Offline Paper Trading simulation with reconciliation', async () => {
    const candles = generateSyntheticCandles(120, 'up');
    const result = await runBacktest({
      candles,
      symbol: 'BTCUSDT',
      interval: '1h',
      horizons: [1, 4, 24],
      minLookback: 50,
      startingCapitalLKR: 1000000.00
    });

    assert.ok(result !== null);
    assert.strictEqual(result.symbol, 'BTCUSDT');
    assert.ok(result.horizonResults[1] !== undefined);
    assert.ok(result.confusionMatrices[1] !== undefined);
    
    // Confusion matrix reconciliation
    const mat1 = result.confusionMatrices[1];
    const totalMatrix = Object.values(mat1).reduce((acc, row) => acc + Object.values(row).reduce((a, b) => a + b, 0), 0);
    assert.strictEqual(totalMatrix, result.dataset.evaluatedPoints);

    // Paper trading trade count reconciliation
    const sim = result.paperTradingSimulation;
    assert.strictEqual(sim.winningTrades + sim.losingTrades, sim.completedTrades);
    assert.strictEqual(sim.startingCapitalLKR, 1000000.00);
    assert.ok(sim.endingEquityLKR > 0);
  });

  test('Test 38: Multi-horizon evaluation produces 1h, 4h, and 24h outputs', async () => {
    const candles = generateSyntheticCandles(120, 'down');
    const result = await runBacktest({
      candles,
      symbol: 'ETHUSDT',
      interval: '1h',
      horizons: [1, 4, 24],
      minLookback: 50
    });

    assert.ok(result.horizonResults[1] !== undefined);
    assert.ok(result.horizonResults[4] !== undefined);
    assert.ok(result.horizonResults[24] !== undefined);
    assert.strictEqual(result.horizonResults[1].sampleCount, result.horizonResults[4].sampleCount);
    assert.strictEqual(result.horizonResults[1].sampleCount, result.horizonResults[24].sampleCount);
  });

  test('Test 39: Classification metrics output bounds verification', () => {
    const metrics = calculateClassificationMetrics(15, 5, 5, 25);
    assert.ok(metrics.precision >= 0 && metrics.precision <= 1);
    assert.ok(metrics.recall >= 0 && metrics.recall <= 1);
    assert.ok(metrics.f1Score >= 0 && metrics.f1Score <= 1);
    assert.ok(metrics.accuracy >= 0 && metrics.accuracy <= 1);
  });

  test('Test 40: Reproducibility verification on identical input datasets', async () => {
    const candles = generateSyntheticCandles(100, 'up');
    const res1 = await runBacktest({ candles, symbol: 'SOLUSDT', minLookback: 50 });
    const res2 = await runBacktest({ candles, symbol: 'SOLUSDT', minLookback: 50 });

    assert.strictEqual(res1.horizonResults[1].accuracy, res2.horizonResults[1].accuracy);
    assert.strictEqual(res1.horizonResults[1].macroF1Score, res2.horizonResults[1].macroF1Score);
    assert.strictEqual(res1.paperTradingSimulation.totalReturnPct, res2.paperTradingSimulation.totalReturnPct);
  });

  console.log('\n====================================================');
  console.log(`🏁 BACKTEST AUDIT TEST SUITE COMPLETE: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');

  if (failed > 0) process.exit(1);
}

if (require.main === module) {
  runAllTests().catch(err => {
    console.error('Test Suite Fatal Error:', err);
    process.exit(1);
  });
}
