/**
 * Backend/test-cse-market.js
 * Comprehensive automated verification for Colombo Stock Exchange (CSE) integration
 */

const cseMarketService = require('./services/cseMarketService');
const tradeService = require('./services/tradeService');
const portfolioService = require('./services/portfolioService');

async function testCseIntegration() {
  console.log('================================================================');
  console.log('       SMARTLANKA TRADE — CSE MARKET INTEGRATION TESTS          ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function check(condition, desc) {
    if (condition) {
      console.log(`  [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${desc}`);
      failed++;
    }
  }

  // 1. Catalogue validation
  console.log('TEST GROUP 1: Catalogue & Symbol Validation');
  const symbols = cseMarketService.ALLOWED_CSE_SYMBOLS;
  check(symbols.length === 5, 'Catalogue has exactly 5 initial CSE equities');
  check(symbols.includes('JKH.N0000'), 'Includes John Keells Holdings (JKH.N0000)');
  check(symbols.includes('COMB.N0000'), 'Includes Commercial Bank of Ceylon (COMB.N0000)');
  check(symbols.includes('DIAL.N0000'), 'Includes Dialog Axiata (DIAL.N0000)');
  check(symbols.includes('HNB.N0000'), 'Includes Hatton National Bank (HNB.N0000)');
  check(symbols.includes('LIOC.N0000'), 'Includes Lanka IOC (LIOC.N0000)');

  // 2. Normalization & Disambiguation
  console.log('\nTEST GROUP 2: Symbol Normalization & Asset Type Disambiguation');
  check(cseMarketService.normalizeCseSymbol('jkh.n0000') === 'JKH.N0000', 'Normalizes lowercase jkh.n0000 to uppercase JKH.N0000');
  check(cseMarketService.normalizeCseSymbol('jkh') === 'JKH.N0000', 'Resolves ticker prefix jkh to JKH.N0000');
  check(cseMarketService.isValidCseSymbol('JKH.N0000'), 'Confirms JKH.N0000 is valid CSE symbol');
  check(!cseMarketService.isValidCseSymbol('INVALID.N0000'), 'Rejects non-catalogue symbol INVALID.N0000');
  check(!cseMarketService.isValidCseSymbol('BTCUSDT'), 'Rejects cryptocurrency pair BTCUSDT from CSE catalogue');
  check(cseMarketService.isCseSymbol('JKH.N0000'), 'isCseSymbol classifies JKH.N0000 as CSE equity');
  check(!cseMarketService.isCseSymbol('BTCUSDT'), 'isCseSymbol classifies BTCUSDT as non-CSE (crypto)');

  // 3. Market Session & Trading Hours (09:30 - 14:30 SLT, Mon-Fri)
  console.log('\nTEST GROUP 3: Market Hours & Session Calculation (09:30 - 14:30 SLT)');
  const midDayMondayUTC = new Date('2026-10-12T05:00:00Z'); // 10:30 AM SLT Monday
  const sessionActive = cseMarketService.getMarketSessionInfo(midDayMondayUTC);
  check(sessionActive.isMarketOpen === true, 'Correctly evaluates market as OPEN during trading hours (10:30 SLT Monday)');
  check(sessionActive.sessionStatus === 'REGULAR_TRADING', 'Reports session status REGULAR_TRADING');

  const eveningMondayUTC = new Date('2026-10-12T11:00:00Z'); // 16:30 SLT Monday
  const sessionClosed = cseMarketService.getMarketSessionInfo(eveningMondayUTC);
  check(sessionClosed.isMarketOpen === false, 'Correctly evaluates market as CLOSED after 14:30 SLT');
  check(sessionClosed.sessionStatus === 'CLOSED', 'Reports session status CLOSED after hours');

  const sundayUTC = new Date('2026-10-11T05:00:00Z'); // Sunday
  const sessionWeekend = cseMarketService.getMarketSessionInfo(sundayUTC);
  check(sessionWeekend.isMarketOpen === false, 'Evaluates market as CLOSED on weekends');
  check(sessionWeekend.sessionStatus === 'WEEKEND_CLOSED', 'Reports session status WEEKEND_CLOSED');

  // 4. Watchlist & Data Transparency
  console.log('\nTEST GROUP 4: Market Data Normalization & Data Freshness Disclosure');
  const watchlist = await cseMarketService.getCseWatchlist();
  check(Array.isArray(watchlist) && watchlist.length === 5, 'Watchlist returns all 5 securities');
  const jkh = watchlist.find(w => w.symbol === 'JKH.N0000');
  check(jkh.name === 'John Keells Holdings PLC', 'Preserves company name');
  check(jkh.sector === 'Capital Goods', 'Preserves industry sector');
  check(jkh.currency === 'LKR', 'Prices are denominated strictly in LKR');
  check(typeof jkh.priceLKR === 'number' && jkh.priceLKR > 0, 'Returns positive numeric price in LKR');
  check(typeof jkh.changePercent === 'number', 'Returns numeric change percent');
  check(jkh.dataFreshness === 'SAMPLE_REFERENCE' || jkh.dataFreshness === 'DELAYED' || jkh.dataFreshness === 'LIVE', 'Discloses valid data freshness');
  check(!jkh.isLive || Boolean(process.env.CSE_API_URL), 'Never claims live unverified feed without configured provider');

  // 5. Asset Price Resolution for Trading Engine
  console.log('\nTEST GROUP 5: Asset Price Resolution for Trading Engine');
  const resolvedStock = await tradeService.resolveAssetPrice('JKH.N0000');
  check(resolvedStock.assetType === 'STOCK', 'Resolves assetType as STOCK for JKH.N0000');
  check(resolvedStock.symbol === 'JKH.N0000', 'Resolves canonical symbol JKH.N0000');
  check(resolvedStock.priceLKR > 0, 'Resolves numeric LKR execution price');

  const resolvedCrypto = await tradeService.resolveAssetPrice('BTCUSDT');
  check(resolvedCrypto.assetType === 'CRYPTO', 'Resolves assetType as CRYPTO for BTCUSDT');
  check(resolvedCrypto.priceLKR > 0, 'Resolves crypto price converted to LKR');

  let errorThrown = false;
  try {
    await tradeService.resolveAssetPrice('UNKNOWN.N0000');
  } catch (err) {
    errorThrown = true;
    check(err.code === 'INVALID_SYMBOL', 'Rejects unsupported stock with INVALID_SYMBOL');
  }
  check(errorThrown, 'Rejects invalid stock symbol');

  console.log('\n================================================================');
  console.log(`TOTAL CSE INTEGRATION TESTS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  testCseIntegration().catch(err => {
    console.error('Test run failed:', err);
    process.exit(1);
  });
}

module.exports = { testCseIntegration };
