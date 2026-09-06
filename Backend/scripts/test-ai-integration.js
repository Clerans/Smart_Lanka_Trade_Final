/**
 * SMARTLANKA TRADE — AI INTEGRATION VERIFICATION SCRIPT
 * 
 * Verifies all AI endpoints, response schemas, symbol normalization,
 * and conversational SOMI AI outputs against the live running server.
 */

const axios = require('axios');

const BASE_URL = 'http://127.0.0.1:5000';

async function testAIIntegration() {
  console.log('================================================================');
  console.log('🧪 VERIFYING LIVE AI RECOMMENDATION & SOMI AI INTEGRATION');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assertCheck(name, condition, details = '') {
    if (condition) {
      console.log(`  ✅ [PASS] ${name} ${details ? '(' + details + ')' : ''}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${name} ${details ? '(' + details + ')' : ''}`);
      failed++;
    }
  }

  try {
    // 1. Test GET /api/ai/recommendations
    console.log('--- 1. Testing GET /api/ai/recommendations ---');
    const recsRes = await axios.get(`${BASE_URL}/api/ai/recommendations?interval=1h`, { timeout: 10000 });
    assertCheck('Status code is 200', recsRes.status === 200);
    assertCheck('Response contains success=true', recsRes.data.success === true);
    assertCheck('Response contains array of 7 cryptocurrencies', Array.isArray(recsRes.data.data) && recsRes.data.data.length === 7, `Count: ${recsRes.data.data.length}`);

    const sample = recsRes.data.data[0];
    assertCheck('Sample has valid symbol (e.g. BTCUSDT)', typeof sample.symbol === 'string' && sample.symbol.includes('USDT'), sample.symbol);
    assertCheck('Sample has action (BUY/HOLD/SELL)', ['BUY', 'HOLD', 'SELL'].includes(sample.recommendation), sample.recommendation);
    assertCheck('Sample has confidence % (0-100)', typeof sample.confidence === 'number' && sample.confidence >= 0 && sample.confidence <= 100, `${sample.confidence}%`);
    assertCheck('Sample has risk level (LOW/MEDIUM/HIGH)', ['LOW', 'MEDIUM', 'HIGH'].includes(sample.risk), sample.risk);
    assertCheck('Sample has price in LKR > 0', typeof sample.priceLKR === 'number' && sample.priceLKR > 0, `LKR ${sample.priceLKR.toLocaleString()}`);
    assertCheck('Sample has indicators object', typeof sample.indicators === 'object' && sample.indicators !== null);
    assertCheck('Sample has reasons array', Array.isArray(sample.reasons) && sample.reasons.length > 0, `${sample.reasons.length} reasons`);

    // 2. Test GET /api/ai/recommendation/:symbol (BTCUSDT and normalized BTC)
    console.log('\n--- 2. Testing GET /api/ai/recommendation/:symbol ---');
    const singleRes = await axios.get(`${BASE_URL}/api/ai/recommendation/BTCUSDT?interval=1h`, { timeout: 10000 });
    assertCheck('GET /api/ai/recommendation/BTCUSDT returns 200', singleRes.status === 200);
    assertCheck('Returns recommendation for BTCUSDT', singleRes.data.data.symbol === 'BTCUSDT');

    const shortSymbolRes = await axios.get(`${BASE_URL}/api/ai/recommendation/BTC?interval=1h`, { timeout: 10000 });
    assertCheck('Normalized GET /api/ai/recommendation/BTC returns 200', shortSymbolRes.status === 200);
    assertCheck('Normalized short symbol resolves to BTCUSDT', shortSymbolRes.data.data.symbol === 'BTCUSDT');

    // 3. Test GET /api/ai/history/:symbol
    console.log('\n--- 3. Testing GET /api/ai/history/:symbol ---');
    const historyRes = await axios.get(`${BASE_URL}/api/ai/history/BTCUSDT?limit=5`, { timeout: 10000 });
    assertCheck('GET /api/ai/history/BTCUSDT returns 200', historyRes.status === 200);
    assertCheck('History response has data array', Array.isArray(historyRes.data.data));

    // 4. Test POST /api/ai/chat (SOMI AI Assistant)
    console.log('\n--- 4. Testing POST /api/ai/chat (SOMI AI Assistant) ---');
    const chatRes1 = await axios.post(`${BASE_URL}/api/ai/chat`, {
      message: 'What do you think about Bitcoin right now?'
    }, { timeout: 10000 });
    assertCheck('POST /api/ai/chat returns 200', chatRes1.status === 200);
    assertCheck('Chat response has reply string', typeof chatRes1.data.data.reply === 'string' && chatRes1.data.data.reply.length > 20);
    assertCheck('Chat response mentions Bitcoin / BTC', chatRes1.data.data.reply.includes('Bitcoin') || chatRes1.data.data.reply.includes('BTC'));
    assertCheck('Chat includes research disclaimer', typeof chatRes1.data.data.disclaimer === 'string');

    // 5. Test Chat with Portfolio Query
    const chatRes2 = await axios.post(`${BASE_URL}/api/ai/chat`, {
      message: 'How is my portfolio and what is the market trend?'
    }, { timeout: 10000 });
    assertCheck('Portfolio query returns 200', chatRes2.status === 200);
    assertCheck('Portfolio reply contains guidance', typeof chatRes2.data.data.reply === 'string');

    // 6. Test Chat with empty input (Validation error handling)
    console.log('\n--- 5. Testing Error & Validation Handling ---');
    try {
      await axios.post(`${BASE_URL}/api/ai/chat`, { message: '' });
      assertCheck('Empty message rejected', false, 'Should have failed with 400');
    } catch (err) {
      assertCheck('Empty message rejected with 400 Bad Request', err.response?.status === 400);
    }

  } catch (globalErr) {
    console.error('Fatal Integration Error:', globalErr.message);
    failed++;
  }

  console.log('\n================================================================');
  console.log(`🏁 AI INTEGRATION VERIFICATION: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

testAIIntegration().catch(console.error);
