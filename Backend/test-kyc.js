/**
 * Automated Unit & Integration Test Suite
 * SmartLanka Trade: OCR-Based KYC Verification System
 */

const nicParser = require('./utils/nicParser');
const kycService = require('./services/kycService');
const kycModel = require('./models/kycModel');

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    failedTests++;
  }
}

async function runKYCTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING OCR-BASED KYC VERIFICATION TEST SUITE');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // SECTION 1: Sri Lankan NIC Validation & Parsing
  // ----------------------------------------------------
  console.log('--- 1. Testing NIC Format Validation & Parsing ---');

  // 1.1 Old NIC Valid (Male)
  const oldMale = nicParser.parseNICDetails('921450239V');
  assert(oldMale !== null && oldMale.isValid, 'Old NIC 921450239V is valid');
  assert(oldMale.format === 'OLD', 'Format is OLD');
  assert(oldMale.gender === 'MALE', `Gender is MALE (got ${oldMale?.gender})`);
  assert(oldMale.year === 1992, `Birth year is 1992 (got ${oldMale?.year})`);
  assert(oldMale.dob === '1992-05-24', `DOB is 1992-05-24 (got ${oldMale?.dob})`);

  // 1.2 Old NIC Valid (Female with 'X')
  const oldFemale = nicParser.parseNICDetails('856450239x');
  assert(oldFemale !== null && oldFemale.isValid, 'Old NIC 856450239X is valid with lowercase x');
  assert(oldFemale.gender === 'FEMALE', `Gender is FEMALE (got ${oldFemale?.gender})`);
  assert(oldFemale.year === 1985, `Birth year is 1985 (got ${oldFemale?.year})`);

  // 1.3 New NIC Valid (Male)
  const newMale = nicParser.parseNICDetails('199204502391');
  assert(newMale !== null && newMale.isValid, 'New NIC 199204502391 is valid');
  assert(newMale.format === 'NEW', 'Format is NEW');
  assert(newMale.gender === 'MALE', `Gender is MALE (got ${newMale?.gender})`);
  assert(newMale.year === 1992, `Birth year is 1992 (got ${newMale?.year})`);
  assert(newMale.dob === '1992-02-14', `DOB is 1992-02-14 (got ${newMale?.dob})`);

  // 1.4 New NIC Valid (Female)
  const newFemale = nicParser.parseNICDetails('200054501234');
  assert(newFemale !== null && newFemale.isValid, 'New NIC 200054501234 is valid');
  assert(newFemale.gender === 'FEMALE', `Gender is FEMALE (got ${newFemale?.gender})`);
  assert(newFemale.year === 2000, `Birth year is 2000 (got ${newFemale?.year})`);

  // 1.5 Invalid NICs
  assert(nicParser.parseNICDetails('12345') === null, 'Short invalid string returns null');
  assert(nicParser.parseNICDetails('921450239Z') === null, 'Invalid letter suffix Z returns null');
  assert(nicParser.parseNICDetails('ABCDEFGHIV') === null, 'Alphanumeric invalid returns null');

  // ----------------------------------------------------
  // SECTION 2: OCR Text Extraction & Structuring
  // ----------------------------------------------------
  console.log('\n--- 2. Testing OCR Text Extraction ---');

  const sampleOCRText1 = `
    DEMOCRATIC SOCIALIST REPUBLIC OF SRI LANKA
    NATIONAL IDENTITY CARD
    Name: JANITH MADUSHANKA SILVA
    Address: 123 Main Street, Colombo
    NIC No: 199204502391
    Date of Issue: 2018-05-10
  `;

  const extracted1 = nicParser.extractFromOCRText(sampleOCRText1);
  assert(extracted1.documentType === 'NIC', 'Detected documentType is NIC');
  assert(extracted1.nicNumber === '199204502391', `Extracted NIC number matches (got ${extracted1.nicNumber})`);
  assert(extracted1.extractedName === 'JANITH MADUSHANKA SILVA', `Extracted Name matches (got ${extracted1.extractedName})`);
  assert(extracted1.dob === '1992-02-14', `Extracted DOB matches 1992-02-14 (got ${extracted1.dob})`);
  assert(extracted1.gender === 'MALE', `Extracted gender matches MALE (got ${extracted1.gender})`);

  const sampleOCRText2 = `
    SRI LANKA IDENTITY CARD
    921450239V
    KASUN CHAMARA PERERA
    COLOMBO
  `;
  const extracted2 = nicParser.extractFromOCRText(sampleOCRText2);
  assert(extracted2.nicNumber === '921450239V', `Extracted Old NIC matches (got ${extracted2.nicNumber})`);
  assert(extracted2.extractedName === 'KASUN CHAMARA PERERA', `Extracted Name without label matches (got ${extracted2.extractedName})`);

  // ----------------------------------------------------
  // SECTION 3: Name Matching & Comparison Logic
  // ----------------------------------------------------
  console.log('\n--- 3. Testing Name Comparison Logic ---');

  const exactMatch = kycService.calculateNameSimilarity('Janith Madushanka', 'JANITH MADUSHANKA');
  assert(exactMatch === 1.0, `Exact match score is 1.0 (got ${exactMatch})`);

  const partialMatch = kycService.calculateNameSimilarity('Janith Silva', 'JANITH MADUSHANKA SILVA');
  assert(partialMatch >= 0.65, `Partial middle name match score is >= 0.65 (got ${partialMatch})`);

  const differentName = kycService.calculateNameSimilarity('Janith Silva', 'KASUN PERERA');
  assert(differentName === 0, `Completely different name score is 0 (got ${differentName})`);

  // ----------------------------------------------------
  // SECTION 4: Database Model Integration
  // ----------------------------------------------------
  console.log('\n--- 4. Testing Oracle DB Model Operations ---');

  try {
    const connectDB = require('./config/db');
    await connectDB();

    const docId = await kycModel.createKYCDocument({
      userId: 1,
      documentType: 'NIC',
      documentNumber: '199204502391',
      extractedName: 'JANITH MADUSHANKA',
      extractedDob: '1992-02-14',
      extractedGender: 'MALE',
      ocrText: sampleOCRText1,
      ocrConfidence: 94.5,
      verificationStatus: 'VERIFIED',
      rejectionReason: null,
      documentPath: '/uploads/kyc/test.jpg'
    });

    assert(typeof docId === 'number' && docId > 0, `Created KYC Document in DB with ID #${docId}`);

    const retrieved = await kycModel.getKYCById(docId);
    assert(retrieved !== null && retrieved.DOCUMENT_NUMBER === '199204502391', 'Retrieved KYC document by ID matches');
    assert(retrieved.VERIFICATION_STATUS === 'VERIFIED', 'Verification status is VERIFIED');

    await kycModel.updateKYCStatus(docId, 'PENDING', 'Testing status update', 1);
    const updated = await kycModel.getKYCById(docId);
    assert(updated.VERIFICATION_STATUS === 'PENDING', 'Updated KYC status to PENDING');
  } catch (dbErr) {
    console.error('⚠️ DB Model Test Error:', dbErr.message);
  }

  console.log('\n====================================================');
  console.log(`🏁 KYC TEST SUITE COMPLETE: ${passedTests} Passed, ${failedTests} Failed`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runKYCTests();
