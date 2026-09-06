const request = require('supertest');
const app = require('./server');

async function testSupertest() {
  try {
    const res = await request(app).get('/api/market/klines/BTCUSDT?interval=1h&limit=10');
    console.log('✅ Supertest Status:', res.status);
    console.log('Data summary:', {
      success: res.body.success,
      symbol: res.body.data?.symbol,
      candlesCount: res.body.data?.candles?.length,
      sampleCandle: res.body.data?.candles?.[0]
    });
  } catch (err) {
    console.error('❌ Supertest Error:', err);
  }
}

testSupertest();
