const http = require('http');
const app = require('./server');
const { verifyEmailService, sendVerificationOTPEmail } = require('./services/emailService');

async function runTests() {
  console.log('====================================================');
  console.log('🧪 SMARTLANKA TRADE SMTP (BREVO/NODEMAILER) TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, testName) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      process.exitCode = 1;
    }
  }

  // TEST 1: Provider Configuration Diagnostics with EMAIL_PROVIDER=smtp
  console.log('--- TEST 1: Email Provider Configuration Diagnostics ---');
  try {
    process.env.EMAIL_PROVIDER = 'smtp';
    const diagResult = await verifyEmailService();
    assert(typeof diagResult === 'boolean', 'verifyEmailService() executed safely for SMTP');
  } catch (e) {
    assert(false, `verifyEmailService threw unexpected exception: ${e.message}`);
  }

  // TEST 2: Express Trust Proxy Configuration
  console.log('\n--- TEST 2: Express Trust Proxy Configuration ---');
  const trustProxySetting = app.get('trust proxy');
  assert(
    typeof trustProxySetting === 'function' || trustProxySetting === 1 || trustProxySetting === true,
    'Express trust proxy is configured for Render single-hop reverse proxy'
  );

  // TEST 3: Rate Limiting with X-Forwarded-For Header (Render Simulation)
  console.log('\n--- TEST 3: Rate Limiting with X-Forwarded-For Header ---');
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
      `Rate limiter handled X-Forwarded-For cleanly without ERR_ERL_UNEXPECTED_X_FORWARDED_FOR (Status: ${responseWithProxyHeader.status})`
    );

    assert(
      responseWithProxyHeader.body.code === 'MISSING_FIELDS',
      'Auth route validation responded as expected'
    );
  } finally {
    server.close();
  }

  // TEST 4: OTP Security - Ensure OTP is Never Leaked in API Responses
  console.log('\n--- TEST 4: OTP Security Check ---');
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
  assert(res.statusCode === 422, 'Missing fields correctly returns 422');
  assert(!res.body.otp, 'Response body does NOT contain OTP');

  // TEST 5: SMTP Provider Error Handling Simulation
  console.log('\n--- TEST 5: SMTP Provider Error Handling Simulation ---');
  try {
    const oldUser = process.env.SMTP_USER;
    const oldBrevoUser = process.env.BREVO_SMTP_USER;
    delete process.env.SMTP_USER;
    delete process.env.BREVO_SMTP_USER;
    
    let caughtError = null;
    try {
      await sendVerificationOTPEmail('test@example.com', '123456');
    } catch (err) {
      caughtError = err;
    }
    
    assert(
      caughtError !== null,
      'Missing SMTP credentials throws a safe, controlled error without crashing'
    );
    
    // Restore
    if (oldUser) process.env.SMTP_USER = oldUser;
    if (oldBrevoUser) process.env.BREVO_SMTP_USER = oldBrevoUser;
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
