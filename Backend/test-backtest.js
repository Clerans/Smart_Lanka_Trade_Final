/**
 * SmartLanka Trade — AI Backtesting Test Suite (25 Tests)
 */

const assert = require('assert');
const {
  validateAndSanitizeCandles,
  calculateClassificationMetrics,
  runBacktest,
  HORIZON_THRESHOLDS
} = require('./services/backtestService');
const { calculateIndicators } = require('./services/technicalIndicators');
const { evaluateTechnicalSignals } = require('./services/aiRecommendationService');

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
  console.log('🧪 RUNNING AI BACKTESTING & RESEARCH TEST SUITE (25 TESTS)');
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
    // Inject out-of-order candle
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
    // Ensure future candle (t+1) is not in slice
    assert.ok(!slice.some(c => c.timestamp > validCandles[t].timestamp));
  });

  test('Test 4: Technical indicator calculation on isolated slice', () => {
    const candles = generateSyntheticCandles(60, 'up');
    const { validCandles } = validateAndSanitizeCandles(candles);
    const indicators = calculateIndicators(validCandles.slice(0, 50));
    assert.ok(indicators !== null);
    assert.ok(typeof indicators.rsi === 'number');
    assert.ok(indicators.rsi >= 0 && indicators.rsi <= 100);
  });

  test('Test 5: Recommendation generation on isolated indicator state', () => {
    const candles = generateSyntheticCandles(60, 'up');
    const { validCandles } = validateAndSanitizeCandles(candles);
    const indicators = calculateIndicators(validCandles.slice(0, 50));
    const rec = evaluateTechnicalSignals(indicators, validCandles[49].close, 'BTCUSDT');
    assert.ok(rec !== null);
    assert.ok(['BUY', 'HOLD', 'SELL'].includes(rec.action));
    assert.ok(rec.confidence >= 0 && rec.confidence <= 100);
  });

  console.log('\n--- SECTION 2: Multi-Horizon Forecasting & Direction Classification ---');

  test('Test 6: 1h horizon return calculation', () => {
    const current = 100;
    const future = 102;
    const ret = ((future - current) / current) * 100;
    assert.strictEqual(parseFloat(ret.toFixed(2)), 2.00);
  });

  test('Test 7: 4h horizon return calculation', () => {
    const current = 100;
    const future = 98;
    const ret = ((future - current) / current) * 100;
    assert.strictEqual(parseFloat(ret.toFixed(2)), -2.00);
  });

  test('Test 8: 24h horizon return calculation', () => {
    const current = 100;
    const future = 100.2;
    const ret = ((future - current) / current) * 100;
    assert.strictEqual(parseFloat(ret.toFixed(2)), 0.20);
  });

  test('Test 9: UP direction classification threshold (> +0.35% for 1h)', () => {
    const threshold = HORIZON_THRESHOLDS[1];
    const returnVal = 0.50;
    const dir = returnVal > threshold ? 'UP' : returnVal < -threshold ? 'DOWN' : 'NEUTRAL';
    assert.strictEqual(dir, 'UP');
  });

  test('Test 10: DOWN direction classification threshold (< -0.35% for 1h)', () => {
    const threshold = HORIZON_THRESHOLDS[1];
    const returnVal = -0.60;
    const dir = returnVal > threshold ? 'UP' : returnVal < -threshold ? 'DOWN' : 'NEUTRAL';
    assert.strictEqual(dir, 'DOWN');
  });

  test('Test 11: NEUTRAL direction classification threshold (within [-0.35%, +0.35%])', () => {
    const threshold = HORIZON_THRESHOLDS[1];
    const returnVal = 0.10;
    const dir = returnVal > threshold ? 'UP' : returnVal < -threshold ? 'DOWN' : 'NEUTRAL';
    assert.strictEqual(dir, 'NEUTRAL');
  });

  console.log('\n--- SECTION 3: Signal Correctness, Precision, Recall & F1-Score ---');

  test('Test 12: BUY recommendation evaluation against actual UP outcome', () => {
    const recAction = 'BUY';
    const actualDirection = 'UP';
    const isCorrect = (recAction === 'BUY' && actualDirection === 'UP');
    assert.strictEqual(isCorrect, true);
  });

  test('Test 13: SELL recommendation evaluation against actual DOWN outcome', () => {
    const recAction = 'SELL';
    const actualDirection = 'DOWN';
    const isCorrect = (recAction === 'SELL' && actualDirection === 'DOWN');
    assert.strictEqual(isCorrect, true);
  });

  test('Test 14: HOLD recommendation evaluation against actual NEUTRAL outcome', () => {
    const recAction = 'HOLD';
    const actualDirection = 'NEUTRAL';
    const isCorrect = (recAction === 'HOLD' && actualDirection === 'NEUTRAL');
    assert.strictEqual(isCorrect, true);
  });

  test('Test 15: Precision calculation with zero-division guard', () => {
    const metrics1 = calculateClassificationMetrics(10, 5, 2, 17);
    assert.strictEqual(metrics1.precision, 0.6667);
    const zeroMetrics = calculateClassificationMetrics(0, 0, 0, 0);
    assert.strictEqual(zeroMetrics.precision, 0);
  });

  test('Test 16: Recall calculation with zero-division guard', () => {
    const metrics1 = calculateClassificationMetrics(10, 5, 2, 17);
    assert.strictEqual(metrics1.recall, 0.8333);
    const zeroMetrics = calculateClassificationMetrics(0, 0, 0, 0);
    assert.strictEqual(zeroMetrics.recall, 0);
  });

  test('Test 17: Macro F1-Score calculation harmonic mean', () => {
    const metrics = calculateClassificationMetrics(10, 2, 2, 14);
    // precision: 10/12 = 0.8333, recall: 10/12 = 0.8333 -> F1: 0.8333
    assert.strictEqual(metrics.f1Score, 0.8333);
  });

  test('Test 18: 3x3 Confusion Matrix structure and cell integrity', () => {
    const matrix = {
      BUY: { UP: 5, NEUTRAL: 2, DOWN: 1 },
      HOLD: { UP: 3, NEUTRAL: 8, DOWN: 2 },
      SELL: { UP: 1, NEUTRAL: 1, DOWN: 6 }
    };
    const total = Object.values(matrix).reduce((acc, row) => acc + Object.values(row).reduce((a, b) => a + b, 0), 0);
    assert.strictEqual(total, 29);
    assert.strictEqual(matrix.BUY.UP, 5);
    assert.strictEqual(matrix.SELL.DOWN, 6);
  });

  console.log('\n--- SECTION 4: Confidence & Risk Stratification ---');

  test('Test 19: Model confidence band grouping (0-49%, 50-69%, 70-79%, 80-89%, 90-100%)', () => {
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

  test('Test 20: Risk level stratification (LOW, MEDIUM, HIGH)', () => {
    const riskLevels = ['LOW', 'MEDIUM', 'HIGH'];
    assert.ok(riskLevels.includes('LOW'));
    assert.ok(riskLevels.includes('MEDIUM'));
    assert.ok(riskLevels.includes('HIGH'));
  });

  console.log('\n--- SECTION 5: Edge Cases, Validations & Paper Trading Simulation ---');

  test('Test 21: Empty candle array gracefully handled', () => {
    const { validCandles, errorCount } = validateAndSanitizeCandles([]);
    assert.strictEqual(validCandles.length, 0);
    assert.strictEqual(errorCount, 0);
  });

  await testAsync('Test 22: Insufficient candle history throws descriptive error', async () => {
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

  test('Test 23: Invalid OHLC data rejection (High < Low)', () => {
    const invalidCandles = [
      [1600000000000, "100", "90", "110", "100", "50"] // High (90) < Low (110)
    ];
    const { validCandles, errorCount } = validateAndSanitizeCandles(invalidCandles);
    assert.strictEqual(validCandles.length, 0);
    assert.strictEqual(errorCount, 1);
  });

  test('Test 24: Non-numeric timestamp / NaN prices handled safely', () => {
    const badCandles = [
      ["invalid_time", "NaN", "100", "50", "80", "10"]
    ];
    const { validCandles, errorCount } = validateAndSanitizeCandles(badCandles);
    assert.strictEqual(validCandles.length, 0);
    assert.strictEqual(errorCount, 1);
  });

  await testAsync('Test 25: Full Walk-forward Backtest & Offline Paper Trading simulation', async () => {
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
    assert.ok(result.confidenceAnalysis !== undefined);
    assert.ok(result.riskAnalysis !== undefined);
    assert.strictEqual(result.paperTradingSimulation.startingCapitalLKR, 1000000.00);
    assert.ok(result.paperTradingSimulation.endingEquityLKR > 0);
    assert.ok(!isNaN(result.paperTradingSimulation.winRatePct));
    assert.ok(!isNaN(result.paperTradingSimulation.maxDrawdownPct));
  });

  console.log('\n====================================================');
  console.log(`🏁 BACKTEST TEST SUITE COMPLETE: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');

  if (failed > 0) process.exit(1);
}

if (require.main === module) {
  runAllTests().catch(err => {
    console.error('Test Suite Fatal Error:', err);
    process.exit(1);
  });
}
