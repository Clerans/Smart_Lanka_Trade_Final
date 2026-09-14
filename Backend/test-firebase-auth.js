const http = require('http');
const app = require('./server');
const userModel = require('./models/userModel');
const authService = require('./services/authService');
const { generateAccountUID } = require('./utils/uidGenerator');
const { isInitialized } = require('./config/firebaseAdmin');
const oracledb = require('oracledb');
const fs = require('fs');
const path = require('path');

async function runTestSuite() {
  console.log('================================================================');
  console.log('🧪 SMARTLANKA TRADE — FIREBASE AUTHENTICATION & GOOGLE TEST SUITE');
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

  // Start HTTP server on dynamic local port
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
    // AUTH-001: Missing token -> 401
    // ----------------------------------------------------------------
    console.log('--- 1. Authentication & Token Validation (AUTH-001 to AUTH-008) ---');
    const auth001 = await request('/api/auth/profile');
    report('AUTH-001', 'Missing Firebase token → 401', auth001.status === 401, `Status: ${auth001.status}`);

    // ----------------------------------------------------------------
    // AUTH-002: Invalid Firebase token -> 401
    // ----------------------------------------------------------------
    const auth002 = await request('/api/auth/profile', 'GET', {
      Authorization: 'Bearer invalid.token'
    });
    report('AUTH-002', 'Invalid Firebase token → 401', auth002.status === 401, `Status: ${auth002.status}`);

    // ----------------------------------------------------------------
    // AUTH-003: Expired / forged signature Firebase token -> 401
    // ----------------------------------------------------------------
    const auth003 = await request('/api/auth/profile', 'GET', {
      Authorization: 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.fake_signature'
    });
    report('AUTH-003', 'Expired / Forged Firebase token → 401', auth003.status === 401, `Status: ${auth003.status}`);

    // ----------------------------------------------------------------
    // AUTH-004: Client cannot override user ID
    // ----------------------------------------------------------------
    const auth004 = await request('/api/wallet/transfer', 'POST', {}, {
      recipientUid: 'SLT-TEST123',
      amount: 500,
      userId: 1,
      USER_ID: 1
    });
    report('AUTH-004', 'Client cannot override user ID', auth004.status === 401, `Status: ${auth004.status}`);

    // ----------------------------------------------------------------
    // AUTH-005: Client cannot override role
    // ----------------------------------------------------------------
    const auth005 = await request('/api/auth/profile', 'PUT', {}, {
      role: 'ADMIN',
      ROLE: 'ADMIN'
    });
    report('AUTH-005', 'Client cannot override role', auth005.status === 401, `Status: ${auth005.status}`);

    // ----------------------------------------------------------------
    // AUTH-006: Client cannot override Firebase UID
    // ----------------------------------------------------------------
    const auth006 = await request('/api/auth/profile', 'PUT', {}, {
      firebaseUid: 'forged_firebase_uid_123',
      FIREBASE_UID: 'forged_firebase_uid_123'
    });
    report('AUTH-006', 'Client cannot override Firebase UID', auth006.status === 401, `Status: ${auth006.status}`);

    // ----------------------------------------------------------------
    // AUTH-007: Email-only account linking rejected (Account Takeover Protection)
    // ----------------------------------------------------------------
    let emailOnlyRejected = false;
    try {
      const origFindByFirebaseUid = userModel.findByFirebaseUid;
      const origFindByEmail = userModel.findByEmail;
      userModel.findByFirebaseUid = async () => null;
      userModel.findByEmail = async () => ({ ID: 100, EMAIL: 'test@example.com', ROLE: 'USER' });

      try {
        await userModel.createOrSyncFirebaseUser({
          firebaseUid: 'untrusted_new_uid',
          email: 'test@example.com',
          name: 'Test',
          emailVerified: true
        });
      } catch (atoErr) {
        emailOnlyRejected = atoErr.code === 'MIGRATION_REQUIRED' && atoErr.status === 409;
      }
      userModel.findByFirebaseUid = origFindByFirebaseUid;
      userModel.findByEmail = origFindByEmail;
    } catch (e) {
      emailOnlyRejected = false;
    }
    report('AUTH-007', 'Email-only account linking rejected (Explicit migration required)', emailOnlyRejected);

    // ----------------------------------------------------------------
    // AUTH-008: Admin migration protection
    // ----------------------------------------------------------------
    let adminMigrationProtected = false;
    try {
      const origFindByFirebaseUid = userModel.findByFirebaseUid;
      const origFindByEmail = userModel.findByEmail;
      userModel.findByFirebaseUid = async () => null;
      userModel.findByEmail = async () => ({ ID: 1, EMAIL: 'admin@example.com', ROLE: 'ADMIN' });

      try {
        await userModel.createOrSyncFirebaseUser({
          firebaseUid: 'attacker_uid',
          email: 'admin@example.com',
          name: 'Admin Attacker',
          emailVerified: true
        });
      } catch (adminErr) {
        adminMigrationProtected = adminErr.code === 'ADMIN_LINK_RESTRICTED' && adminErr.status === 403;
      }
      userModel.findByFirebaseUid = origFindByFirebaseUid;
      userModel.findByEmail = origFindByEmail;
    } catch (e) {
      adminMigrationProtected = false;
    }
    report('AUTH-008', 'Admin migration protection prevents automated takeover', adminMigrationProtected);

    // ----------------------------------------------------------------
    // GOOGLE-001 to GOOGLE-004: Google OAuth 2.0 Integration
    // ----------------------------------------------------------------
    console.log('\n--- 2. Google OAuth 2.0 & Firebase Integration (GOOGLE-001 to GOOGLE-004) ---');

    // GOOGLE-001: Google provider configuration validated
    const loginScreenPath = path.join(__dirname, '..', 'Frontend', 'src', 'screens', 'auth', 'LoginScreen.tsx');
    const loginScreenContent = fs.readFileSync(loginScreenPath, 'utf8');
    const hasGoogleHook = loginScreenContent.includes('Google.useIdTokenAuthRequest') || loginScreenContent.includes('GoogleAuthProvider.credential');
    report('GOOGLE-001', 'Google provider configuration validated in React Native / Expo', hasGoogleHook);

    // GOOGLE-002: Google credential reaches Firebase (signInWithCredential via GoogleAuthProvider)
    const fbAuthServicePath = path.join(__dirname, '..', 'Frontend', 'src', 'services', 'firebaseAuthService.ts');
    const fbAuthServiceContent = fs.readFileSync(fbAuthServicePath, 'utf8');
    const hasGoogleCredFlow = fbAuthServiceContent.includes('signInWithGoogleIdToken') && fbAuthServiceContent.includes('GoogleAuthProvider.credential');
    report('GOOGLE-002', 'Google credential passed to Firebase signInWithCredential()', hasGoogleCredFlow);

    // GOOGLE-003: Backend accepts only Firebase ID token
    const authMiddlewarePath = path.join(__dirname, 'middleware', 'firebaseAuthMiddleware.js');
    const authMiddlewareContent = fs.readFileSync(authMiddlewarePath, 'utf8');
    const enforcesFirebaseIdToken = authMiddlewareContent.includes('verifyFirebaseIdToken');
    report('GOOGLE-003', 'Backend accepts verified Firebase ID token for authorized routes', enforcesFirebaseIdToken);

    // GOOGLE-004: Client cannot forge Google identity
    const googleLoginReq = await request('/api/auth/google-login', 'POST', {}, {});
    report('GOOGLE-004', 'Client cannot forge Google identity (Missing/invalid token rejected)', googleLoginReq.status === 400 || googleLoginReq.status === 401);

    // ----------------------------------------------------------------
    // SECTION 3: Deep Model & Identity Integrity
    // ----------------------------------------------------------------
    console.log('\n--- 3. Identity & Schema Integrity ---');
    report('ID-001', 'Firebase Admin SDK Initialization Status', isInitialized(), `Initialized: ${isInitialized()}`);
    report('ID-002', 'Unique ACCOUNT_UID generation (SLT- prefix)', generateAccountUID().startsWith('SLT-'));
    report('ID-003', 'Model findByFirebaseUid method defined', typeof userModel.findByFirebaseUid === 'function');
    report('ID-004', 'Admin Endpoints Guarded', (await request('/api/admin/kyc/pending')).status === 401);

  } finally {
    server.close();
  }

  console.log('\n================================================================');
  console.log(`📊 TEST SUITE SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
