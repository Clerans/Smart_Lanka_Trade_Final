const axios = require('axios');

async function testHttp() {
  try {
    const res = await axios.get('http://localhost:5000/api/market/klines/SOLUSDT?interval=15m&limit=25');
    console.log('✅ HTTP API Status:', res.status);
    console.log('Data:', {
      success: res.data.success,
      symbol: res.data.data.symbol,
      interval: res.data.data.interval,
      usdToLkr: res.data.data.usdToLkr,
      candlesCount: res.data.data.candles.length,
      rsi: res.data.data.indicators.rsi14,
      macd: res.data.data.indicators.macd
    });
  } catch (err) {
    console.error('❌ HTTP API Error:', err.response?.data || err.message);
  }
}

testHttp();
