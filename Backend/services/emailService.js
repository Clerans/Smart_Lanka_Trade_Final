const nodemailer = require('nodemailer');
const { Resend } = require('resend');
require('dotenv').config();

// Provider selection: 'brevo' (default), 'resend', or 'smtp'
const getEmailProvider = () => (process.env.EMAIL_PROVIDER || 'brevo').toLowerCase();

// Get configured sender address
const getFromAddress = () => {
  if (process.env.BREVO_FROM_EMAIL) {
    const name = process.env.BREVO_FROM_NAME || 'SmartLanka Trade';
    return `"${name}" <${process.env.BREVO_FROM_EMAIL}>`;
  }
  return process.env.EMAIL_FROM || 'SmartLanka Trade <cleranspc@gmail.com>';
};

// Resend client initialization (singleton / on-demand)
const getResendClient = () => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY environment variable is not configured.');
  }
  return new Resend(apiKey);
};

// Brevo / SMTP Transporter
let smtpTransporter = null;
const getSmtpTransporter = () => {
  if (!smtpTransporter) {
    const provider = getEmailProvider();
    
    let smtpHost, smtpPort, smtpUser, smtpPass;
    
    if (provider === 'brevo') {
      smtpHost = process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com';
      smtpPort = parseInt(process.env.BREVO_SMTP_PORT || '587', 10);
      smtpUser = process.env.BREVO_SMTP_USER;
      smtpPass = process.env.BREVO_SMTP_PASSWORD || process.env.BREVO_SMTP_PASS;
    } else {
      // Default to generic SMTP (e.g. Gmail)
      smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
      smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
      smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
      smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
    }

    smtpTransporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });
  }
  return smtpTransporter;
};

// Safe Startup Diagnostics (Validates configuration without logging secrets or keys)
const verifyEmailService = async () => {
  const provider = getEmailProvider();
  console.log('🔍 [Email Service Diagnostics]');
  console.log(`- Email provider: ${provider}`);

  if (provider === 'brevo' || provider === 'smtp') {
    const isBrevo = provider === 'brevo';
    const host = isBrevo ? (process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com') : (process.env.SMTP_HOST || 'smtp.gmail.com');
    const port = isBrevo ? (process.env.BREVO_SMTP_PORT || '587') : (process.env.SMTP_PORT || '587');
    const user = isBrevo ? process.env.BREVO_SMTP_USER : (process.env.SMTP_USER || process.env.EMAIL_USER);
    const hasPass = isBrevo ? !!(process.env.BREVO_SMTP_PASSWORD || process.env.BREVO_SMTP_PASS) : !!(process.env.SMTP_PASS || process.env.EMAIL_PASS);
    
    console.log(`- SMTP host: ${host}:${port}`);
    console.log(`- SMTP user: ${user || 'not configured'}`);
    console.log(`- SMTP password configured: ${hasPass ? 'yes' : 'no'}`);

    if (!user || !hasPass) {
      console.warn('⚠️ Brevo/SMTP credentials missing in environment variables.');
      return false;
    }

    try {
      const transporter = getSmtpTransporter();
      await transporter.verify();
      console.log(`✅ ${provider.toUpperCase()} SMTP connection verified successfully`);
      return true;
    } catch (error) {
      console.error(`❌ ${provider.toUpperCase()} SMTP verification failed:`, {
        code: error.code,
        command: error.command,
        responseCode: error.responseCode,
        message: error.message
      });
      return false;
    }
  } else if (provider === 'resend') {
    const hasKey = !!process.env.RESEND_API_KEY;
    const hasSender = !!process.env.EMAIL_FROM;

    console.log(`- Resend API key configured: ${hasKey ? 'yes' : 'no'}`);
    console.log(`- Email sender configured: ${hasSender ? 'yes' : 'no'}`);

    if (!hasKey) {
      console.warn('⚠️ RESEND_API_KEY is not configured in environment variables. Outbound emails will fail.');
      return false;
    }
    console.log('✅ Resend HTTPS provider configured successfully');
    return true;
  } else {
    console.warn(`⚠️ Unknown EMAIL_PROVIDER '${provider}'. Expected 'brevo', 'resend', or 'smtp'.`);
    return false;
  }
};

// Generic internal dispatch function
const dispatchEmail = async ({ to, subject, html, logLabel }) => {
  const provider = getEmailProvider();
  const fromAddress = getFromAddress();

  if (provider === 'resend') {
    try {
      const resend = getResendClient();
      const response = await resend.emails.send({
        from: fromAddress,
        to: Array.isArray(to) ? to : [to],
        subject,
        html
      });

      if (response.error) {
        console.error(`❌ Resend ${logLabel} delivery failed for ${to}:`, {
          provider: 'resend',
          name: response.error.name,
          message: response.error.message
        });
        const err = new Error(response.error.message || 'Resend email delivery failed');
        err.provider = 'resend';
        err.statusCode = response.error.statusCode;
        throw err;
      }

      console.log(`✅ ${logLabel} sent successfully via Resend to ${to} (Message ID: ${response.data?.id})`);
      return response.data;
    } catch (error) {
      if (!error.provider) {
        console.error(`❌ Resend ${logLabel} delivery error for ${to}:`, {
          provider: 'resend',
          name: error.name,
          message: error.message
        });
      }
      throw error;
    }
  } else if (provider === 'brevo' || provider === 'smtp') {
    try {
      const transporter = getSmtpTransporter();
      const mailOptions = {
        from: fromAddress,
        to,
        subject,
        html
      };
      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ ${logLabel} sent successfully via ${provider.toUpperCase()} to ${to} (Message ID: ${info.messageId})`);
      return info;
    } catch (error) {
      console.error(`❌ ${provider.toUpperCase()} ${logLabel} delivery failed for ${to}:`, {
        code: error.code,
        command: error.command,
        responseCode: error.responseCode,
        message: error.message
      });
      throw error;
    }
  } else {
    throw new Error(`Unsupported EMAIL_PROVIDER '${provider}'. Please configure EMAIL_PROVIDER=brevo, resend, or smtp.`);
  }
};

// 1. Send OTP for Email Verification (Registration / Resend)
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

// 3. Send Verification Email (Link based)
const sendVerificationEmail = async (email, token) => {
  const url = `${process.env.BASE_URL}/api/auth/verify/${token}`;
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
  verifyTransporter: verifyEmailService, // Alias for backward compatibility
  sendVerificationOTPEmail, 
  sendPasswordResetOTPEmail, 
  sendVerificationEmail, 
  sendPriceAlertEmail 
};
