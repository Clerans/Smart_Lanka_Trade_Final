require('dotenv').config({ quiet: true });

/**
 * Get configured Brevo sender details
 */
const getSender = () => {
  return {
    name: 'SmartLanka Trade',
    email: process.env.BREVO_SENDER || 'no-reply@smartlankatrade.com'
  };
};

/**
 * Diagnostic check on startup to verify Brevo configuration
 */
const verifyEmailService = async () => {
  console.log('🔍 [Email Service Diagnostics]');
  console.log('- Provider: Brevo Transactional Email HTTP API (Native Fetch)');

  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER;

  const hasApiKey = !!apiKey && apiKey.length > 5;
  const hasSender = !!senderEmail;

  console.log(`- Brevo API key configured: ${hasApiKey ? 'yes' : 'no'}`);
  console.log(`- Brevo Sender configured: ${hasSender ? `yes (${senderEmail})` : 'no'}`);

  if (!hasApiKey) {
    console.warn('⚠️ BREVO_API_KEY is missing in environment variables.');
    return false;
  }
  if (!hasSender) {
    console.warn('⚠️ BREVO_SENDER is missing in environment variables.');
    return false;
  }

  return true;
};

/**
 * Core email dispatch using Node.js built-in fetch calling Brevo API v3
 * Never logs the API key or OTP values in plaintext
 */
const dispatchBrevoEmail = async ({ to, subject, htmlContent, logLabel = 'Email' }) => {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    const configErr = new Error('BREVO_API_KEY environment variable is not configured.');
    configErr.code = 'EMAIL_CONFIG_MISSING';
    configErr.status = 503;
    throw configErr;
  }

  const sender = getSender();
  const recipients = Array.isArray(to) ? to.map(e => ({ email: e })) : [{ email: to }];

  const payload = {
    sender,
    to: recipients,
    subject,
    htmlContent
  };

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      // Log the HTTP status code and response body, NEVER logging the API key or OTP
      console.error(`❌ [Brevo API Error] ${logLabel} failed with HTTP status ${response.status}:`, errorBody);
      
      const dispatchErr = new Error(`Email delivery failed via Brevo API (HTTP ${response.status})`);
      dispatchErr.code = 'EMAIL_SEND_FAILED';
      dispatchErr.status = 503;
      dispatchErr.brevoStatus = response.status;
      throw dispatchErr;
    }

    const data = await response.json();
    console.log(`✅ [Brevo API] ${logLabel} delivered successfully to ${recipients.map(r => r.email).join(', ')} (Message ID: ${data?.messageId || 'sent'})`);
    return { success: true, messageId: data?.messageId || 'sent' };
  } catch (error) {
    if (error.code === 'EMAIL_CONFIG_MISSING' || error.code === 'EMAIL_SEND_FAILED') {
      throw error;
    }
    console.error(`❌ [Brevo Exception] ${logLabel} network or parse exception:`, error.message);
    const genericErr = new Error('Email delivery could not be completed at this time.');
    genericErr.code = 'EMAIL_SEND_FAILED';
    genericErr.status = 503;
    throw genericErr;
  }
};

/**
 * 1. Send OTP for Email Verification (Registration & Verification Flow)
 */
