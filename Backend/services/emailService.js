const nodemailer = require('nodemailer');
require('dotenv').config();

// SMTP Transporter Configuration
const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: smtpUser,
    pass: smtpPass
  }
});

const getFromAddress = () => {
  return process.env.EMAIL_FROM || `"SMARTLANKA TRADE" <${smtpUser || 'noreply@smartlankatrade.com'}>`;
};

// Safe SMTP Diagnostics (verifies configuration without logging credentials)
const verifyTransporter = async () => {
  console.log('🔍 [SMTP Diagnostics]');
  console.log(`- SMTP host configured: ${process.env.SMTP_HOST ? 'yes' : 'default (smtp.gmail.com)'}`);
  console.log(`- SMTP port configured: ${process.env.SMTP_PORT ? 'yes' : 'default (587)'}`);
  console.log(`- SMTP user configured: ${smtpUser ? 'yes' : 'no'}`);
  console.log(`- SMTP password configured: ${smtpPass ? 'yes' : 'no'}`);

  if (!smtpUser || !smtpPass) {
    console.warn('⚠️ SMTP user or password is missing in environment variables. Email delivery may fail.');
    return false;
  }

  try {
    await transporter.verify();
    console.log('✅ SMTP configuration verified successfully');
    return true;
  } catch (error) {
    console.error('❌ SMTP verification failed:', {
      code: error.code,
      responseCode: error.responseCode,
      command: error.command,
      message: error.message
    });
    return false;
  }
};

// Send OTP for Email Verification
const sendVerificationOTPEmail = async (email, otp) => {
  const mailOptions = {
    from: getFromAddress(),
    to: email,
    subject: 'SmartLanka - Email Verification Code',
    html: `
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
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Verification email sent successfully to ${email} (Message ID: ${info.messageId})`);
    return info;
  } catch (error) {
    console.error(`❌ SMTP email delivery failed for ${email}:`, {
      code: error.code,
      command: error.command,
      responseCode: error.responseCode,
      message: error.message
    });
    throw error;
  }
};

// Send OTP for Password Reset
const sendPasswordResetOTPEmail = async (email, otp) => {
  const mailOptions = {
    from: getFromAddress(),
    to: email,
    subject: 'SmartLanka - Password Reset Code',
    html: `
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
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Password Reset OTP sent successfully to ${email} (Message ID: ${info.messageId})`);
    return info;
  } catch (error) {
    console.error(`❌ SMTP reset OTP delivery failed for ${email}:`, {
      code: error.code,
      command: error.command,
      responseCode: error.responseCode,
      message: error.message
    });
    throw error;
  }
};

const sendVerificationEmail = async (email, token) => {
  const url = `${process.env.BASE_URL}/api/auth/verify/${token}`;
  
  const mailOptions = {
    from: getFromAddress(),
    to: email,
    subject: 'Verify Your SmartLanka Account',
    html: `
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
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Verification email link sent successfully to ${email}`);
    return info;
  } catch (error) {
    console.error(`❌ Email link send failed for ${email}:`, {
      code: error.code,
      command: error.command,
      responseCode: error.responseCode,
      message: error.message
    });
    throw error;
  }
};

const sendPriceAlertEmail = async (email, symbol, targetPrice, currentPrice, alertType) => {
  const mailOptions = {
    from: getFromAddress(),
    to: email,
    subject: `🚀 Price Alert: ${symbol} hit ${targetPrice}`,
    html: `
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
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Price alert email sent to ${email}`);
    return info;
  } catch (error) {
    console.error(`❌ Price Alert Email Error for ${email}:`, {
      code: error.code,
      command: error.command,
      responseCode: error.responseCode,
      message: error.message
    });
    throw error;
  }
};

module.exports = { 
  transporter,
  verifyTransporter,
  sendVerificationOTPEmail, 
  sendPasswordResetOTPEmail, 
  sendVerificationEmail, 
  sendPriceAlertEmail 
};
