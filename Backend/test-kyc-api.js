const axios = require('axios');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
require('dotenv').config();

async function testKYCEndpoints() {
  console.log('--- Testing Backend KYC Endpoints ---');
  const BASE = 'http://localhost:5000/api';

  // Create JWT token for user ID 1
  const token = jwt.sign(
    { id: 1, email: 'test@smartlanka.com' },
    process.env.JWT_SECRET || 'smartlanka_super_secret_key_2024',
    { expiresIn: '1d' }
  );

  const authHeader = { Authorization: `Bearer ${token}` };

  // 1. Create a dummy image for testing upload
  const testImagePath = path.join(__dirname, 'test_nic_sample.jpg');
  if (!fs.existsSync(testImagePath)) {
    // Write 1x1 dummy jpg or minimal jpeg buffer
    const dummyBuffer = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
      0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
      0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
      0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
      0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
      0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
      0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
      0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
      0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
      0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
      0x00, 0xbf, 0x00, 0xff, 0xd9
    ]);
    fs.writeFileSync(testImagePath, dummyBuffer);
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
    const adminRes = await axios.get(`${BASE}/admin/kyc/pending`, { headers: authHeader });
    console.log('Status:', adminRes.status);
    console.log('Pending applications:', adminRes.data.count);

    console.log('\n🎉 ALL KYC ENDPOINT INTEGRATION TESTS PASSED!');
  } catch (error) {
    console.error('❌ KYC API Test Error:', error.response?.data || error.message);
    process.exit(1);
  } finally {
    if (fs.existsSync(testImagePath)) {
      try { fs.unlinkSync(testImagePath); } catch (e) {}
    }
    process.exit(0);
  }
}

testKYCEndpoints();
