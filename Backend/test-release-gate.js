const http = require('http');
const app = require('./server');
const userModel = require('./models/userModel');
const authService = require('./services/authService');
const bcrypt = require('bcryptjs');
const { generateAccountUID } = require('./utils/uidGenerator');
const oracledb = require('oracledb');

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
    console.log('--- 1. Verification of POST /api/auth/link-legacy-account ---');

    // 1.1 Prove Firebase auth is required (No token -> 401)
    const linkNoAuth = await request('/api/auth/link-legacy-account', 'POST', {}, {
      legacyPassword: 'SomePassword123!'
    });
    report('LINK-001', 'Unauthenticated Call to /link-legacy-account Rejected', linkNoAuth.status === 401, `Status: ${linkNoAuth.status}`);

    // 1.2 Prove Malformed token -> 401
    const linkBadToken = await request('/api/auth/link-legacy-account', 'POST', {
      Authorization: 'Bearer invalid.token'
    }, {
      legacyPassword: 'SomePassword123!'
    });
    report('LINK-002', 'Malformed Token to /link-legacy-account Rejected', linkBadToken.status === 401, `Status: ${linkBadToken.status}`);

    // 1.3 Direct Unit & Security Validation of authService.linkLegacyAccount
    console.log('\n--- 2. Attacker Scenarios on Legacy Account Linking ---');

    // Scenario A: Attacker tries to claim existing admin account
    const dummyAdminPass = await bcrypt.hash('AdminPass123!', 10);
    const mockAdminUser = {
      ID: 9901,
      EMAIL: 'admin_target@example.com',
      ROLE: 'ADMIN',
      PASSWORD: dummyAdminPass,
      FIREBASE_UID: null
    };

    let adminClaimBlocked = false;
    try {
      // Mock findByEmail to return admin
      const origFindByEmail = userModel.findByEmail;
      userModel.findByEmail = async () => mockAdminUser;
      
      try {
        await authService.linkLegacyAccount('attacker_fb_uid', 'admin_target@example.com', 'AdminPass123!');
      } catch (err) {
        adminClaimBlocked = err.code === 'ADMIN_LINK_RESTRICTED';
      }
      userModel.findByEmail = origFindByEmail;
    } catch (e) {
      adminClaimBlocked = false;
    }
    report('LINK-003', 'Attacker Cannot Claim Existing Admin Account', adminClaimBlocked);

    // Scenario B: Attacker provides WRONG legacy password
    const dummyUserPass = await bcrypt.hash('VictimCorrectPass123!', 10);
    const mockVictimUser = {
      ID: 9902,
      EMAIL: 'victim_user@example.com',
      ROLE: 'USER',
      PASSWORD: dummyUserPass,
      FIREBASE_UID: null
    };

    let wrongPasswordBlocked = false;
    try {
      const origFindByEmail = userModel.findByEmail;
      userModel.findByEmail = async () => mockVictimUser;
      
      try {
        await authService.linkLegacyAccount('attacker_fb_uid', 'victim_user@example.com', 'WrongPasswordAttempt');
      } catch (err) {
        wrongPasswordBlocked = err.code === 'INVALID_PASSWORD' && err.status === 401;
      }
      userModel.findByEmail = origFindByEmail;
    } catch (e) {
      wrongPasswordBlocked = false;
    }
    report('LINK-004', 'Wrong Legacy Password Attempt Rejected', wrongPasswordBlocked);

    // Scenario C: Target account ALREADY has a Firebase UID (cannot overwrite)
    const mockAlreadyLinkedUser = {
      ID: 9903,
      EMAIL: 'already_linked@example.com',
      ROLE: 'USER',
      PASSWORD: dummyUserPass,
      FIREBASE_UID: 'legitimate_original_fb_uid'
    };

    let overwriteBlocked = false;
    try {
      const origFindByEmail = userModel.findByEmail;
      userModel.findByEmail = async () => mockAlreadyLinkedUser;
      
      try {
        await authService.linkLegacyAccount('evil_new_fb_uid', 'already_linked@example.com', 'VictimCorrectPass123!');
      } catch (err) {
        overwriteBlocked = err.code === 'ALREADY_LINKED';
      }
      userModel.findByEmail = origFindByEmail;
    } catch (e) {
      overwriteBlocked = false;
    }
    report('LINK-005', 'Cannot Overwrite Existing Firebase UID on Target Account', overwriteBlocked);

    // Scenario D: Correct legacy password successfully links identity
    let legitimateLinkSuccess = false;
    try {
      const origFindByEmail = userModel.findByEmail;
      const origLinkFirebaseUid = userModel.linkFirebaseUid;
      const origVerifyUser = userModel.verifyUser;
      const origGetUserProfile = authService.getUserProfile;

      let linkedUserId = null;
      let linkedFbUid = null;

      userModel.findByEmail = async () => mockVictimUser;
      userModel.linkFirebaseUid = async (uid, fbUid) => {
        linkedUserId = uid;
        linkedFbUid = fbUid;
        return { ID: uid, FIREBASE_UID: fbUid };
      };
      userModel.verifyUser = async () => {};
      authService.getUserProfile = async (id) => ({ id, email: mockVictimUser.EMAIL });

      const profile = await authService.linkLegacyAccount('legitimate_fb_uid_123', 'victim_user@example.com', 'VictimCorrectPass123!');
      legitimateLinkSuccess = linkedUserId === 9902 && linkedFbUid === 'legitimate_fb_uid_123' && profile.id === 9902;

      userModel.findByEmail = origFindByEmail;
      userModel.linkFirebaseUid = origLinkFirebaseUid;
      userModel.verifyUser = origVerifyUser;
      authService.getUserProfile = origGetUserProfile;
    } catch (e) {
      legitimateLinkSuccess = false;
    }
    report('LINK-006', 'Correct Password Links Only Authenticated Firebase UID', legitimateLinkSuccess);

    // Scenario E: Email equality alone CANNOT auto-link (createOrSyncFirebaseUser rejects with MIGRATION_REQUIRED)
    let autoLinkBlocked = false;
    try {
      const origFindByFirebaseUid = userModel.findByFirebaseUid;
      const origFindByEmail = userModel.findByEmail;

      userModel.findByFirebaseUid = async () => null;
      userModel.findByEmail = async () => mockVictimUser;

      try {
        await userModel.createOrSyncFirebaseUser({
          firebaseUid: 'unauthorized_auto_link_uid',
          email: 'victim_user@example.com',
          name: 'Attacker',
          emailVerified: true
        });
      } catch (err) {
        autoLinkBlocked = err.code === 'MIGRATION_REQUIRED' && err.status === 409;
      }

      userModel.findByFirebaseUid = origFindByFirebaseUid;
      userModel.findByEmail = origFindByEmail;
    } catch (e) {
      autoLinkBlocked = false;
    }
    report('LINK-007', 'Email Matching Alone CANNOT Auto-Link Account (ATO Protected)', autoLinkBlocked);

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
  }
}

runReleaseGateTests().catch(err => {
  console.error('Fatal release gate test error:', err);
  process.exit(1);
});
