const { Resend } = require('resend');
require('dotenv').config({ quiet: true });

// Get configured sender address
const getFromAddress = () => {
  return process.env.EMAIL_FROM || 'SmartLanka Trade <onboarding@resend.dev>';
};

// Resend Client Instance (Singleton / Reusable)
let resendClient = null;
const getResendClient = () => {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      const err = new Error('RESEND_API_KEY environment variable is not configured.');
      err.code = 'EMAIL_CONFIG_MISSING';
      throw err;
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
};

// Safe Startup Diagnostics (Validates configuration without logging secrets or keys)
const verifyEmailService = async () => {
  const provider = (process.env.EMAIL_PROVIDER || 'resend').toLowerCase();
  console.log('🔍 [Email Service Diagnostics]');
  console.log(`- Email provider: ${provider}`);

  const hasApiKey = !!process.env.RESEND_API_KEY;
  const fromAddress = getFromAddress();
  const hasSender = !!fromAddress;

  console.log(`- Resend API key configured: ${hasApiKey ? 'yes' : 'no'}`);
  console.log(`- Email sender configured: ${hasSender ? 'yes' : 'no'}`);

  if (!hasApiKey) {
    console.warn('⚠️ RESEND_API_KEY missing in environment variables.');
    return false;
  }

  return true;
};

// Generic internal dispatch function via Resend REST API (HTTPS / Port 443)
const dispatchEmail = async ({ to, subject, html, logLabel }) => {
  const fromAddress = getFromAddress();
  const resend = getResendClient();

  const recipient = Array.isArray(to) ? to : [to];

  try {
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: recipient,
      subject,
      html
    });

    if (error) {
      console.error(`❌ Resend REST API ${logLabel} failed:`, {
        name: error.name,
        message: error.message
      });
      const dispatchErr = new Error(`Email delivery failed via Resend REST API: ${error.message}`);
      dispatchErr.code = 'EMAIL_SEND_FAILED';
      dispatchErr.status = 503;
      throw dispatchErr;
    }

    console.log(`✅ ${logLabel} sent successfully via Resend REST API to ${Array.isArray(to) ? to.join(', ') : to} (ID: ${data?.id || 'delivered'})`);
    return { id: data?.id || 'delivered', success: true };
  } catch (error) {
    if (error.code === 'EMAIL_CONFIG_MISSING' || error.code === 'EMAIL_SEND_FAILED') {
      throw error;
    }
    console.error(`❌ Resend REST API dispatch exception:`, {
      name: error.name,
      message: error.message
    });
    const customErr = new Error('Email delivery could not be completed at this time.');
    customErr.code = 'EMAIL_SEND_FAILED';
    customErr.status = 503;
    throw customErr;
  }
};

// 1. Send OTP for Email Verification (Primary Verification Mechanism)
const sendVerificationOTPEmail = async (email, otp) => {
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 25px;">
        <h1 style="color: #00C853; margin: 0; font-size: 26px;">SmartLanka Trade</h1>
        <p style="color: #666; font-size: 14px; margin-top: 5px;">Your Trusted Crypto & Trading Platform</p>
      </div>
      <div style="background: #f8fafc; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 25px;">
        <p style="font-size: 15px; color: #333; margin: 0 0 15px 0;">Use the verification code below to complete your registration:</p>
        <div style="font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #00C853; padding: 12px 24px; background: #e8f5e9; border-radius: 8px; display: inline-block;">
          ${otp}
        </div>
        <p style="font-size: 13px; color: #888; margin-top: 15px;">⏱️ This code is valid for <strong>5 minutes</strong>.</p>
      </div>
      <p style="font-size: 13px; color: #777; line-height: 1.5;">If you did not request this verification code, please ignore this email or contact support if you suspect unauthorized activity.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="font-size: 12px; color: #aaa; text-align: center;">&copy; ${new Date().getFullYear()} SmartLanka Trade. All rights reserved.</p>
    </div>
  `;

  return await dispatchEmail({
    to: email,
    subject: 'SmartLanka - Email Verification Code',
    html,
    logLabel: 'Verification OTP email'
  });
};

// 2. Send OTP for Password Reset
const sendPasswordResetOTPEmail = async (email, otp) => {
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 25px;">
        <h1 style="color: #00C853; margin: 0; font-size: 26px;">SmartLanka Trade</h1>
        <p style="color: #666; font-size: 14px; margin-top: 5px;">Security Verification</p>
      </div>
      <div style="background: #f8fafc; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 25px;">
        <p style="font-size: 15px; color: #333; margin: 0 0 15px 0;">You requested to reset your password. Use the code below:</p>
        <div style="font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #FF5722; padding: 12px 24px; background: #fbe9e7; border-radius: 8px; display: inline-block;">
          ${otp}
        </div>
        <p style="font-size: 13px; color: #888; margin-top: 15px;">⏱️ This code will expire in <strong>5 minutes</strong>.</p>
      </div>
      <p style="font-size: 13px; color: #777; line-height: 1.5;">If you did not request a password reset, please secure your account immediately.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="font-size: 12px; color: #aaa; text-align: center;">&copy; ${new Date().getFullYear()} SmartLanka Trade. All rights reserved.</p>
    </div>
  `;

  return await dispatchEmail({
    to: email,
    subject: 'SmartLanka - Password Reset Code',
    html,
    logLabel: 'Password Reset OTP email'
  });
};

// 3. Send Verification Email (Link based fallback)
const sendVerificationEmail = async (email, token) => {
  const baseUrl = process.env.BASE_URL || 'https://smart-lanka-trade-final.onrender.com';
  const url = `${baseUrl}/api/auth/verify/${token}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #4CAF50; text-align: center;">Welcome to SmartLanka!</h2>
      <p>Hi there,</p>
      <p>Thank you for signing up. Please click the button below to verify your email address and activate your account:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${url}" style="padding: 15px 30px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">Verify My Account</a>
      </div>
      <p>If the button doesn't work, copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #888;">${url}</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="font-size: 12px; color: #aaa; text-align: center;">If you did not create an account, you can safely ignore this email.</p>
    </div>
  `;

  return await dispatchEmail({
    to: email,
    subject: 'Verify Your SmartLanka Account',
    html,
    logLabel: 'Verification link email'
  });
};

// 4. Send Price Alert Email
const sendPriceAlertEmail = async (email, symbol, targetPrice, currentPrice, alertType) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #4CAF50; text-align: center;">Price Alert Triggered!</h2>
      <p>Hi there,</p>
      <p>Your alert for <strong>${symbol}</strong> has been triggered.</p>
      <div style="background-color: #f9f9f9; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>Symbol:</strong> ${symbol}</p>
        <p style="margin: 5px 0;"><strong>Target Price:</strong> ${targetPrice}</p>
        <p style="margin: 5px 0;"><strong>Current Price:</strong> ${currentPrice}</p>
        <p style="margin: 5px 0;"><strong>Alert Type:</strong> ${alertType === 'ABOVE' ? 'Price went above' : 'Price went below'}</p>
      </div>
      <p>Log in to the app to take action!</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="font-size: 12px; color: #aaa; text-align: center;">SmartLanka Trading Platform</p>
    </div>
  `;

  return await dispatchEmail({
    to: email,
    subject: `🚀 Price Alert: ${symbol} hit ${targetPrice}`,
    html,
    logLabel: 'Price alert email'
  });
};

module.exports = { 
  verifyEmailService,
  verifyTransporter: verifyEmailService,
  sendVerificationOTPEmail, 
  sendPasswordResetOTPEmail, 
  sendVerificationEmail, 
  sendPriceAlertEmail 
};

