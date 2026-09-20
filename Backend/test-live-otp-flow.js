/**
 * Live End-to-End Test Suite for Brevo Email OTP Verification with Oracle Database
 */
const crypto = require('crypto');
require('dotenv').config();
const connectDB = require('./config/db');
const otpModel = require('./models/otpModel');
const userModel = require('./models/userModel');
const authService = require('./services/authService');
const oracledb = require('oracledb');

async function testLiveOtp() {
  console.log('================================================================');
  console.log('🚀 SmartLanka Trade — Live Oracle DB & Brevo OTP Flow Test Suite');
  console.log('================================================================\n');

  let pool;
  try {
    pool = await connectDB();
  } catch (err) {
    console.error('Failed to connect to Oracle DB:', err);
    process.exit(1);
  }

  const testEmail = `test.trader.${Date.now()}@example.com`;
  const testPassword = 'Password@123!';
  const testName = 'Test Automated Trader';

  let testUserId = null;
  let rawGeneratedOtp = null;

  try {
    // -----------------------------------------------------------------
    // Step 1: Register User (Unverified + Triggers OTP generation)
    // -----------------------------------------------------------------
    console.log(`[Step 1] Registering user: ${testEmail}...`);
    
    // We register the user
    const regResult = await authService.registerUser(testName, testEmail, testPassword);
    testUserId = regResult.userId;
    console.log(`✅ User created with ID: ${testUserId}`);

    // Check that user is unverified
    const userInDb = await userModel.findById(testUserId);
    console.log(`  - DB State IS_VERIFIED: ${userInDb.IS_VERIFIED}`);
    console.log(`  - DB State EMAIL_VERIFIED: ${userInDb.EMAIL_VERIFIED}`);

    if (userInDb.IS_VERIFIED !== 0 || userInDb.EMAIL_VERIFIED !== 0) {
      throw new Error('User was not created with unverified status (0)!');
    }
    console.log('✅ User correctly created with IS_VERIFIED = 0, EMAIL_VERIFIED = 0');

    // Check that login is blocked for unverified user
    console.log('\n[Step 2] Testing login block for unverified user...');
    try {
      await authService.loginUser(testEmail, testPassword);
      throw new Error('Login succeeded for unverified user when it should have been blocked!');
    } catch (loginErr) {
      if (loginErr.code === 'EMAIL_NOT_VERIFIED') {
        console.log(`✅ Login blocked as expected: ${loginErr.message}`);
      } else {
        throw loginErr;
      }
    }

    // -----------------------------------------------------------------
    // Step 3: Inspect EMAIL_OTPS table in Oracle DB
    // -----------------------------------------------------------------
    console.log('\n[Step 3] Inspecting EMAIL_OTPS record in Oracle Database...');
    const otpRecord = await otpModel.findOtpByEmail(testEmail);
    if (!otpRecord) {
      throw new Error('No OTP record found in EMAIL_OTPS table!');
    }

    console.log(`  - OTP Record ID: ${otpRecord.ID}`);
    console.log(`  - OTP Hash (64-char hex): ${otpRecord.OTP_HASH}`);
    console.log(`  - Attempts: ${otpRecord.ATTEMPTS}`);
    console.log(`  - Expires At: ${otpRecord.EXPIRES_AT}`);
    console.log(`  - Created At: ${otpRecord.CREATED_AT}`);

    if (otpRecord.OTP_HASH.length !== 64) {
      throw new Error('OTP hash length is not 64 characters (HMAC-SHA256)!');
    }
    console.log('✅ HMAC-SHA256 OTP Hash successfully stored in EMAIL_OTPS.');

    // -----------------------------------------------------------------
    // Step 4: Test 60-Second Cooldown Enforcement
    // -----------------------------------------------------------------
    console.log('\n[Step 4] Testing 60-second cooldown on resend OTP...');
    try {
      await authService.sendOtp(testEmail);
      throw new Error('sendOtp succeeded immediately when cooldown should have blocked it!');
    } catch (cooldownErr) {
      if (cooldownErr.code === 'COOLDOWN_ACTIVE') {
        console.log(`✅ Cooldown enforced correctly: ${cooldownErr.message}`);
      } else {
        throw cooldownErr;
      }
    }

    // -----------------------------------------------------------------
    // Step 5: Test Wrong OTP Attempt & Counter Increment
    // -----------------------------------------------------------------
    console.log('\n[Step 5] Testing wrong OTP code verification and attempt increment...');
    const wrongCode = '999999';
    try {
      await authService.verifyOtp(testEmail, wrongCode);
      throw new Error('verifyOtp succeeded with wrong code!');
    } catch (verifyErr) {
      console.log(`  - Wrong OTP rejected with message: "${verifyErr.message}"`);
    }

    const updatedOtpRecord = await otpModel.findOtpByEmail(testEmail);
    console.log(`  - Updated attempts in DB: ${updatedOtpRecord.ATTEMPTS}`);
    if (updatedOtpRecord.ATTEMPTS !== 1) {
      throw new Error(`Expected attempts to be 1, but got ${updatedOtpRecord.ATTEMPTS}`);
    }
    console.log('✅ Attempts counter incremented correctly in EMAIL_OTPS.');

    // -----------------------------------------------------------------
    // Step 6: Test Successful OTP Verification
    // -----------------------------------------------------------------
    console.log('\n[Step 6] Testing successful OTP verification with valid code...');
    
    // Generate a known test OTP for this email
    const knownTestOtp = '123456';
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await otpModel.createOrReplaceOtp(testEmail, knownTestOtp, expiresAt);

    const verifySuccess = await authService.verifyOtp(testEmail, knownTestOtp);
    console.log(`✅ Verification response: ${verifySuccess.message}`);

    // Check that OTP record was deleted upon successful verification
    const deletedOtpRecord = await otpModel.findOtpByEmail(testEmail);
    if (deletedOtpRecord !== null) {
      throw new Error('OTP record was not deleted from EMAIL_OTPS after successful verification!');
    }
    console.log('✅ OTP record was automatically deleted from EMAIL_OTPS.');

    // Check that user is now marked verified in Oracle
    const verifiedUser = await userModel.findById(testUserId);
    console.log(`  - DB State IS_VERIFIED: ${verifiedUser.IS_VERIFIED}`);
    console.log(`  - DB State EMAIL_VERIFIED: ${verifiedUser.EMAIL_VERIFIED}`);

    if (verifiedUser.IS_VERIFIED !== 1 || verifiedUser.EMAIL_VERIFIED !== 1) {
      throw new Error('User was not marked as verified in SL_USERS!');
    }
    console.log('✅ User is now marked as verified (IS_VERIFIED = 1, EMAIL_VERIFIED = 1).');

    // -----------------------------------------------------------------
    // Step 7: Verify Login and Token Generation for Verified User
    // -----------------------------------------------------------------
    console.log('\n[Step 7] Testing login for verified user...');
    const loginResult = await authService.loginUser(testEmail, testPassword);
    console.log(`✅ Login successful! JWT generated: ${loginResult.token.substring(0, 30)}...`);
    console.log(`  - User role: ${loginResult.user.role}`);
    console.log(`  - User UID: ${loginResult.user.accountUid}`);

    console.log('\n================================================================');
    console.log('🎉 ALL LIVE ORACLE DB & OTP TESTS PASSED PERFECTLY!');
    console.log('================================================================');

  } catch (testError) {
    console.error('\n❌ Test failed with error:', testError.message);
  } finally {
    // Cleanup test user and wallets
    if (testUserId) {
      console.log(`\n🧹 Cleaning up test user ${testUserId} (${testEmail})...`);
      let conn;
      try {
        conn = await oracledb.getConnection();
        await conn.execute(`DELETE FROM EMAIL_OTPS WHERE LOWER(EMAIL) = :email`, { email: testEmail });
        await conn.execute(`DELETE FROM WALLETS WHERE USER_ID = :id`, { id: testUserId });
        await conn.execute(`DELETE FROM SL_WALLETS WHERE USER_ID = :id`, { id: testUserId });
        await conn.execute(`DELETE FROM SL_USERS WHERE ID = :id`, { id: testUserId });
        await conn.commit();
        console.log('✅ Cleanup completed.');
      } catch (cleanErr) {
        console.warn('Cleanup warning:', cleanErr.message);
      } finally {
        if (conn) await conn.close();
      }
    }

    const { closePool } = require('./config/db');
    await closePool();
    process.exit(0);
  }
}

testLiveOtp();
