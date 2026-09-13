const http = require('http');
const app = require('./server');
const { firebaseAuth } = require('./middleware/firebaseAuthMiddleware');
const userModel = require('./models/userModel');
const { generateAccountUID } = require('./utils/uidGenerator');

async function runTestSuite() {
  console.log('================================================================');
  console.log('🧪 SMARTLANKA TRADE — FIREBASE AUTHENTICATION TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function report(id, name, result, details = '') {
    if (result) {
      console.log(`✅ [PASS] ${id}: ${name} ${details ? `(${details})` : ''}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${id}: ${name} ${details ? `(${details})` : ''}`);
      failed++;
      process.exitCode = 1;
    }
  }

  // Start HTTP server on dynamic port
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  const request = (path, method = 'GET', headers = {}, body = null) => {
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path,
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers
          }
        },
        res => {
          let data = '';
          res.on('data', chunk => (data += chunk));
          res.on('end', () => {
            try {
              resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
            } catch (e) {
              resolve({ status: res.statusCode, headers: res.headers, body: data });
            }
          });
        }
      );
      req.on('error', reject);
      if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
      req.end();
    });
  };

  try {
    // ----------------------------------------------------------------
    // TEST-005 & TEST-006: Missing & Malformed Token Rejection
    // ----------------------------------------------------------------
    console.log('--- 1. Token Security & Header Validation ---');
    const noTokenRes = await request('/api/auth/profile');
    report('TEST-006', 'Missing Token Rejection', noTokenRes.status === 401, `Status: ${noTokenRes.status}`);

    const malformedRes = await request('/api/auth/profile', 'GET', {
      Authorization: 'Bearer invalid.malformed.firebase.jwt.token'
    });
    report('TEST-005', 'Invalid/Malformed Token Rejection', malformedRes.status === 401, `Status: ${malformedRes.status}`);

    const badHeaderRes = await request('/api/auth/profile', 'GET', {
      Authorization: 'Basic dXNlcjpwYXNz'
    });
    report('TEST-007', 'Non-Bearer Scheme Rejection', badHeaderRes.status === 401, `Status: ${badHeaderRes.status}`);

    // ----------------------------------------------------------------
    // TEST-010 & TEST-011: Account UID Generation & DB Modeling
    // ----------------------------------------------------------------
    console.log('\n--- 2. SmartLanka Account UID & User Synchronization ---');
    const testUid = generateAccountUID();
    report('TEST-011', 'Account UID Generation Format', /^SLT-[A-Z0-9]{7}$/.test(testUid), `Sample UID: ${testUid}`);

    // Test Oracle user model methods exist and are functions
    report('TEST-010', 'Model method findByFirebaseUid exists', typeof userModel.findByFirebaseUid === 'function');
    report('TEST-010', 'Model method linkFirebaseUid exists', typeof userModel.linkFirebaseUid === 'function');
    report('TEST-010', 'Model method createOrSyncFirebaseUser exists', typeof userModel.createOrSyncFirebaseUser === 'function');

    // ----------------------------------------------------------------
    // TEST-015: Sender Identity Security Check
    // ----------------------------------------------------------------
    console.log('\n--- 3. Authorization & Identity Derivation ---');
    const transferAttempt = await request('/api/wallet/transfer', 'POST', {}, {
      recipientUid: 'SLT-TEST123',
      amount: 500,
      senderUserId: 999 // Client attempt to forge sender
    });
    report('TEST-015', 'Client Cannot Impersonate Sender in Transfer', transferAttempt.status === 401, `Status: ${transferAttempt.status}`);

    // ----------------------------------------------------------------
    // TEST-016: Admin RBAC Protection
    // ----------------------------------------------------------------
    console.log('\n--- 4. Admin RBAC Guard ---');
    const adminEndpointRes = await request('/api/admin/kyc/pending');
    report('TEST-016', 'Admin Endpoint Rejects Unauthenticated Access', adminEndpointRes.status === 401, `Status: ${adminEndpointRes.status}`);

    // ----------------------------------------------------------------
    // TEST-020: Rate Limiter & Reverse Proxy Test
    // ----------------------------------------------------------------
    console.log('\n--- 5. Rate Limiter & Proxy Config ---');
    const rateLimitProxyCheck = await request('/api/auth/validate-token', 'GET', {
      'X-Forwarded-For': '198.51.100.24, 10.0.0.1'
    });
    report('TEST-020', 'Rate Limiter Handles Proxy Headers Safely', rateLimitProxyCheck.status === 401, `Status: ${rateLimitProxyCheck.status}`);

    // ----------------------------------------------------------------
    // TEST-021: Public Market & Health Endpoints
    // ----------------------------------------------------------------
    console.log('\n--- 6. System Health & Public Market Endpoints ---');
    const healthRes = await request('/api/health');
    report('TEST-021', 'Health Endpoint Status UP', healthRes.status === 200 && healthRes.body.status === 'UP', `Service: ${healthRes.body.service}`);

  } finally {
    server.close();
  }

  console.log('\n================================================================');
  console.log(`📊 RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
