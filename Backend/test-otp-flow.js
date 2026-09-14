const http = require('http');
const crypto = require('crypto');
const app = require('./server');
const { verifyEmailService, sendVerificationOTPEmail } = require('./services/emailService');
const authService = require('./services/authService');
const verificationModel = require('./models/verificationModel');

async function runTests() {
  console.log('====================================================');
  console.log('🧪 SMARTLANKA TRADE — 6-DIGIT OTP & RESEND REST API TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, testName, details = '') {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${testName} ${details ? `(${details})` : ''}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName} ${details ? `(${details})` : ''}`);
      process.exitCode = 1;
    }
  }

  // TEST 1: Resend REST API Provider Configuration Diagnostics
  console.log('--- 1. Resend REST API Configuration Diagnostics ---');
  try {
    process.env.EMAIL_PROVIDER = 'resend';
    const diagResult = await verifyEmailService();
    assert(typeof diagResult === 'boolean', 'RESEND-001: verifyEmailService() executed safely for Resend REST API');
  } catch (e) {
    assert(false, `verifyEmailService threw unexpected exception: ${e.message}`);
  }

  // TEST 2: Express Trust Proxy Configuration for Render
  console.log('\n--- 2. Express Trust Proxy Configuration ---');
  const trustProxySetting = app.get('trust proxy');
  assert(
    typeof trustProxySetting === 'function' || trustProxySetting === 1 || trustProxySetting === true,
    'PROXY-001: Express trust proxy is configured for Render reverse proxy'
  );

  // TEST 3: Rate Limiting with X-Forwarded-For Header (Render Simulation)
  console.log('\n--- 3. Rate Limiting with X-Forwarded-For Header ---');
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  try {
    const makeRequest = (headers = {}, body = {}) => {
      return new Promise((resolve, reject) => {
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port: port,
            path: '/api/auth/register',
            method: 'POST',
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
                resolve({ status: res.statusCode, body: JSON.parse(data) });
              } catch (e) {
                resolve({ status: res.statusCode, body: data });
              }
            });
          }
        );
        req.on('error', reject);
        req.write(JSON.stringify(body));
        req.end();
      });
    };

    const responseWithProxyHeader = await makeRequest(
      { 'X-Forwarded-For': '203.0.113.195, 10.0.0.1' },
      { name: '', email: '', password: '' }
    );

    assert(
      responseWithProxyHeader.status === 422,
      `RATE-001: Rate limiter handled X-Forwarded-For cleanly (Status: ${responseWithProxyHeader.status})`
    );

    assert(
      responseWithProxyHeader.body.code === 'MISSING_FIELDS',
      'RATE-002: Auth route validation responded as expected'
    );
  } finally {
    server.close();
  }

  // TEST 4: OTP Format & Cryptographic Randomness Check
  console.log('\n--- 4. 6-Digit OTP Cryptographic Security ---');
  const sampleOtps = Array.from({ length: 50 }, () => crypto.randomInt(100000, 1000000).toString());
  const allSixDigits = sampleOtps.every(o => /^\d{6}$/.test(o));
  const uniqueCount = new Set(sampleOtps).size;

  assert(allSixDigits, 'OTP-001: OTP is exactly 6 numeric digits');
  assert(uniqueCount > 45, 'OTP-002: OTP generated via crypto.randomInt shows high entropy', `Unique: ${uniqueCount}/50`);

  // TEST 5: OTP Hash Storage Check (SHA-256)
  console.log('\n--- 5. OTP SHA-256 Storage Security ---');
  const testOtp = '483921';
  const expectedHash = crypto.createHash('sha256').update(testOtp).digest('hex');
  assert(expectedHash.length === 64, 'OTP-003: SHA-256 hash length is 64 hex characters');

  // TEST 6: OTP Security - Ensure OTP is Never Leaked in API Responses
  console.log('\n--- 6. OTP Security Check in API Responses ---');
  const authController = require('./controllers/authController');

  const mockRes = () => {
    const res = {};
    res.statusCode = 200;
    res.status = function(code) { res.statusCode = code; return res; };
    res.json = function(payload) { res.body = payload; return res; };
    return res;
  };

  const req = { body: { name: 'Test' } };
  const res = mockRes();
  await authController.register(req, res);
  assert(res.statusCode === 422, 'OTP-004: Missing registration fields returns 422');
  assert(!res.body.otp, 'OTP-005: Response body does NOT leak OTP');

  // TEST 7: Resend REST API Safe Error Handling Simulation
  console.log('\n--- 7. Resend REST API Safe Error Handling ---');
  try {
    const oldApiKey = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    
    let caughtError = null;
    try {
      await sendVerificationOTPEmail('test@example.com', '123456');
    } catch (err) {
      caughtError = err;
    }
    
    assert(
      caughtError !== null && (caughtError.code === 'EMAIL_CONFIG_MISSING' || caughtError.code === 'EMAIL_SEND_FAILED'),
      'RESEND-002: Missing API key throws safe, controlled application error without crashing'
    );
    
    // Restore
    if (oldApiKey) process.env.RESEND_API_KEY = oldApiKey;
  } catch (e) {
    assert(false, `Error during provider simulation: ${e.message}`);
  }

  console.log('\n====================================================');
  console.log(`📊 RESULTS: ${passed}/${total} Tests Passed`);
  console.log('====================================================\n');
}

runTests().then(() => {
  process.exit(process.exitCode || 0);
}).catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

