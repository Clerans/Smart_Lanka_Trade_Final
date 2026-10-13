/**
 * Comprehensive Test Suite for CurrencySwapCard Logic and Exchange Rate Pipeline
 */

const SUPPORTED_CURRENCIES = ['LKR', 'USDT', 'USD', 'BTC'];

// Rate calculator replica exactly mirroring CurrencySwapCard
function calculateRate(source, target, usdToLkr, btcPriceUSDT) {
  if (source === target) return 1.0;

  const getUnitValueInUSD = (currency) => {
    switch (currency) {
      case 'LKR':
        return usdToLkr > 0 ? 1 / usdToLkr : 1 / 281.34;
      case 'USDT':
      case 'USD':
        return 1.0;
      case 'BTC':
        return btcPriceUSDT > 0 ? btcPriceUSDT : 68500;
      default:
        return 1.0;
    }
  };

  const sourceInUSD = getUnitValueInUSD(source);
  const targetInUSD = getUnitValueInUSD(target);

  if (targetInUSD <= 0) return 0;
  return sourceInUSD / targetInUSD;
}

function formatTargetAmount(val, targetCurrency) {
  if (isNaN(val) || val <= 0) return '0.00';
  if (targetCurrency === 'BTC') {
    return val >= 1 ? val.toFixed(4) : val.toFixed(6);
  }
  if (targetCurrency === 'LKR') {
    return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return val < 0.01 ? val.toFixed(4) : val.toFixed(2);
}

function getExchangeRateLabel(from, to, usdToLkr, btcPriceUSDT) {
  if ((from === 'LKR' && to === 'USDT') || (from === 'USDT' && to === 'LKR')) {
    return `1 USDT ≈ ${usdToLkr.toFixed(2)} LKR`;
  }
  if ((from === 'LKR' && to === 'USD') || (from === 'USD' && to === 'LKR')) {
    return `1 USD ≈ ${usdToLkr.toFixed(2)} LKR`;
  }
  if ((from === 'LKR' && to === 'BTC') || (from === 'BTC' && to === 'LKR')) {
    const btcInLkr = btcPriceUSDT * usdToLkr;
    return `1 BTC ≈ ${Math.round(btcInLkr).toLocaleString('en-US')} LKR`;
  }
  if ((from === 'USDT' && to === 'BTC') || (from === 'BTC' && to === 'USDT')) {
    return `1 BTC ≈ ${btcPriceUSDT.toLocaleString('en-US', { minimumFractionDigits: 2 })} USDT`;
  }
  if ((from === 'USD' && to === 'BTC') || (from === 'BTC' && to === 'USD')) {
    return `1 BTC ≈ ${btcPriceUSDT.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`;
  }
  if ((from === 'USDT' && to === 'USD') || (from === 'USD' && to === 'USDT')) {
    return `1 USDT ≈ 1.00 USD`;
  }
  const rate = calculateRate(from, to, usdToLkr, btcPriceUSDT);
  return `1 ${from} ≈ ${rate.toFixed(4)} ${to}`;
}

let passed = 0;
let total = 0;

function assert(condition, testName) {
  total++;
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
  }
}

console.log('🧪 Running SmartLanka Currency Swap Test Suite...\n');

// Test 1: Standard Reference Values (1 USDT ≈ 281.34 LKR)
console.log('--- Test Group 1: Standard LKR <-> USDT Reference Rates ---');
const usdToLkrRef = 281.34;
const btcRef = 68500;

const usdtToLkrRate = calculateRate('USDT', 'LKR', usdToLkrRef, btcRef);
assert(Math.abs(usdtToLkrRate - 281.34) < 0.0001, `USDT to LKR rate should be 281.34 (got ${usdtToLkrRate})`);

const lkrToUsdtRate = calculateRate('LKR', 'USDT', usdToLkrRef, btcRef);
assert(Math.abs(lkrToUsdtRate - (1 / 281.34)) < 0.000001, `LKR to USDT rate should be ~0.003554 (got ${lkrToUsdtRate})`);

