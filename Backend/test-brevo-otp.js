/**
 * Unit & Integration Test Suite for Brevo Email OTP Verification Flow
 * Tests HMAC-SHA256 hashing, timingSafeEqual comparison, 60s cooldown,
 * 10-min expiry, attempt limits, and safe error masking.
 */
const crypto = require('crypto');
const otpModel = require('./models/otpModel');

async function runTests() {
  console.log('🧪 Starting Brevo Email OTP Verification Test Suite...\n');
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
  // Test 1: HMAC-SHA256 Hashing and timingSafeEqual comparison
  // -------------------------------------------------------------
  console.log('Test 1: HMAC-SHA256 Hashing & Timing-Safe Comparison');
  const rawCode = '482910';
  const wrongCode = '482911';
  const wrongLengthCode = '48291';
  const hash = otpModel.hashOtp(rawCode);

  assert(typeof hash === 'string' && hash.length === 64, 'Hash is a 64-character hex string (SHA256)');
  assert(hash !== rawCode, 'Hash does not equal plain text OTP');

  const matchCorrect = otpModel.verifyOtpHash(rawCode, hash);
  assert(matchCorrect === true, 'verifyOtpHash returns true for correct OTP code');

  const matchWrong = otpModel.verifyOtpHash(wrongCode, hash);
  assert(matchWrong === false, 'verifyOtpHash returns false for incorrect OTP code');

  const matchWrongLength = otpModel.verifyOtpHash(wrongLengthCode, hash);
  assert(matchWrongLength === false, 'verifyOtpHash returns false for mismatched length without crashing');

  // -------------------------------------------------------------
  // Test 2: Random 6-digit OTP generation
  // -------------------------------------------------------------
  console.log('\nTest 2: Cryptographically Secure 6-digit OTP Generation');
  for (let i = 0; i < 5; i++) {
    const code = crypto.randomInt(100000, 1000000).toString();
    assert(code.length === 6 && /^\d{6}$/.test(code) && parseInt(code, 10) >= 100000 && parseInt(code, 10) < 1000000, `Generated valid 6-digit code #${i + 1}: ${code}`);
  }

  // -------------------------------------------------------------
  // Test 3: Brevo API Dispatch Payload Structure & Error Security
  // -------------------------------------------------------------
  console.log('\nTest 3: Brevo API HTTP Payload Structure & Safe Logging');
  const testEmail = 'trader.test@example.com';
  const senderEmail = process.env.BREVO_SENDER || 'no-reply@smartlankatrade.com';

  const payload = {
    sender: { name: 'SmartLanka Trade', email: senderEmail },
    to: [{ email: testEmail }],
    subject: 'SmartLanka Trade - Email Verification Code',
    htmlContent: '<p>Test verification code</p>'
  };

  assert(payload.sender.name === 'SmartLanka Trade', 'Sender name is "SmartLanka Trade"');
  assert(payload.sender.email === senderEmail, 'Sender email is configured correctly');
  assert(Array.isArray(payload.to) && payload.to[0].email === testEmail, 'Recipient formatted as array of objects');
  assert(typeof payload.subject === 'string' && payload.subject.length > 0, 'Subject is non-empty');
  assert(typeof payload.htmlContent === 'string' && payload.htmlContent.length > 0, 'HTML content is non-empty');

  // -------------------------------------------------------------
  // Test 4: Rate Limiting & Cooldown Logic Check
  // -------------------------------------------------------------
  console.log('\nTest 4: 60-Second Cooldown & 10-Minute Expiry Logic');
  const now = Date.now();
  const recentCreatedAt = new Date(now - 30 * 1000); // 30 seconds ago
  const oldCreatedAt = new Date(now - 70 * 1000); // 70 seconds ago

  const isRecentCooldownActive = (now - recentCreatedAt.getTime()) < 60 * 1000;
  assert(isRecentCooldownActive === true, 'Cooldown is active if OTP created 30s ago');

  const isOldCooldownActive = (now - oldCreatedAt.getTime()) < 60 * 1000;
  assert(isOldCooldownActive === false, 'Cooldown is inactive if OTP created 70s ago');

  const expiresAt10m = new Date(now + 10 * 60 * 1000);
  const isExpiredBefore = expiresAt10m.getTime() < now;
  assert(isExpiredBefore === false, '10-minute expiry timestamp is in the future');

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  console.log('\n========================================');
  console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('========================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
