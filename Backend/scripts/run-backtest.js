const fs = require('fs');
const path = require('path');
const { runMultiSymbolBacktest } = require('../services/backtestService');

async function main() {
  console.log('================================================================');
  console.log('🔬 SMARTLANKA TRADE — AI RECOMMENDATION EMPIRICAL BACKTEST');
  console.log('================================================================');
  console.log('Timeframe: 1-Hour | Horizons: 1h, 4h, 24h | Zero Data Leakage: YES');
  console.log('----------------------------------------------------------------\n');

  const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT'];
  const startTime = Date.now();

  const results = await runMultiSymbolBacktest(symbols);
  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n================================================================');
  console.log('📊 EMPIRICAL RESEARCH RESULTS SUMMARY (1h Horizon)');
  console.log('================================================================');
  console.log('Symbol     | Samples | Accuracy | Precision | Recall | F1-Score | Avg BUY Return');
  console.log('----------------------------------------------------------------');

  const csvRows = ['Symbol,Horizon,Samples,AccuracyPct,MacroPrecision,MacroRecall,MacroF1,BuyCount,SellCount,HoldCount,AvgBuyReturnPct,AvgSellReturnPct,WinRatePct'];

  for (const [sym, data] of Object.entries(results)) {
    if (data.error) {
      console.log(`${sym.padEnd(10, ' ')} | ERROR: ${data.error}`);
      continue;
    }

    const h1 = data.horizonResults[1];
    const paper = data.paperTradingSimulation;

    const symCol = sym.padEnd(10, ' ');
    const samplesCol = String(h1.sampleCount).padStart(7, ' ');
    const accCol = (h1.accuracy + '%').padStart(8, ' ');
    const precCol = String(h1.macroPrecision).padStart(9, ' ');
    const recCol = String(h1.macroRecall).padStart(6, ' ');
    const f1Col = String(h1.macroF1Score).padStart(8, ' ');
    const retCol = (h1.averageBuyReturnPct + '%').padStart(14, ' ');

    console.log(`${symCol} | ${samplesCol} | ${accCol} | ${precCol} | ${recCol} | ${f1Col} | ${retCol}`);

    // Collect CSV rows
    for (const [hKey, hVal] of Object.entries(data.horizonResults)) {
      csvRows.push(`${sym},${hKey}h,${hVal.sampleCount},${hVal.accuracy},${hVal.macroPrecision},${hVal.macroRecall},${hVal.macroF1Score},${hVal.buyCount},${hVal.sellCount},${hVal.holdCount},${hVal.averageBuyReturnPct},${hVal.averageSellReturnPct},${paper.winRatePct}`);
    }
  }

  console.log('----------------------------------------------------------------');
  console.log(`⏱️ Total Backtest Execution Time: ${durationSec} seconds\n`);

  // Write results to JSON
  const jsonPath = path.join(__dirname, '../backtest-results.json');
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`💾 Saved detailed results to: ${jsonPath}`);

  // Write results to CSV
  const csvPath = path.join(__dirname, '../backtest-results.csv');
  fs.writeFileSync(csvPath, csvRows.join('\n'), 'utf8');
  console.log(`💾 Saved summary CSV to: ${csvPath}\n`);
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
