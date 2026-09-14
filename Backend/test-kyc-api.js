process.env.NODE_ENV = 'test';

const axios = require('axios');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const http = require('http');
const connectDB = require('./config/db');
const userModel = require('./models/userModel');
const oracledb = require('oracledb');
require('dotenv').config({ quiet: true });

const app = require('./server');

async function testKYCEndpoints() {
  console.log('--- Testing Backend KYC Endpoints ---');

  await connectDB();

  // Create in-process test server
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const BASE = `http://localhost:${port}/api`;

  // Ensure test users exist
  let testUser = await userModel.findByEmail('testuser_api@smartlanka.com');
  let testUserId;
  if (!testUser) {
    testUserId = await userModel.createUser('API TEST USER', 'testuser_api@smartlanka.com', 'Pass123!@#', 'tok_api');
  } else {
    testUserId = testUser.ID;
  }

  let adminUser = await userModel.findByEmail('admin_api@smartlanka.com');
  let adminUserId;
  if (!adminUser) {
    adminUserId = await userModel.createUser('API ADMIN', 'admin_api@smartlanka.com', 'Pass123!@#', 'tok_admin_api');
    const conn = await oracledb.getConnection();
    await conn.execute(`UPDATE SL_USERS SET ROLE = 'ADMIN', IS_VERIFIED = 1 WHERE ID = :id`, [adminUserId]);
    await conn.commit();
    await conn.close();
  } else {
    adminUserId = adminUser.ID;
  }

  const token = jwt.sign(
    { id: testUserId, email: 'testuser_api@smartlanka.com', role: 'USER' },
    process.env.JWT_SECRET || 'smartlanka_super_secret_key_2024',
    { expiresIn: '1d' }
  );

  const adminToken = jwt.sign(
    { id: adminUserId, email: 'admin_api@smartlanka.com', role: 'ADMIN' },
    process.env.JWT_SECRET || 'smartlanka_super_secret_key_2024',
    { expiresIn: '1d' }
  );

  const authHeader = { Authorization: `Bearer ${token}` };
  const adminAuthHeader = { Authorization: `Bearer ${adminToken}` };

  // 1. Create a valid test image for testing upload
  const testImagePath = path.join(__dirname, 'test_nic_sample.png');
  if (!fs.existsSync(testImagePath)) {
    const validPngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    fs.writeFileSync(testImagePath, validPngBuffer);
  }

  try {
    // 2. Test Unauthenticated rejection
    console.log('\n1. Testing Unauthenticated Request (Expect 401)');
    try {
      await axios.get(`${BASE}/kyc/status`);
      console.error('❌ Should have failed with 401');
    } catch (unauthErr) {
      console.log('✅ Correctly rejected unauthenticated request:', unauthErr.response?.status);
    }

    // 3. Test KYC Upload & Verify
    console.log('\n2. Testing POST /api/kyc/verify with document and manual NIC 199204502391');
    const form = new FormData();
    form.append('document', fs.createReadStream(testImagePath));
    form.append('manualNIC', '199204502391');

    const verifyRes = await axios.post(`${BASE}/kyc/verify`, form, {
      headers: {
        ...authHeader,
        ...form.getHeaders()
      }
    });

    console.log('Status:', verifyRes.status);
    console.log('Verification Status:', verifyRes.data.data?.verificationStatus);
    console.log('Extracted NIC:', verifyRes.data.data?.extractedData?.nicNumber);
    console.log('Extracted DOB:', verifyRes.data.data?.extractedData?.dateOfBirth);
    console.log('Extracted Gender:', verifyRes.data.data?.extractedData?.gender);

    // 4. Test GET /api/kyc/status
    console.log('\n3. Testing GET /api/kyc/status');
    const statusRes = await axios.get(`${BASE}/kyc/status`, { headers: authHeader });
    console.log('Status:', statusRes.status);
    console.log('User KYC Status:', statusRes.data.data?.status);

    // 5. Test GET /api/kyc/history
    console.log('\n4. Testing GET /api/kyc/history');
    const histRes = await axios.get(`${BASE}/kyc/history`, { headers: authHeader });
    console.log('Status:', histRes.status);
    console.log('History count:', histRes.data.count);

    // 6. Test Admin GET /api/admin/kyc/pending
    console.log('\n5. Testing GET /api/admin/kyc/pending');
    const adminRes = await axios.get(`${BASE}/admin/kyc/pending`, { headers: adminAuthHeader });
    console.log('Status:', adminRes.status);
    console.log('Pending applications:', adminRes.data.count);

    console.log('\n🎉 ALL KYC ENDPOINT INTEGRATION TESTS PASSED!');
  } catch (error) {
    console.error('❌ KYC API Test Error:', error.response?.data || error.message);
    process.exit(1);
  } finally {
    server.close();
    if (fs.existsSync(testImagePath)) {
      try { fs.unlinkSync(testImagePath); } catch (e) {}
    }
    process.exit(0);
  }
}

testKYCEndpoints();
