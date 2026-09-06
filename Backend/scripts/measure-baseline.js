const axios = require('axios');
const oracledb = require('oracledb');
require('dotenv').config();

const BASE_URL = 'http://localhost:5000';

async function timeRequest(name, fn) {
  const start = process.hrtime.bigint();
  try {
    const res = await fn();
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1e6;
    return { name, durationMs: parseFloat(durationMs.toFixed(2)), status: 'SUCCESS', data: res.data || res };
  } catch (err) {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1e6;
    return { name, durationMs: parseFloat(durationMs.toFixed(2)), status: 'FAILED', error: err.message };
  }
}

async function runBenchmark() {
  console.log('================================================================');
  console.log('📊 SMARTLANKA TRADE — SYSTEM PERFORMANCE BENCHMARK');
  console.log('================================================================\n');

  const results = [];

  // 1. Health & Base Test
  results.push(await timeRequest('Health / Server Root', () => axios.get(`${BASE_URL}/`)));
  results.push(await timeRequest('Test Market Route', () => axios.get(`${BASE_URL}/api/test-market`)));

  // 2. Market Endpoints
  results.push(await timeRequest('GET /api/market/live', () => axios.get(`${BASE_URL}/api/market/live`)));
  results.push(await timeRequest('GET /api/market/price-lkr (BTC)', () => axios.get(`${BASE_URL}/api/market/price-lkr?symbol=BTCUSDT`)));
  results.push(await timeRequest('GET /api/market/prices-lkr (5 symbols)', () => axios.get(`${BASE_URL}/api/market/prices-lkr`)));

  // 3. AI Endpoints
  results.push(await timeRequest('GET /api/ai/recommendation/BTCUSDT', () => axios.get(`${BASE_URL}/api/ai/recommendation/BTCUSDT`)));
  results.push(await timeRequest('GET /api/ai/recommendation/ETHUSDT', () => axios.get(`${BASE_URL}/api/ai/recommendation/ETHUSDT`)));
  results.push(await timeRequest('GET /api/ai/signals (All Assets)', () => axios.get(`${BASE_URL}/api/ai/signals`)));

  // 4. Oracle DB Direct Query Latency
  let conn;
  try {
    const startDb = process.hrtime.bigint();
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT
    });
    const dbQueryRes = await conn.execute('SELECT 1 FROM dual');
    const endDb = process.hrtime.bigint();
    const dbDuration = Number(endDb - startDb) / 1e6;
    results.push({ name: 'Oracle DB Direct Connection & Query', durationMs: parseFloat(dbDuration.toFixed(2)), status: 'SUCCESS' });
  } catch (dbErr) {
    results.push({ name: 'Oracle DB Direct Connection & Query', durationMs: 0, status: 'FAILED', error: dbErr.message });
  } finally {
    if (conn) await conn.close();
  }

  console.log('----------------------------------------------------------------');
  console.log('| Endpoint / Component                       | Time (ms) | Status |');
  console.log('----------------------------------------------------------------');
  results.forEach(r => {
    const nameCol = r.name.padEnd(42, ' ');
    const timeCol = (r.durationMs + ' ms').padStart(9, ' ');
    const statusCol = r.status.padStart(7, ' ');
    console.log(`| ${nameCol} | ${timeCol} | ${statusCol} |`);
  });
  console.log('----------------------------------------------------------------\n');

  return results;
}

if (require.main === module) {
  runBenchmark().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { runBenchmark };