const labelRef = getExchangeRateLabel('LKR', 'USDT', usdToLkrRef, btcRef);
assert(labelRef === '1 USDT ≈ 281.34 LKR', `Exchange rate label matches reference "1 USDT ≈ 281.34 LKR" (got "${labelRef}")`);

// Test 2: Conversion calculations
console.log('\n--- Test Group 2: Amount Conversions ---');
const lkrAmount = 28134; // 28,134 LKR should yield exactly 100 USDT
const usdtConverted = lkrAmount * lkrToUsdtRate;
const formattedUsdt = formatTargetAmount(usdtConverted, 'USDT');
assert(formattedUsdt === '100.00', `28,134 LKR converts to 100.00 USDT (got ${formattedUsdt})`);

const usdtAmount = 50;
const lkrConverted = usdtAmount * usdtToLkrRate;
const formattedLkr = formatTargetAmount(lkrConverted, 'LKR');
assert(formattedLkr === '14,067.00', `50 USDT converts to 14,067.00 LKR (got ${formattedLkr})`);

// Test 3: BTC Conversions
console.log('\n--- Test Group 3: Bitcoin Pair Conversions ---');
const btcToUsdtRate = calculateRate('BTC', 'USDT', usdToLkrRef, btcRef);
assert(btcToUsdtRate === 68500, `BTC to USDT rate equals BTC price ${btcRef} (got ${btcToUsdtRate})`);

const btcToLkrRate = calculateRate('BTC', 'LKR', usdToLkrRef, btcRef);
const expectedBtcLkr = 68500 * 281.34;
assert(Math.abs(btcToLkrRate - expectedBtcLkr) < 0.01, `BTC to LKR rate is ${expectedBtcLkr} (got ${btcToLkrRate})`);

const oneLkrInBtc = 1000000 * calculateRate('LKR', 'BTC', usdToLkrRef, btcRef);
const formattedBtc = formatTargetAmount(oneLkrInBtc, 'BTC');
assert(parseFloat(formattedBtc) > 0, `1,000,000 LKR converts to valid BTC amount: ${formattedBtc} BTC`);

// Test 4: Pair Reversal Invariant
console.log('\n--- Test Group 4: Pair Reversal Mathematical Symmetry ---');
SUPPORTED_CURRENCIES.forEach((c1) => {
  SUPPORTED_CURRENCIES.forEach((c2) => {
    if (c1 !== c2) {
      const r1 = calculateRate(c1, c2, usdToLkrRef, btcRef);
      const r2 = calculateRate(c2, c1, usdToLkrRef, btcRef);
      const product = r1 * r2;
      assert(Math.abs(product - 1.0) < 0.0001, `Inverse symmetry invariant holds for ${c1} <-> ${c2} (product = ${product.toFixed(6)})`);
    }
  });
});

// Test 5: Boundary & Error Handling
console.log('\n--- Test Group 5: Boundary & Zero/Negative Inputs ---');
assert(formatTargetAmount(0, 'USDT') === '0.00', 'Zero amount returns 0.00');
assert(formatTargetAmount(-50, 'USDT') === '0.00', 'Negative amount returns 0.00');
assert(formatTargetAmount(NaN, 'USDT') === '0.00', 'NaN returns 0.00');

// Test 6: Rate Fallback Resilience
console.log('\n--- Test Group 6: Fallback Resilience When Rates are 0/Negative ---');
const fallbackRate = calculateRate('USDT', 'LKR', 0, 0);
assert(fallbackRate > 200, `Fallback rate activates safely when live rate is 0 (got ${fallbackRate})`);

console.log(`\n========================================`);
console.log(`Results: ${passed} / ${total} tests passed (${Math.round((passed / total) * 100)}%)`);
console.log(`========================================\n`);

if (passed !== total) {
  process.exit(1);
}
