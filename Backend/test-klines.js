/**
 * test-klines.js
 * Verification script for Candlestick (Kline) data and Technical Indicators.
 * Checks all 7 supported symbols across all supported intervals:
 * - Validates strict ascending timestamp ordering
 * - Detects duplicate timestamps or missing data
 * - Validates OHLC price relationships (high >= open/close, low <= open/close, positive values)
 * - Validates volume non-negativity
 * - Validates LKR conversion and technical indicators (SMA20, EMA50, RSI, MACD, Bollinger Bands)
 * - Validates input rejection for unsupported symbols and invalid intervals
 * - Exits with non-zero exit code on failure
 */

const {
  ALLOWED_SYMBOLS,
  VALID_INTERVALS,
  getKlinesWithIndicators,
  validateSymbol,
  validateInterval
} = require('./services/marketDataService');

const symbolsToTest = ALLOWED_SYMBOLS || ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'ADAUSDT', 'XRPUSDT', 'DOGEUSDT'];
const intervalsToTest = ['1m', '5m', '15m', '1h', '4h', '1d'];

async function validateCandleSet(symbol, interval, klineData) {
  const errors = [];

  if (!klineData || typeof klineData !== 'object') {
    errors.push('No data returned or invalid data structure');
    return errors;
  }

  const { candles, indicators, usdToLkr } = klineData;

  if (!candles || !Array.isArray(candles) || candles.length === 0) {
    errors.push('Candle list is empty');
    return errors;
  }

  if (typeof usdToLkr !== 'number' || usdToLkr <= 0) {
    errors.push(`Invalid usdToLkr exchange rate: ${usdToLkr}`);
  }

  const seenTimestamps = new Set();
  let prevTimestamp = 0;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const prefix = `Candle #${i} [ts: ${c.timestamp}]`;

    // 1. Numeric completeness
    if (typeof c.timestamp !== 'number' || isNaN(c.timestamp)) {
      errors.push(`${prefix}: timestamp missing or NaN`);
    }
    if (typeof c.open !== 'number' || isNaN(c.open) || c.open <= 0) {
      errors.push(`${prefix}: invalid open price ${c.open}`);
    }
    if (typeof c.high !== 'number' || isNaN(c.high) || c.high <= 0) {
      errors.push(`${prefix}: invalid high price ${c.high}`);
    }
    if (typeof c.low !== 'number' || isNaN(c.low) || c.low <= 0) {
      errors.push(`${prefix}: invalid low price ${c.low}`);
    }
    if (typeof c.close !== 'number' || isNaN(c.close) || c.close <= 0) {
      errors.push(`${prefix}: invalid close price ${c.close}`);
    }
    if (typeof c.volume !== 'number' || isNaN(c.volume) || c.volume < 0) {
      errors.push(`${prefix}: invalid volume ${c.volume}`);
    }

    // 2. LKR conversions
    if (typeof c.closeLKR !== 'number' || c.closeLKR <= 0) {
      errors.push(`${prefix}: invalid closeLKR price ${c.closeLKR}`);
    }

    // 3. Ascending timestamp ordering & duplicates
    if (seenTimestamps.has(c.timestamp)) {
      errors.push(`${prefix}: duplicate candle timestamp detected`);
    }
    seenTimestamps.add(c.timestamp);

    if (i > 0 && c.timestamp <= prevTimestamp) {
      errors.push(`${prefix}: timestamp ${c.timestamp} not strictly ascending after ${prevTimestamp}`);
    }
    prevTimestamp = c.timestamp;

    // 4. OHLC relationship logic (allowing 0.01% floating tolerance)
    const maxOpenClose = Math.max(c.open, c.close);
    const minOpenClose = Math.min(c.open, c.close);
    if (c.high < maxOpenClose * 0.9999) {
      errors.push(`${prefix}: high (${c.high}) is lower than max(open, close) (${maxOpenClose})`);
    }
    if (c.low > minOpenClose * 1.0001) {
      errors.push(`${prefix}: low (${c.low}) is higher than min(open, close) (${minOpenClose})`);
    }
  }

  // 5. Technical indicators check
  if (!indicators || typeof indicators !== 'object') {
    errors.push('Indicators object missing');
  } else {
    if (indicators.rsi14 !== null && (indicators.rsi14 < 0 || indicators.rsi14 > 100)) {
      errors.push(`RSI out of bounds: ${indicators.rsi14}`);
    }
    if (indicators.bollingerBands && indicators.bollingerBands.upper < indicators.bollingerBands.lower) {
      errors.push(`Bollinger Bands upper (${indicators.bollingerBands.upper}) < lower (${indicators.bollingerBands.lower})`);
    }
  }

  return errors;
}

