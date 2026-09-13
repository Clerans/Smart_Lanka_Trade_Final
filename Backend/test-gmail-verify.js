const { verifyEmailService, sendVerificationOTPEmail } = require('./services/emailService');
require('dotenv').config();

async function runSafeVerification() {
  console.log('====================================================');
  console.log('🛡️ SMARTLANKA TRADE — GMAIL SMTP VERIFICATION TEST');
  console.log('====================================================\n');

  console.log('1. Testing Gmail SMTP Transporter Verification:');
  const isHealthy = await verifyEmailService();

  if (!isHealthy) {
    console.error('\n❌ Gmail SMTP connection failed');
    process.exit(1);
  }

  console.log('\n✅ Gmail SMTP configuration detected');
  console.log('✅ Gmail SMTP connection successful');

  const testRecipient = process.env.SMTP_USER;
  if (testRecipient) {
    console.log('\n2. Testing Single OTP Email Delivery:');
    try {
      const info = await sendVerificationOTPEmail(testRecipient, '789123');
      console.log('✅ Test email sent successfully (Message ID received)');
    } catch (err) {
      console.error('❌ Failed to deliver test OTP email:', err.message);
      process.exit(1);
    }
  }

  console.log('\n====================================================');
  console.log('🎉 GMAIL SMTP OTP MIGRATION: PASS');
  console.log('====================================================\n');
}

runSafeVerification().then(() => process.exit(0)).catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
