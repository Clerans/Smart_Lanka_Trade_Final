const http = require('http');
const app = require('./server');
const userModel = require('./models/userModel');
const authService = require('./services/authService');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'smartlanka-prod-trade-secret-2026-secure-key';

async function runReleaseGateTests() {
  console.log('================================================================');
  console.log('🛡️ SMARTLANKA TRADE — RELEASE GATE SECURITY AUDIT & VERIFICATION');
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

  // Start HTTP server on ephemeral port
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
    // ----------------------------------------------------
    // SECTION 1: JWT Authentication & Protected Endpoints
    // ----------------------------------------------------
    console.log('--- 1. Verification of JWT Authentication & Protected Routes ---');

    // 1.1 Unauthenticated requests are rejected (401)
    const noAuthRes = await request('/api/auth/profile');
    report('AUTH-001', 'Unauthenticated Call to /profile Rejected', noAuthRes.status === 401, `Status: ${noAuthRes.status}`);

    // 1.2 Malformed token is rejected (401)
    const badTokenRes = await request('/api/auth/profile', 'GET', {
      Authorization: 'Bearer malformed.invalid.token'
    });
    report('AUTH-002', 'Malformed Bearer Token Rejected', badTokenRes.status === 401, `Status: ${badTokenRes.status}`);

    // 1.3 Expired token is rejected (401)
    const expiredToken = jwt.sign({ id: 1, email: 'test@example.com' }, JWT_SECRET, { expiresIn: '-10s' });
    const expiredRes = await request('/api/auth/profile', 'GET', {
      Authorization: `Bearer ${expiredToken}`
    });
    report('AUTH-003', 'Expired Token Rejected', expiredRes.status === 401, `Status: ${expiredRes.status}`);

    // ----------------------------------------------------
    // SECTION 2: Google OAuth 2.0 Contract & Identity
    // ----------------------------------------------------
    console.log('\n--- 2. Google OAuth 2.0 Security & Identity Protection ---');

    // 2.1 Missing params rejected
    const emptyGoogleRes = await request('/api/auth/google-login', 'POST', {}, {});
    report('OAUTH-001', 'Missing Google Auth Params Rejected (400)', emptyGoogleRes.status === 400);

    // 2.2 Invalid Google ID token rejected
    const badGoogleRes = await request('/api/auth/google-login', 'POST', {}, { idToken: 'invalid.google.token' });
    report('OAUTH-002', 'Invalid Google Token Rejected (401)', badGoogleRes.status === 401);

    // 2.3 Firebase is completely removed
    const pkg = require('./package.json');
    const hasFirebase = 'firebase' in (pkg.dependencies || {}) || 'firebase-admin' in (pkg.dependencies || {});
    report('OAUTH-003', 'Zero Firebase Dependencies in Backend Manifest', !hasFirebase);

    // ----------------------------------------------------
    // SECTION 3: User Isolation & Parameter Tampering Guard
    // ----------------------------------------------------
    console.log('\n--- 3. User Isolation & Parameter Tampering Guard ---');

    // 3.1 Transfer endpoint rejects client-supplied senderUserId
    const fakeSenderTransfer = await request('/api/wallet/transfer', 'POST', {}, {
      recipientUid: 'SLT-RECEIVER',
      amount: 1000,
      senderUserId: 1,
      USER_ID: 1,
      accountUid: 'SLT-FORGED'
    });
    report('ISO-001', 'Transfer Rejects Client-Supplied Sender IDs (401 Without Verified Token)', fakeSenderTransfer.status === 401);

    // 3.2 Wallet details rejects unauthenticated access
    const walletRes = await request('/api/wallet');
    report('ISO-002', 'Wallet Access Strictly Requires Verified Token', walletRes.status === 401);

    // 3.3 Portfolio details rejects unauthenticated access
    const portfolioRes = await request('/api/portfolio');
    report('ISO-003', 'Portfolio Access Strictly Requires Verified Token', portfolioRes.status === 401);

    // 3.4 Transactions list rejects unauthenticated access
    const transactionsRes = await request('/api/transactions');
    report('ISO-004', 'Transactions Access Strictly Requires Verified Token', transactionsRes.status === 401);

    // ----------------------------------------------------
    // SECTION 4: Role-Based Access Control (RBAC)
    // ----------------------------------------------------
    console.log('\n--- 4. Role-Based Access Control (RBAC) ---');
    const adminKycRes = await request('/api/admin/kyc/pending');
    report('RBAC-001', 'Admin KYC Queue Guarded', adminKycRes.status === 401);

    const adminUsersRes = await request('/api/auth/users');
    report('RBAC-002', 'Admin Users List Guarded', adminUsersRes.status === 401);

  } finally {
    server.close();
  }

  console.log('\n================================================================');
  console.log(`📊 RELEASE GATE RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runReleaseGateTests().catch(err => {
  console.error('Fatal release gate test error:', err);
  process.exit(1);
});
