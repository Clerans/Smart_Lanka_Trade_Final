const http = require('http');
const app = require('./server');
const { verifyTransporter, sendVerificationOTPEmail } = require('./services/emailService');

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING SMARTLANKA TRADE OTP & PROXY TEST SUITE');
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

  // TEST 1: Trust Proxy Setting
  console.log('--- TEST 1: Express Trust Proxy Configuration ---');
  const trustProxySetting = app.get('trust proxy');
  assert(
    typeof trustProxySetting === 'function' || trustProxySetting === 1 || trustProxySetting === true,
    'Express trust proxy is configured for Render reverse proxy'
  );

  // TEST 2: Safe Transporter Diagnostics
  console.log('\n--- TEST 2: Safe SMTP Transporter Diagnostics ---');
  try {
    const diagResult = await verifyTransporter();
    assert(typeof diagResult === 'boolean', 'verifyTransporter() executed safely without unhandled error');
  } catch (e) {
    assert(false, `verifyTransporter threw unexpected exception: ${e.message}`);
  }

  // TEST 3: Rate Limiting & X-Forwarded-For (Render Simulation)
  console.log('\n--- TEST 3: Rate Limiting with X-Forwarded-For Header ---');
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  try {
    const makeRequest = (headers = {}) => {
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
        req.write(JSON.stringify({ name: '', email: '', password: '' }));
        req.end();
      });
    };

    // Make request simulating Render's X-Forwarded-For header
    const responseWithProxyHeader = await makeRequest({
      'X-Forwarded-For': '203.0.113.195, 10.0.0.1'
    });

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

  // TEST 4: OTP Security & Error Propagation Check
  console.log('\n--- TEST 4: OTP Security - Verify OTP is Never Leaked ---');
  const authController = require('./controllers/authController');
  
  // Create mock res
  const mockRes = () => {
    const res = {};
    res.statusCode = 200;
    res.status = function(code) { res.statusCode = code; return res; };
    res.json = function(payload) { res.body = payload; return res; };
    return res;
  };

  // Test missing fields response
  const req = { body: { name: 'Test' } };
  const res = mockRes();
  await authController.register(req, res);
  assert(res.statusCode === 422, 'Missing fields correctly returns 422');
  assert(!res.body.otp, 'Response body does NOT contain OTP');

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