const sendVerificationOTPEmail = async (email, otp) => {
  const htmlContent = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1a202c;">
      <div style="text-align: center; margin-bottom: 25px;">
        <h1 style="color: #00C853; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">SmartLanka Trade</h1>
        <p style="color: #718096; font-size: 14px; margin-top: 6px;">Institutional-Grade Crypto & Financial Asset Platform</p>
      </div>
      <div style="background: #f7fafc; border-radius: 10px; padding: 24px; text-align: center; margin-bottom: 25px; border: 1px solid #edf2f7;">
        <p style="font-size: 15px; color: #4a5568; margin: 0 0 16px 0;">Use the 6-digit verification code below to complete your registration:</p>
        <div style="font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #00C853; padding: 14px 28px; background: #e8f5e9; border: 1px solid #c8e6c9; border-radius: 8px; display: inline-block; font-family: monospace;">
          ${otp}
        </div>
        <p style="font-size: 13px; color: #718096; margin-top: 16px;">⏱️ This code is valid for <strong>10 minutes</strong>.</p>
      </div>
      <p style="font-size: 13px; color: #718096; line-height: 1.6;">If you did not request this verification code, you can safely disregard this email or contact our security center.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
      <p style="font-size: 12px; color: #a0aec0; text-align: center;">&copy; ${new Date().getFullYear()} SmartLanka Trade. All rights reserved.</p>
    </div>
  `;

  return await dispatchBrevoEmail({
    to: email,
    subject: 'SmartLanka Trade - Email Verification Code',
    htmlContent,
    logLabel: 'Verification OTP Email'
  });
};

/**
 * 2. Send OTP for Password Reset
 */
const sendPasswordResetOTPEmail = async (email, otp) => {
  const htmlContent = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1a202c;">
      <div style="text-align: center; margin-bottom: 25px;">
        <h1 style="color: #00C853; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">SmartLanka Trade</h1>
        <p style="color: #718096; font-size: 14px; margin-top: 6px;">Security & Account Recovery</p>
      </div>
      <div style="background: #fff5f5; border-radius: 10px; padding: 24px; text-align: center; margin-bottom: 25px; border: 1px solid #fed7d7;">
        <p style="font-size: 15px; color: #742a2a; margin: 0 0 16px 0;">You requested to reset your password. Use the code below:</p>
        <div style="font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #e53e3e; padding: 14px 28px; background: #ffe3e3; border: 1px solid #feb2b2; border-radius: 8px; display: inline-block; font-family: monospace;">
          ${otp}
        </div>
        <p style="font-size: 13px; color: #718096; margin-top: 16px;">⏱️ This recovery code expires in <strong>10 minutes</strong>.</p>
      </div>
      <p style="font-size: 13px; color: #718096; line-height: 1.6;">If you did not request a password reset, please secure your account immediately.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
      <p style="font-size: 12px; color: #a0aec0; text-align: center;">&copy; ${new Date().getFullYear()} SmartLanka Trade. All rights reserved.</p>
    </div>
  `;

  return await dispatchBrevoEmail({
    to: email,
    subject: 'SmartLanka Trade - Password Reset Code',
    htmlContent,
    logLabel: 'Password Reset OTP Email'
  });
};

/**
 * 3. Send Verification Link Email (Fallback Link mechanism)
 */
const sendVerificationEmail = async (email, token) => {
  const baseUrl = process.env.BASE_URL || 'https://smart-lanka-trade-final.onrender.com';
  const url = `${baseUrl}/api/auth/verify/${token}`;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 25px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #00C853; text-align: center;">Welcome to SmartLanka Trade!</h2>
      <p>Thank you for signing up. Please click the button below to verify your email address:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${url}" style="padding: 14px 28px; background-color: #00C853; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block;">Verify My Account</a>
      </div>
      <p style="font-size: 12px; color: #888;">If the button does not work, copy and paste this URL into your browser:<br>${url}</p>
    </div>
  `;

  return await dispatchBrevoEmail({
    to: email,
    subject: 'Verify Your SmartLanka Account',
    htmlContent,
    logLabel: 'Verification Link Email'
  });
};

/**
 * 4. Send Price Alert Email
 */
const sendPriceAlertEmail = async (email, symbol, targetPrice, currentPrice, alertType) => {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 25px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #00C853; text-align: center;">🚀 Price Alert Triggered!</h2>
      <p>Your target alert for <strong>${symbol}</strong> has been triggered.</p>
      <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 6px 0;"><strong>Symbol:</strong> ${symbol}</p>
        <p style="margin: 6px 0;"><strong>Target Price:</strong> ${targetPrice}</p>
        <p style="margin: 6px 0;"><strong>Current Price:</strong> ${currentPrice}</p>
        <p style="margin: 6px 0;"><strong>Condition:</strong> ${alertType === 'ABOVE' ? 'Price went above target' : 'Price dropped below target'}</p>
      </div>
      <p>Log in to your SmartLanka Trade account to manage positions.</p>
    </div>
  `;

  return await dispatchBrevoEmail({
    to: email,
    subject: `🚀 Price Alert: ${symbol} hit ${targetPrice}`,
    htmlContent,
    logLabel: 'Price Alert Email'
  });
};

module.exports = {
  verifyEmailService,
  verifyTransporter: verifyEmailService,
  dispatchBrevoEmail,
  sendVerificationOTPEmail,
  sendPasswordResetOTPEmail,
  sendVerificationEmail,
  sendPriceAlertEmail
};
