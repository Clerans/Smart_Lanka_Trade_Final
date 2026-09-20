/**
 * Script to dispatch a real OTP email to the user's email address (clerans14@gmail.com)
 * via Brevo Transactional Email HTTP API and store the HMAC-SHA256 hash in Oracle DB.
 */
require('dotenv').config();
const connectDB = require('./config/db');
const authService = require('./services/authService');
const otpModel = require('./models/otpModel');

async function sendTestOtp() {
  const targetEmail = 'clerans14@gmail.com';
  console.log(`========================================================`);
  console.log(`📧 Sending Real OTP Email to: ${targetEmail}`);
  console.log(`========================================================\n`);

  try {
    console.log('🔄 Connecting to Oracle Database...');
    await connectDB();
    console.log('✅ Oracle DB Connected.\n');

    console.log(`🚀 Calling authService.sendOtp("${targetEmail}")...`);
    const result = await authService.sendOtp(targetEmail);
    console.log('\n✅ Result:', result);

    // Inspect stored hash in DB
    const record = await otpModel.findOtpByEmail(targetEmail);
    if (record) {
      console.log('\n📊 [Oracle DB Record]');
      console.log(`  - ID: ${record.ID}`);
      console.log(`  - Email: ${record.EMAIL}`);
      console.log(`  - OTP Hash: ${record.OTP_HASH}`);
      console.log(`  - Expires At: ${record.EXPIRES_AT}`);
      console.log(`  - Created At: ${record.CREATED_AT}`);
    }

    console.log('\n🎉 SUCCESS: OTP has been dispatched to your inbox!');
    console.log('👉 Please check your email inbox (and spam folder) for the 6-digit code from SmartLanka Trade.');

  } catch (err) {
    console.error('\n❌ Error sending OTP:', err.message);
  } finally {
    const { closePool } = require('./config/db');
    await closePool();
    process.exit(0);
  }
}

sendTestOtp();
