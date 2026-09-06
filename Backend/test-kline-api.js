const axios = require('axios');

async function test() {
  try {
    const res = await axios.get('http://127.0.0.1:5000/api/market/klines/BTCUSDT?interval=1h&limit=5');
    console.log('✅ Response:', {
      status: res.status,
      success: res.data.success,
      symbol: res.data.data.symbol,
      candles: res.data.data.candles.length,
      sample: res.data.data.candles[0]
    });
  } catch (err) {
    console.error('❌ Request error:', err.message, err.response?.data);
  }
}

test();
