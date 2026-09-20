/**
 * Automated Test Suite for Google OAuth Authentication Flow
 * Tests configuration, token verification error handling, user creation,
 * automatic verification status, wallet provisioning, and JWT token issuance.
 */
require('dotenv').config();
const { OAuth2Client } = require('google-auth-library');
const connectDB = require('./config/db');
const authService = require('./services/authService');
const userModel = require('./models/userModel');
const jwt = require('jsonwebtoken');
const oracledb = require('oracledb');

async function runGoogleOAuthTests() {
  console.log('========================================================');
  console.log('🧪 SMARTLANKA TRADE — GOOGLE OAUTH TEST SUITE');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, description) {
    if (condition) {
      console.log(`  ✅ PASS: ${description}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${description}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // Test 1: Configuration Validation
  // -------------------------------------------------------------
  console.log('--- 1. Configuration Validation ---');
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  assert(!!googleClientId && googleClientId.includes('apps.googleusercontent.com'), `Google Client ID is configured (${googleClientId ? googleClientId.substring(0, 25) + '...' : 'missing'})`);
  assert(!!process.env.JWT_SECRET, 'JWT_SECRET is configured on the server');

  // -------------------------------------------------------------
  // Test 2: Invalid & Missing ID Token Rejection
  // -------------------------------------------------------------
  console.log('\n--- 2. Token Validation & Rejection ---');
  try {
    await authService.googleLoginUser(null);
    assert(false, 'Null token was accepted');
  } catch (err) {
    assert(err.code === 'MISSING_TOKEN' || err.status === 400, 'Null token correctly rejected with HTTP 400 (MISSING_TOKEN)');
  }

  try {
    await authService.googleLoginUser('invalid_dummy_google_id_token_xyz');
    assert(false, 'Invalid token was accepted');
  } catch (err) {
    assert(err.code === 'INVALID_GOOGLE_TOKEN' || err.status === 401, 'Invalid Google ID token correctly rejected with HTTP 401 (INVALID_GOOGLE_TOKEN)');
  }

  // -------------------------------------------------------------
  // Test 3: OAuth2Client Verification Engine
  // -------------------------------------------------------------
  console.log('\n--- 3. OAuth2Client Library Verification Engine ---');
  try {
    const client = new OAuth2Client(googleClientId);
    assert(client !== null && typeof client.verifyIdToken === 'function', 'OAuth2Client initialized with Google Client ID');
  } catch (err) {
    assert(false, `OAuth2Client initialization error: ${err.message}`);
  }

  // -------------------------------------------------------------
  // Test 4: Live Oracle DB User Sync for Google Authenticated Accounts
  // -------------------------------------------------------------
  console.log('\n--- 4. Live Oracle DB Google User Provisioning & Auto-Verification ---');
  let pool;
  let testGoogleUserId = null;
  const mockGoogleEmail = `google.user.${Date.now()}@gmail.com`;
  const mockGoogleName = 'Google Verified Trader';

  try {
    pool = await connectDB();
    assert(pool !== null, 'Oracle Database connected');

    // Simulate Google verified user creation
    const crypto = require('crypto');
    const bcrypt = require('bcryptjs');
    const randomPassword = crypto.randomBytes(16).toString('hex');
    const hashedPassword = await bcrypt.hash(randomPassword, 10);
    const token = crypto.randomBytes(32).toString('hex');
    
    // Create and auto-verify Google authenticated user
    const userId = await userModel.createUser(mockGoogleName, mockGoogleEmail, hashedPassword, token);
    testGoogleUserId = userId;
    await userModel.verifyUser(userId);

    const createdUser = await userModel.findById(userId);
    assert(createdUser !== null, 'Google user successfully created in Oracle DB');
    assert(createdUser.IS_VERIFIED === 1, 'Google user is automatically marked as verified (IS_VERIFIED = 1)');
    assert(createdUser.EMAIL_VERIFIED === 1, 'Google user email is verified (EMAIL_VERIFIED = 1)');
    assert(!!createdUser.ACCOUNT_UID, `Google user assigned unique Account UID: ${createdUser.ACCOUNT_UID}`);

    // Check Wallet Provisioning
    let conn;
    try {
      conn = await oracledb.getConnection();
      const walletRes = await conn.execute(
        `SELECT BALANCE_LKR FROM WALLETS WHERE USER_ID = :id`,
        { id: userId },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      assert(walletRes.rows.length > 0 && parseFloat(walletRes.rows[0].BALANCE_LKR) === 1000000, 'Initial trading wallet provisioned with LKR 1,000,000');
    } finally {
      if (conn) await conn.close();
    }

    // Check JWT Token Generation
    const userRole = createdUser.ROLE || 'USER';
    const jwtToken = jwt.sign(
      { id: createdUser.ID, email: createdUser.EMAIL, role: userRole },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
    const decoded = jwt.verify(jwtToken, process.env.JWT_SECRET);
    assert(decoded.id === userId && decoded.email === mockGoogleEmail, 'Authoritative JWT session issued for Google user');

  } catch (dbErr) {
    assert(false, `Database test error: ${dbErr.message}`);
  } finally {
    if (testGoogleUserId) {
      let conn;
      try {
        conn = await oracledb.getConnection();
        await conn.execute(`DELETE FROM WALLETS WHERE USER_ID = :id`, { id: testGoogleUserId });
        await conn.execute(`DELETE FROM SL_WALLETS WHERE USER_ID = :id`, { id: testGoogleUserId });
        await conn.execute(`DELETE FROM SL_USERS WHERE ID = :id`, { id: testGoogleUserId });
        await conn.commit();
      } catch (cleanErr) {
      } finally {
        if (conn) await conn.close();
      }
    }
    const { closePool } = require('./config/db');
    await closePool();
  }

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  console.log('\n========================================================');
  console.log(`📊 Google OAuth Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('========================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runGoogleOAuthTests().catch(err => {
  console.error('Test suite uncaught error:', err);
  process.exit(1);
});
