/**
 * SMARTLANKA TRADE — CONCURRENCY & STABILITY BENCHMARK SUITE
 * 
 * Measures throughput, p50/p95/p99 latency, and connection stability
 * across core API endpoints under simulated concurrent workloads.
 */

const http = require('http');

const BASE_URL = 'http://127.0.0.1:5000';

function makeRequest(path) {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    const req = http.get(`${BASE_URL}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const end = process.hrtime.bigint();
        const durationMs = Number(end - start) / 1e6;
        resolve({
          statusCode: res.statusCode,
          durationMs,
          success: res.statusCode >= 200 && res.statusCode < 400
        });
      });
    });

    req.on('error', (err) => {
      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1e6;
      resolve({
        statusCode: 0,
        durationMs,
        success: false,
        error: err.message
      });
    });

    req.setTimeout(10000, () => {
      req.destroy();
      resolve({
        statusCode: 408,
        durationMs: 10000,
        success: false,
        error: 'Timeout'
      });
    });
  });
}

function calculatePercentiles(durations) {
  const sorted = [...durations].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.50)] || 0;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
  const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;
  const avg = sorted.reduce((sum, d) => sum + d, 0) / (sorted.length || 1);
  return {
    min: sorted[0] || 0,
    max: sorted[sorted.length - 1] || 0,
    avg: Math.round(avg * 100) / 100,
    p50: Math.round(p50 * 100) / 100,
    p95: Math.round(p95 * 100) / 100,
    p99: Math.round(p99 * 100) / 100
  };
}

async function runConcurrentBatch(path, concurrency) {
  const promises = [];
  for (let i = 0; i < concurrency; i++) {
    promises.push(makeRequest(path));
  }
  return Promise.all(promises);
}

async function runBenchmark() {
  console.log('====================================================');
  console.log('⚡ SMARTLANKA TRADE — API LOAD & STABILITY BENCHMARK');
  console.log('====================================================\n');

  // Check health first
  const healthRes = await makeRequest('/health');
  if (!healthRes.success) {
    console.error('❌ Server is not reachable at', BASE_URL);
    process.exit(1);
  }
  console.log('✅ Server health verified. Starting stress tests...\n');

  const endpoints = [
    { name: 'Health Endpoint', path: '/health' },
    { name: 'Live Market Data', path: '/api/market/live' },
    { name: 'Price LKR (BTC)', path: '/api/market/price-lkr?coin=BTC' },
    { name: 'AI Recommendation (BTC)', path: '/api/ai/recommendation?symbol=BTC' }
  ];

  const concurrencyLevels = [10, 25, 50];

  for (const ep of endpoints) {
    console.log(`--- Testing Endpoint: ${ep.name} (${ep.path}) ---`);
    for (const c of concurrencyLevels) {
      const results = await runConcurrentBatch(ep.path, c);
      const successful = results.filter(r => r.success).length;
      const failed = results.length - successful;
      const durations = results.map(r => r.durationMs);
      const stats = calculatePercentiles(durations);

      console.log(`  Concurrency: ${String(c).padStart(2)} reqs | Success: ${successful}/${c} (${Math.round(successful/c*100)}%) | Avg: ${stats.avg}ms | P50: ${stats.p50}ms | P95: ${stats.p95}ms | P99: ${stats.p99}ms`);
    }
    console.log('');
  }

  // 100-request sustained loop for memory and pool stability
  console.log('--- Running 100-Request Sustained Stability Loop ---');
  let successCount = 0;
  const loopDurations = [];
  for (let i = 0; i < 100; i++) {
    const res = await makeRequest('/api/market/live');
    if (res.success) successCount++;
    loopDurations.push(res.durationMs);
  }
  const loopStats = calculatePercentiles(loopDurations);
  console.log(`  Total Requests: 100 | Success Rate: ${successCount}% | Avg Latency: ${loopStats.avg}ms | P95: ${loopStats.p95}ms`);

  // Final Health & Memory Check
  const finalHealth = await makeRequest('/health');
  console.log('\n--- Final System State After Benchmark ---');
  console.log(`  Health Status: ${finalHealth.statusCode === 200 ? '✅ HEALTHY' : '❌ UNHEALTHY'}`);
  console.log('\n====================================================');
  console.log('🎯 LOAD & STABILITY BENCHMARK COMPLETE');
  console.log('====================================================\n');
}

runBenchmark().catch(console.error);