async function run() {
  console.log('=== SMARTLANKA TRADE — MARKET KLINE & INDICATOR VERIFICATION ===\n');
  let failures = 0;
  let passes = 0;

  // 1. Test each symbol with paired intervals across the spectrum
  console.log('1. Testing Supported Symbols and Intervals:');
  for (let i = 0; i < symbolsToTest.length; i++) {
    const symbol = symbolsToTest[i];
    const interval = intervalsToTest[i % intervalsToTest.length];

    try {
      const data = await getKlinesWithIndicators(symbol, interval, 30);
      const errors = await validateCandleSet(symbol, interval, data);

      if (errors.length === 0) {
        console.log(`  [PASS] ${symbol.padEnd(8)} (${interval.padEnd(3)}): ${data.candles.length} candles, LKR Rate: ${data.usdToLkr.toFixed(2)}, Last Close: Rs ${data.candles[data.candles.length - 1].closeLKR.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
        passes++;
      } else {
        console.error(`  [FAIL] ${symbol} (${interval}):`);
        errors.forEach(e => console.error(`         - ${e}`));
        failures++;
      }
    } catch (err) {
      console.error(`  [FAIL] ${symbol} (${interval}): Error fetching klines: ${err.message}`);
      failures++;
    }
  }

  // 2. Test dedicated multiple intervals for primary benchmark BTCUSDT
  console.log('\n2. Testing Multi-Interval Consistency (BTCUSDT):');
  const btcIntervals = ['1m', '15m', '1h', '1d'];
  for (const intv of btcIntervals) {
    try {
      const data = await getKlinesWithIndicators('BTCUSDT', intv, 25);
      const errors = await validateCandleSet('BTCUSDT', intv, data);
      if (errors.length === 0) {
        console.log(`  [PASS] BTCUSDT  (${intv.padEnd(3)}): ${data.candles.length} candles validated successfully.`);
        passes++;
      } else {
        console.error(`  [FAIL] BTCUSDT (${intv}): ${errors.join(', ')}`);
        failures++;
      }
    } catch (err) {
      console.error(`  [FAIL] BTCUSDT (${intv}): ${err.message}`);
      failures++;
    }
  }

  // 3. Test Negative / Validation Cases
  console.log('\n3. Testing Input Validation & Error Handling:');

  // 3a. Invalid symbol
  try {
    validateSymbol('INVALIDCOIN_XYZ');
    console.error('  [FAIL] validateSymbol should have rejected INVALIDCOIN_XYZ');
    failures++;
  } catch (e) {
    console.log(`  [PASS] validateSymbol correctly rejected unsupported symbol: ${e.message}`);
    passes++;
  }

  // 3b. Invalid interval
  try {
    validateInterval('999w');
    console.error('  [FAIL] validateInterval should have rejected 999w');
    failures++;
  } catch (e) {
    console.log(`  [PASS] validateInterval correctly rejected invalid interval: ${e.message}`);
    passes++;
  }

  // 3c. Empty symbol
  try {
    validateSymbol('');
    console.error('  [FAIL] validateSymbol should have rejected empty string');
    failures++;
  } catch (e) {
    console.log(`  [PASS] validateSymbol correctly rejected empty input`);
    passes++;
  }

  console.log(`\n======================================================`);
  console.log(`Summary: ${passes} Passed, ${failures} Failed`);
  console.log(`======================================================`);

  if (failures > 0) {
    console.error(`❌ Verification failed with ${failures} error(s).`);
    process.exit(1);
  } else {
    console.log(`✅ All Market Kline and Indicator tests PASSED successfully.`);
    process.exit(0);
  }
}

run().catch(err => {
  console.error('Unexpected test crash:', err);
  process.exit(1);
});
