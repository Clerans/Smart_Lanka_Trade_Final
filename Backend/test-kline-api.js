const axios = require('axios');

async function testHttp() {
  try {
    const res = await axios.get('http://127.0.0.1:5000/api/market/klines/BTCUSDT?interval=1h&limit=5');
    console.log('✅ HTTP API Success:', {
      status: res.status,
      success: res.data.success,
      symbol: res.data.data.symbol,
      interval: res.data.data.interval,
      usdToLkr: res.data.data.usdToLkr,
      candlesCount: res.data.data.candles.length,
      sampleCandle: res.data.data.candles[0]
    });
  } catch (err) {
    console.error('❌ HTTP API Error:', err.response?.data || err.message);
  }
}

testHttp();
