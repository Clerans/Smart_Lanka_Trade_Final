/**
 * Automated Unit & Integration Test Suite
 * SmartLanka Trade AI/ML Recommendation Engine
 */

const technicalIndicators = require('./utils/technicalIndicators');
const aiRecommendationService = require('./services/aiRecommendationService');
const marketDataService = require('./services/marketDataService');

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    failedTests++;
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING AI RECOMMENDATION ENGINE TEST SUITE');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // SECTION 1: Technical Indicators Unit Tests
  // ----------------------------------------------------
  console.log('--- 1. Testing Technical Indicators ---');

  // 1.1 SMA Calculation
  const testPrices = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const sma5 = technicalIndicators.calculateSMA(testPrices, 5);
  assert(sma5 === 80, `SMA(5) of [60..100] should equal 80 (got ${sma5})`);

  // 1.2 Insufficient SMA Data
  const sma15 = technicalIndicators.calculateSMA(testPrices, 15);
  assert(sma15 === null, `SMA(15) on 10 items should return null (got ${sma15})`);

  // 1.3 EMA Calculation
  const ema5 = technicalIndicators.calculateEMA(testPrices, 5);
  assert(typeof ema5 === 'number' && ema5 > 70 && ema5 < 95, `EMA(5) should be a valid weighted number (got ${ema5})`);

  // 1.4 RSI Calculation
  // Strongly increasing series -> RSI should be high (>70)
  const bullishPrices = Array.from({ length: 30 }, (_, i) => 100 + (i * 5));
  const rsiBullish = technicalIndicators.calculateRSI(bullishPrices, 14);
  assert(rsiBullish > 70, `RSI for continuous uptrend should be > 70 (got ${rsiBullish})`);

  // Strongly decreasing series -> RSI should be low (<30)
  const bearishPrices = Array.from({ length: 30 }, (_, i) => 300 - (i * 5));
  const rsiBearish = technicalIndicators.calculateRSI(bearishPrices, 14);
  assert(rsiBearish < 30, `RSI for continuous downtrend should be < 30 (got ${rsiBearish})`);

  // Flat series -> RSI should be 50
  const flatPrices = Array.from({ length: 30 }, () => 100);
  const rsiFlat = technicalIndicators.calculateRSI(flatPrices, 14);
  assert(rsiFlat === 50, `RSI for flat series should be 50 (got ${rsiFlat})`);

  // 1.5 MACD Calculation
  const macdPrices = Array.from({ length: 50 }, (_, i) => 100 + (i * 5));
  const macdResult = technicalIndicators.calculateMACD(macdPrices, 12, 26, 9);
  assert(macdResult !== null, 'MACD calculation should return result object');
  if (macdResult) {
    assert(typeof macdResult.macd === 'number', `MACD line should be a number (got ${macdResult.macd})`);
    assert(typeof macdResult.signal === 'number', `Signal line should be a number (got ${macdResult.signal})`);
    assert(typeof macdResult.histogram === 'number', `Histogram should be a number (got ${macdResult.histogram})`);
  }

  // 1.6 Bollinger Bands
  const bb = technicalIndicators.calculateBollingerBands(testPrices, 5, 2);
  assert(bb !== null, 'Bollinger Bands calculation should return result');
  assert(bb.upper > bb.middle && bb.middle > bb.lower, `BB Upper (${bb?.upper}) > Middle (${bb?.middle}) > Lower (${bb?.lower})`);

  // 1.7 ATR & Volatility
  const mockCandles = Array.from({ length: 25 }, (_, i) => ({
    timestamp: 1700000000 + i * 3600,
    open: 100 + i,
    high: 105 + i,
    low: 95 + i,
    close: 102 + i,
    volume: 1000 + i * 10
  }));
  const atr = technicalIndicators.calculateATR(mockCandles, 14);
  assert(atr !== null && atr > 0, `ATR should be positive number (got ${atr})`);

  const vol = technicalIndicators.calculateVolatility(bullishPrices, 20);
  assert(vol !== null && vol >= 0, `Volatility should be non-negative (got ${vol})`);

  console.log('\n--- 2. Testing Signal Evaluation & Recommendation Logic ---');

  // 2.1 Bullish Feature Evaluation
  const bullishFeatures = {
    currentPrice: 65000,
    change24h: 3.5,
    sma20: 62000,
    sma50: 58000,
    ema20: 63500,
    rsi: 62.5,
    macd: 850,
    macdSignal: 700,
    macdHistogram: 150,
    bollinger: { upper: 67000, middle: 62000, lower: 57000, bandwidth: 0.16 },
    atr: 950,
    volatility: 0.015,
    momentum: 4.8,
    volumeRatio: 1.4
  };
  const bullishEval = aiRecommendationService.evaluateSignals(bullishFeatures, { usdToLkr: 305, priceLKR: 65000 * 305 });
  assert(bullishEval.recommendation === 'BUY', `Bullish setup should evaluate to BUY (got ${bullishEval.recommendation})`);
  assert(bullishEval.trend === 'BULLISH', `Bullish trend should be detected (got ${bullishEval.trend})`);
  assert(bullishEval.confidence >= 70, `Confidence should be >= 70% (got ${bullishEval.confidence}%)`);
  assert(bullishEval.reasons.length >= 3, `Should generate at least 3 supporting reasons (got ${bullishEval.reasons.length})`);

  // 2.2 Bearish Feature Evaluation
  const bearishFeatures = {
    currentPrice: 50000,
    change24h: -4.5,
    sma20: 54000,
    sma50: 58000,
    ema20: 52000,
    rsi: 38.0,
    macd: -650,
    macdSignal: -400,
    macdHistogram: -250,
    bollinger: { upper: 59000, middle: 54000, lower: 49000, bandwidth: 0.18 },
    atr: 1200,
    volatility: 0.025,
    momentum: -6.2,
    volumeRatio: 1.5
  };
  const bearishEval = aiRecommendationService.evaluateSignals(bearishFeatures, { usdToLkr: 305, priceLKR: 50000 * 305 });
  assert(bearishEval.recommendation === 'SELL', `Bearish setup should evaluate to SELL (got ${bearishEval.recommendation})`);
  assert(bearishEval.trend === 'BEARISH', `Bearish trend should be detected (got ${bearishEval.trend})`);
  assert(bearishEval.confidence >= 65, `Confidence should be >= 65% (got ${bearishEval.confidence}%)`);

  // 2.3 Neutral / Consolidation Feature Evaluation
  const neutralFeatures = {
    currentPrice: 55000,
    change24h: 0.2,
    sma20: 55100,
    sma50: 54900,
    ema20: 55050,
    rsi: 50.5,
    macd: 10,
    macdSignal: 12,
    macdHistogram: -2,
    bollinger: { upper: 57000, middle: 55100, lower: 53200, bandwidth: 0.07 },
    atr: 600,
    volatility: 0.008,
    momentum: 0.1,
    volumeRatio: 0.9
  };
  const neutralEval = aiRecommendationService.evaluateSignals(neutralFeatures, { usdToLkr: 305, priceLKR: 55000 * 305 });
  assert(neutralEval.recommendation === 'HOLD', `Neutral setup should evaluate to HOLD (got ${neutralEval.recommendation})`);

  console.log('\n--- 3. Testing Live Market Pipeline & Symbol Coverage ---');

  // 3.1 Fetch Real Binance Candles for BTCUSDT
  try {
    const btcCandles = await marketDataService.getHistoricalCandles('BTCUSDT', '1h', 60);
    assert(Array.isArray(btcCandles) && btcCandles.length >= 50, `Fetched ${btcCandles.length} candles for BTCUSDT from Binance`);
  } catch (err) {
    console.error('⚠️ Binance fetch test skipped due to network/timeout:', err.message);
  }

  // 3.2 Live AI Recommendation for BTCUSDT
  try {
    const btcRec = await aiRecommendationService.getRecommendation('BTCUSDT', '1h');
    assert(btcRec.symbol === 'BTCUSDT', 'BTC recommendation symbol matches');
    assert(['BUY', 'HOLD', 'SELL'].includes(btcRec.recommendation), `Valid recommendation action (got ${btcRec.recommendation})`);
    assert(btcRec.confidence >= 0 && btcRec.confidence <= 100, `Confidence within bounds (got ${btcRec.confidence}%)`);
    assert(['LOW', 'MEDIUM', 'HIGH'].includes(btcRec.risk), `Valid risk level (got ${btcRec.risk})`);
    assert(btcRec.priceLKR > 0, `Price in LKR calculated (got ${btcRec.priceLKR})`);
    assert(btcRec.indicators.rsi !== null, `RSI calculated (got ${btcRec.indicators.rsi})`);
    assert(btcRec.reasons.length > 0, `Generated reasons (got ${btcRec.reasons.length} reasons)`);
    console.log(`\n    Sample BTC Output:`);
    console.log(`    Price: LKR ${(btcRec.priceLKR).toLocaleString()} | Action: ${btcRec.recommendation} | Confidence: ${btcRec.confidence}% | Risk: ${btcRec.risk}`);
  } catch (err) {
    console.error('⚠️ Live BTC recommendation test error:', err.message);
  }

  // 3.3 All Supported Symbols
  try {
    const allRecs = await aiRecommendationService.getAllRecommendations('1h');
    assert(allRecs.length > 0, `Generated recommendations for ${allRecs.length} supported assets`);
    console.log(`    Covered assets: ${allRecs.map(r => r.coin).join(', ')}`);
  } catch (err) {
    console.error('⚠️ All recommendations test error:', err.message);
  }

  console.log('\n====================================================');
  console.log(`🏁 TEST SUITE COMPLETE: ${passedTests} Passed, ${failedTests} Failed`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
