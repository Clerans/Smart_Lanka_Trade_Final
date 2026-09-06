const axios = require('axios');

async function testEndpoints() {
  console.log('--- Testing Backend AI Endpoints ---');
  const BASE = 'http://localhost:5000/api/ai';

  try {
    // 1. Single Recommendation
    console.log('\n1. Testing GET /api/ai/recommendation/BTCUSDT');
    const btcRes = await axios.get(`${BASE}/recommendation/BTCUSDT`);
    console.log('Status:', btcRes.status);
    console.log('Recommendation:', btcRes.data.data.recommendation);
    console.log('Confidence:', btcRes.data.data.confidence + '%');
    console.log('Risk:', btcRes.data.data.risk);
    console.log('Price LKR:', btcRes.data.data.priceLKR);
    console.log('RSI:', btcRes.data.data.indicators.rsi);
    console.log('Reasons:', btcRes.data.data.reasons);

    // 2. All Recommendations
    console.log('\n2. Testing GET /api/ai/recommendations');
    const allRes = await axios.get(`${BASE}/recommendations`);
    console.log('Status:', allRes.status);
    console.log('Count:', allRes.data.count);
    console.log('Symbols:', allRes.data.data.map(d => d.symbol).join(', '));

    // 3. Chat with SOMI
    console.log('\n3. Testing POST /api/ai/chat (Query: "What do you think about Ethereum?")');
    const chatRes = await axios.post(`${BASE}/chat`, {
      message: 'What do you think about Ethereum?'
    });
    console.log('Status:', chatRes.status);
    console.log('Reply:\n', chatRes.data.data.reply);

    // 4. Recommendation History
    console.log('\n4. Testing GET /api/ai/history/BTCUSDT');
    const histRes = await axios.get(`${BASE}/history/BTCUSDT?limit=5`);
    console.log('Status:', histRes.status);
    console.log('History count in DB:', histRes.data.count);

    console.log('\n🎉 ALL AI ENDPOINT TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('❌ API Test Error:', error.response?.data || error.message);
    process.exit(1);
  }
}

testEndpoints();
