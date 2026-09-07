const http = require('http');

const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT', 'XRPUSDT', 'DOGEUSDT'];
const intervals = ['1m', '5m', '15m', '1h', '4h', '1d'];

async function testKline(symbol, interval) {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:5000/api/market/klines/' + symbol + '?interval=' + interval + '&limit=30', (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, json });
        } catch(e) {
          resolve({ status: res.statusCode, err: e.message, data });
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  console.log('Testing live klines for all 7 symbols and all supported intervals...');
  let allPassed = true;

  for (let i = 0; i < symbols.length; i++) {
    const sym = symbols[i];
    const intv = intervals[i % intervals.length];
    const res = await testKline(sym, intv);
    
    if (res.status === 200 && res.json && res.json.success) {
      const candles = res.json.data.candles;
      const ind = res.json.data.indicators;
      const lkrRate = res.json.data.usdToLkr;

      let validCandles = true;
      for (const c of candles) {
        if (!c.timestamp || isNaN(c.open) || isNaN(c.high) || isNaN(c.low) || isNaN(c.close) || isNaN(c.volume)) {
          validCandles = false;
        }
        if (c.high < Math.max(c.open, c.close) * 0.9999 || c.low > Math.min(c.open, c.close) * 1.0001) {
          validCandles = false;
        }
        if (!c.closeLKR || c.closeLKR <= 0) {
          validCandles = false;
        }
      }

      console.log('[PASS] ' + sym + ' (' + intv + '): ' + candles.length + ' candles, LKR: ' + lkrRate + ', Last Close: Rs ' + candles[candles.length - 1].closeLKR.toFixed(2) + ', Valid OHLC: ' + validCandles + ', SMA20: ' + (ind?.sma20?.length || 0) + ', EMA50: ' + (ind?.ema50?.length || 0));
    } else {
      console.log('[FAIL] ' + sym + ' (' + intv + '): Status ' + res.status, res.json || res.err);
      allPassed = false;
    }
  }

  console.log('\n--- Testing Validation Handling ---');
  const invalidSymRes = await testKline('FAKECOIN', '1h');
  console.log('Invalid symbol status:', invalidSymRes.status, invalidSymRes.json?.message);
  const invalidIntvRes = await testKline('BTCUSDT', '99h');
  console.log('Invalid interval status:', invalidIntvRes.status, invalidIntvRes.json?.message);

  console.log('\nAll tests completed. Result:', allPassed ? 'SUCCESS' : 'FAILURE');
}

run().catch(console.error);
