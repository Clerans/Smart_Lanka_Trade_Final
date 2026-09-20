/**
 * Script to verify the OTP code received in email for clerans14@gmail.com
 * Usage: node verify-real-otp.js <6-digit-code>
 */
require('dotenv').config();
const connectDB = require('./config/db');
const authService = require('./services/authService');
const otpModel = require('./models/otpModel');

async function verifyReceivedOtp() {
  const targetEmail = 'clerans14@gmail.com';
  const inputOtp = process.argv[2];

  console.log(`========================================================`);
  console.log(`🔐 Verifying Real OTP for: ${targetEmail}`);
  console.log(`========================================================\n`);

  if (!inputOtp) {
    console.error('❌ Please supply the 6-digit OTP code received in your email.');
    console.log('👉 Example usage: node verify-real-otp.js 123456');
    process.exit(1);
  }

  try {
    await connectDB();
    console.log(`🔍 Attempting verification with code: "${inputOtp}"...`);
    const result = await authService.verifyOtp(targetEmail, inputOtp);
    console.log('\n✅ VERIFICATION SUCCESSFUL!');
    console.log(`  - Message: ${result.message}`);

    const remainingRecord = await otpModel.findOtpByEmail(targetEmail);
    console.log(`  - Active OTP in DB: ${remainingRecord ? 'Still exists (error)' : 'Deleted (purged cleanly)'}`);
  } catch (err) {
    console.error(`\n❌ VERIFICATION FAILED: ${err.message}`);
  } finally {
    const { closePool } = require('./config/db');
    await closePool();
    process.exit(0);
  }
}

verifyReceivedOtp();
