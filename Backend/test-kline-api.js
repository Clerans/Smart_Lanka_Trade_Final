const { getKlinesWithIndicators } = require('./services/marketDataService');

async function testDirect() {
  try {
    const data = await getKlinesWithIndicators('BTCUSDT', '1h', 50);
    console.log('✅ Direct Service Success:', {
      symbol: data.symbol,
      candlesCount: data.candles.length,
      currentPriceUSD: data.currentPriceUSD,
      currentPriceLKR: data.currentPriceLKR,
      sampleCandle: data.candles[data.candles.length - 1]
    });
  } catch (err) {
    console.error('❌ Service Error:', err);
  }
}

testDirect();
