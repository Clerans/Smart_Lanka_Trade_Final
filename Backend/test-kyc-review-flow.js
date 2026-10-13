process.env.NODE_ENV = 'test';

const axios = require('axios');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const http = require('http');
const connectDB = require('./config/db');
const userModel = require('./models/userModel');
const kycModel = require('./models/kycModel');
const oracledb = require('oracledb');
require('dotenv').config({ quiet: true });

const app = require('./server');

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${testName} ${details ? '(' + details + ')' : ''}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${testName} ${details ? '(' + details + ')' : ''}`);
    failedTests++;
  }
}

async function runReviewFlowTests() {
  console.log('================================================================');
  console.log('🧪 TESTING SMARTLANKA TRADE — KYC EXTRACTION, REVIEW & CONFIRM FLOW');
  console.log('================================================================\n');

  await connectDB();

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const BASE = `http://localhost:${port}/api`;

  // 1. Setup Test Users
  let testUser = await userModel.findByEmail('kyc_review_user@smartlanka.com');
  let testUserId;
  if (!testUser) {
    testUserId = await userModel.createUser('KASUN CHAMARA PERERA', 'kyc_review_user@smartlanka.com', 'Pass123!@#', 'tok_rev');
  } else {
    testUserId = testUser.ID;
  }

  let otherUser = await userModel.findByEmail('other_kyc_user@smartlanka.com');
  let otherUserId;
  if (!otherUser) {
    otherUserId = await userModel.createUser('OTHER USER', 'other_kyc_user@smartlanka.com', 'Pass123!@#', 'tok_other');
  } else {
    otherUserId = otherUser.ID;
  }

  const token = jwt.sign(
    { id: testUserId, email: 'kyc_review_user@smartlanka.com', role: 'USER' },
    process.env.JWT_SECRET || 'smartlanka_super_secret_key_2024',
    { expiresIn: '1d' }
  );

  const otherToken = jwt.sign(
    { id: otherUserId, email: 'other_kyc_user@smartlanka.com', role: 'USER' },
    process.env.JWT_SECRET || 'smartlanka_super_secret_key_2024',
    { expiresIn: '1d' }
  );

  const authHeader = { Authorization: `Bearer ${token}` };
  const otherAuthHeader = { Authorization: `Bearer ${otherToken}` };

  // Sample image
  const testImagePath = path.join(__dirname, 'test_review_sample.png');
  const validPngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
  fs.writeFileSync(testImagePath, validPngBuffer);

  try {
    // -------------------------------------------------------------
    // Test 1: Direct extraction via mock service / DB insert verification
    // -------------------------------------------------------------
    console.log('--- Step 1: Document Upload & OCR Extraction (Stage B) ---');

    // Create a mock extraction directly in DB to test confirmation logic without full Tesseract overhead
    const docId = await kycModel.createKYCDocument({
      userId: testUserId,
      documentType: 'NIC',
      documentNumber: '921450239V',
      extractedName: 'KASUN C PERERA',
      extractedDob: '1992-05-24',
      extractedGender: 'MALE',
      ocrText: 'SRI LANKA IDENTITY CARD\n921450239V\nKASUN C PERERA',
      ocrConfidence: 88,
      verificationStatus: 'EXTRACTED',
      documentPath: testImagePath,
      rawOcrJson: {
        extractedFields: {
          documentNumber: '921450239V',
          fullName: 'KASUN C PERERA',
          dob: '1992-05-24',
          gender: 'MALE'
        },
        fieldSources: {
          documentNumber: 'front',
          fullName: 'front'
        }
      }
    });

    assert(typeof docId === 'number' && docId > 0, 'Created initial document record with status EXTRACTED', `docId: ${docId}`);

    const docBeforeConfirm = await kycModel.getKYCById(docId);
    assert(docBeforeConfirm.VERIFICATION_STATUS === 'EXTRACTED', 'Document status is EXTRACTED before user confirmation');

    // Verify user profile KYC status is NOT automatically verified
    const userProfileBefore = await userModel.findById(testUserId);
    assert(userProfileBefore.KYC_STATUS !== 'VERIFIED', 'User KYC status is not automatically VERIFIED upon extraction', `status: ${userProfileBefore.KYC_STATUS}`);

    // -------------------------------------------------------------
    // Test 2: Validation of missing required fields on confirmation
    // -------------------------------------------------------------
    console.log('\n--- Step 2: Confirmation Validation Rules (Stage D & E) ---');

    try {
      await axios.post(`${BASE}/kyc/confirm`, {
        documentId: docId,
        documentType: 'NIC',
        confirmedData: {
          documentNumber: '', // missing
          fullName: 'Kasun Chamara Perera'
        }
      }, { headers: authHeader });
      assert(false, 'Should reject empty document number');
    } catch (err) {
      assert(err.response?.status === 400, 'Rejects confirmation with missing document number (400 Bad Request)');
    }

    try {
      await axios.post(`${BASE}/kyc/confirm`, {
        documentId: docId,
        documentType: 'NIC',
        confirmedData: {
          documentNumber: '921450239V',
          fullName: '' // missing name
        }
      }, { headers: authHeader });
      assert(false, 'Should reject empty full name');
    } catch (err) {
      assert(err.response?.status === 400, 'Rejects confirmation with missing full name (400 Bad Request)');
    }

    try {
      await axios.post(`${BASE}/kyc/confirm`, {
        documentId: docId,
        documentType: 'NIC',
        confirmedData: {
          documentNumber: '12345INVALID',
          fullName: 'Kasun Chamara Perera'
        }
      }, { headers: authHeader });
      assert(false, 'Should reject invalid NIC format');
    } catch (err) {
      assert(err.response?.status === 400, 'Rejects invalid Sri Lankan NIC format (400 Bad Request)');
    }

    // -------------------------------------------------------------
    // Test 3: Unauthorized user confirming another user's session
    // -------------------------------------------------------------
    console.log('\n--- Step 3: Security & Session Isolation (Section 5) ---');

    try {
      await axios.post(`${BASE}/kyc/confirm`, {
        documentId: docId,
        documentType: 'NIC',
        confirmedData: {
          documentNumber: '921450239V',
          fullName: 'Kasun Chamara Perera'
        }
      }, { headers: otherAuthHeader }); // Other user attempting to confirm!
      assert(false, 'Should reject session owned by another user');
    } catch (err) {
      assert(err.response?.status === 403, 'Rejects cross-user document confirmation with 403 Forbidden');
    }

    // -------------------------------------------------------------
    // Test 4: Successful User Confirmation & Authoritative Backend Verification
    // -------------------------------------------------------------
    console.log('\n--- Step 4: Successful Confirmation & Authoritative Verification (Stage F) ---');

    const confirmRes = await axios.post(`${BASE}/kyc/confirm`, {
      documentId: docId,
      documentType: 'NIC',
      confirmedData: {
        documentNumber: '921450239V',
        fullName: 'Kasun Chamara Perera', // User corrected full name
        dob: '1992-05-24',
        gender: 'MALE',
        address: '45 Temple Road, Kandy'
      }
    }, { headers: authHeader });

    assert(confirmRes.status === 200, 'Confirmation returns 200 OK');
    assert(confirmRes.data.success === true, 'Response reports success: true');
    assert(confirmRes.data.data?.verificationStatus === 'VERIFIED', 'Authoritative decision is VERIFIED for matching user', `Status: ${confirmRes.data.data?.verificationStatus}`);
    assert(confirmRes.data.data?.confirmedData?.fullName === 'Kasun Chamara Perera', 'Confirmed full name persisted');
    assert(confirmRes.data.data?.confirmedData?.address === '45 Temple Road, Kandy', 'Confirmed address persisted');

    // -------------------------------------------------------------
    // Test 5: Verify Data Separation in DB (Raw vs Confirmed)
    // -------------------------------------------------------------
    console.log('\n--- Step 5: Data Separation Verification (Section 4) ---');

    const docAfterConfirm = await kycModel.getKYCById(docId);
    assert(docAfterConfirm.CONFIRMED_NAME === 'Kasun Chamara Perera', 'Confirmed name stored separately', `got: ${docAfterConfirm.CONFIRMED_NAME}`);
    assert(docAfterConfirm.EXTRACTED_NAME === 'KASUN C PERERA', 'Original extracted name preserved intact without overwrite', `got: ${docAfterConfirm.EXTRACTED_NAME}`);
    assert(docAfterConfirm.VERIFICATION_STATUS === 'VERIFIED', 'Database status is updated to VERIFIED');

    const userProfileAfter = await userModel.findById(testUserId);
    assert(userProfileAfter.KYC_STATUS === 'VERIFIED', 'User profile on SL_USERS table updated to VERIFIED');
    assert(userProfileAfter.NIC_NUMBER === '921450239V', 'User profile NIC_NUMBER updated');

    // -------------------------------------------------------------
    // Test 6: Status API reflects confirmed data
    // -------------------------------------------------------------
    console.log('\n--- Step 6: GET /api/kyc/status with Confirmed Data ---');

    const statusRes = await axios.get(`${BASE}/kyc/status`, { headers: authHeader });
    assert(statusRes.status === 200, 'Status API returns 200 OK');
    assert(statusRes.data.data?.status === 'VERIFIED', 'Status API reports VERIFIED');
    assert(statusRes.data.data?.document?.confirmedName === 'Kasun Chamara Perera', 'Status API returns confirmedName');

    // -------------------------------------------------------------
    // Test 7: Driving Licence Confirmation Flow
    // -------------------------------------------------------------
    console.log('\n--- Step 7: Sri Lankan Driving Licence Flow ---');

    const dlDocId = await kycModel.createKYCDocument({
      userId: testUserId,
      documentType: 'DRIVING_LICENCE',
      documentNumber: 'B1234567',
      extractedName: 'KASUN PERERA',
      extractedDob: '1992-05-24',
      extractedGender: 'MALE',
      ocrText: 'DRIVING LICENCE\nB1234567\nKASUN PERERA\n4d. 921450239V',
      ocrConfidence: 90,
      verificationStatus: 'EXTRACTED',
      documentPath: testImagePath
    });

    const dlConfirmRes = await axios.post(`${BASE}/kyc/confirm`, {
      documentId: dlDocId,
      documentType: 'DRIVING_LICENCE',
      confirmedData: {
        documentNumber: 'B1234567',
        fullName: 'Kasun Chamara Perera',
        nicNumber: '921450239V',
        dob: '1992-05-24',
        licenceCategory: 'A, B1, B',
        issueDate: '2018-05-10',
        expiryDate: '2026-05-10',
        address: '123 Main Street, Colombo'
      }
    }, { headers: authHeader });

    assert(dlConfirmRes.status === 200, 'Driving Licence confirmation returns 200 OK');
    assert(dlConfirmRes.data.data?.verificationStatus === 'VERIFIED', 'Driving licence verified for matching user');
    assert(dlConfirmRes.data.data?.confirmedData?.licenceCategory === 'A, B1, B', 'Licence category confirmed');

    console.log('\n================================================================');
    console.log(`🏁 KYC REVIEW FLOW TEST RESULTS: ${passedTests} Passed, ${failedTests} Failed`);
    console.log('================================================================\n');

  } catch (error) {
    console.error('Fatal test error:', error.response?.data || error.message);
    failedTests++;
  } finally {
    server.close();
    if (fs.existsSync(testImagePath)) {
      try { fs.unlinkSync(testImagePath); } catch (e) {}
    }
    if (failedTests > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

runReviewFlowTests();
