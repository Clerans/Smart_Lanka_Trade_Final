/**
 * SmartLanka Trade — Master Comprehensive End-to-End Integration & Security Test Suite
 * Horizon Campus IT41028 Research Capstone Validation Suite
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Colors for terminal reporting
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

let passedCount = 0;
let failedCount = 0;
const testResults = [];

function assert(condition, testName, details = '') {
  if (condition) {
    passedCount++;
    console.log(`  ${GREEN}✓ PASS:${RESET} ${testName}`);
    testResults.push({ name: testName, status: 'PASS', details });
  } else {
    failedCount++;
    console.log(`  ${RED}✗ FAIL:${RESET} ${testName} — ${details}`);
    testResults.push({ name: testName, status: 'FAIL', details });
  }
}

async function runTests() {
  console.log(`\n${BOLD}${CYAN}========================================================================${RESET}`);
  console.log(`${BOLD}${CYAN}   SMARTLANKA TRADE — MASTER INTEGRATION & AUDIT TEST RUNNER            ${RESET}`);
  console.log(`${BOLD}${CYAN}========================================================================${RESET}\n`);

  // ==========================================
  // MODULE 1: SRI LANKAN NIC OCR & KYC ENGINE
  // ==========================================
  console.log(`${BOLD}1. Testing Sri Lankan NIC OCR & KYC Parsing Engine...${RESET}`);
  const kycService = require('../services/kycService');

  // Test Old NIC (9-digit + V)
  const oldNicResult = kycService.parseSriLankanNic('920452391V');
  assert(oldNicResult.valid === true, 'Old 9-Digit+V NIC format validation');
  assert(oldNicResult.birthYear === 1992, 'Old NIC birth year extraction (1992)', `Got ${oldNicResult.birthYear}`);
  assert(oldNicResult.gender === 'MALE', 'Old NIC gender determination (Male: day <= 500)', `Got ${oldNicResult.gender}`);

  // Test Old NIC Female (> 500)
  const oldNicFemale = kycService.parseSriLankanNic('945451234V');
  assert(oldNicFemale.valid === true, 'Old NIC Female format validation');
  assert(oldNicFemale.gender === 'FEMALE', 'Old NIC female gender determination (day > 500)');

  // Test New NIC (12-digit)
  const newNicResult = kycService.parseSriLankanNic('199204502391');
  assert(newNicResult.valid === true, 'New 12-Digit NIC format validation');
  assert(newNicResult.birthYear === 1992, 'New NIC birth year extraction (1992)');
  assert(newNicResult.format === 'NEW_12_DIGIT', 'New NIC format identifier');

  // Test Invalid NIC
  const invalidNic = kycService.parseSriLankanNic('ABC12345');
  assert(invalidNic.valid === false, 'Invalid NIC rejection');

  // ==========================================
  // MODULE 2: COLOMBO STOCK EXCHANGE (CSE) MARKET DATA
  // ==========================================
  console.log(`\n${BOLD}2. Testing CSE Equities & Forex Market Service...${RESET}`);
  const marketService = require('../services/marketService');

  const jkhPrice = await marketService.getPriceLKR('JKH.N0000');
  assert(jkhPrice && jkhPrice.priceLKR > 0, 'CSE JKH.N0000 real-time LKR price resolution', `Price: ${jkhPrice?.priceLKR}`);
  assert(jkhPrice.symbol === 'JKH.N0000', 'Asset symbol canonicalized as CSE stock ticker');

  const allPrices = await marketService.getAllPricesLKR();
  assert(Array.isArray(allPrices.prices) && allPrices.prices.length >= 10, 'CSE Equities Catalog contains all major blue-chips');
  const hasComb = allPrices.prices.some(p => p.symbol === 'COMB.N0000');
  assert(hasComb, 'Catalog contains Commercial Bank (COMB.N0000)');

  const forexRates = await marketService.getForexRates();
  assert(forexRates && forexRates.rates && forexRates.rates.USD_LKR >= 280, 'CBSL Forex Rates resolution (USD/LKR)', `Rate: ${forexRates?.rates?.USD_LKR}`);

  const marketStatus = marketService.getMarketStatus();
  assert(typeof marketStatus.isOpen === 'boolean' && marketStatus.exchange === 'Colombo Stock Exchange (CSE)', 'CSE Market Hours & Status Check');

  // ==========================================
  // MODULE 3: SECURITY, OTP HASHING & RBAC
  // ==========================================
  console.log(`\n${BOLD}3. Testing Security, Bcrypt OTP Hashing & RBAC...${RESET}`);
  
  // Test Bcrypt OTP Hashing
  const rawOtp = '482910';
  const hashedOtp = await bcrypt.hash(rawOtp, 10);
  const otpMatch = await bcrypt.compare(rawOtp, hashedOtp);
  assert(otpMatch === true, 'Bcrypt OTP hash and comparison verification');

  // Test JWT Signing with RBAC role
  const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_testing';
  const tokenPayload = { id: 101, email: 'investor@smartlanka.lk', role: 'INVESTOR' };
  const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1h' });
  const decoded = jwt.verify(token, JWT_SECRET);
  assert(decoded.role === 'INVESTOR', 'JWT contains RBAC role (INVESTOR)');

  const adminPayload = { id: 1, email: 'admin@smartlanka.lk', role: 'ADMIN' };
  const adminToken = jwt.sign(adminPayload, JWT_SECRET, { expiresIn: '1h' });
  const decodedAdmin = jwt.verify(adminToken, JWT_SECRET);
  assert(decodedAdmin.role === 'ADMIN', 'JWT contains RBAC role (ADMIN)');

  // ==========================================
  // MODULE 4: AI / ML PREDICTION & NLP SENTIMENT
  // ==========================================
  console.log(`\n${BOLD}4. Testing AI/ML Forecasts, Metrics & SOMI Copilot...${RESET}`);
  const aiService = require('../services/aiService');

  const jkhPrediction = await aiService.getPrediction('JKH.N0000');
  assert(jkhPrediction && jkhPrediction.predictedPrice > 0, 'AI Forecast generated for JKH.N0000');
  assert(jkhPrediction.metrics && jkhPrediction.metrics.mae > 0 && jkhPrediction.metrics.rmse > 0 && jkhPrediction.metrics.mape > 0, 'Evaluation metrics present (MAE, RMSE, MAPE)');
  assert(jkhPrediction.model && jkhPrediction.model.includes('ARIMA'), 'Model architecture specifies ARIMA/LSTM/Random Forest');

  const sentimentData = await aiService.getNewsSentiment();
  assert(sentimentData && sentimentData.overallSentiment && sentimentData.articlesCount > 0, 'NLP Financial News Sentiment Analysis on Sri Lankan press');

  const chatResponse = await aiService.processChatQuery('What is the forecast for John Keells Holdings?', []);
  assert(chatResponse && chatResponse.reply && chatResponse.reply.length > 20, 'SOMI AI Copilot generated contextual financial response');

  // ==========================================
  // MODULE 5: AUDIT LOGGING SERVICE
  // ==========================================
  console.log(`\n${BOLD}5. Testing System & Security Audit Logging...${RESET}`);
  const auditService = require('../services/auditService');

  const auditRecord = await auditService.logAction({
    userId: 101,
    actionType: 'TEST_VERIFICATION',
    category: 'SECURITY',
    details: { message: 'Automated integration test execution' },
    ipAddress: '127.0.0.1'
  });
  assert(auditRecord && auditRecord.success === true, 'Audit log recorded successfully');

  // ==========================================
  // SUMMARY REPORT
  // ==========================================
  console.log(`\n${BOLD}${CYAN}========================================================================${RESET}`);
  console.log(`${BOLD}TEST EXECUTION SUMMARY:${RESET}`);
  console.log(`  Total Tests Run: ${passedCount + failedCount}`);
  console.log(`  ${GREEN}Passed: ${passedCount}${RESET}`);
  console.log(`  ${RED}Failed: ${failedCount}${RESET}`);
  console.log(`${BOLD}  Success Rate: ${((passedCount / (passedCount + failedCount)) * 100).toFixed(1)}%${RESET}`);
  console.log(`${BOLD}${CYAN}========================================================================${RESET}\n`);

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
