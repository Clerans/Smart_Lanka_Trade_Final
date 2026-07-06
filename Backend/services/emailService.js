const nodemailer = require('nodemailer');
require('dotenv').config();

// Gmail Configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS // Your 16-character App Password
  }
});

const sendVerificationEmail = async (email, token) => {
  const url = `${process.env.BASE_URL}/api/auth/verify/${token}`;
  
  const mailOptions = {
    from: `"SmartLankaTrade" <${process.env.EMAIL_USER}>`,
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
    await transporter.sendMail(mailOptions);
    console.log(`✅ Verification email sent to ${email} via Gmail`);
  } catch (error) {
    console.error('❌ Gmail Send Error:', error.message);
  }
};

const sendPriceAlertEmail = async (email, symbol, targetPrice, currentPrice, alertType) => {
  const mailOptions = {
    from: `"SmartLankaTrade" <${process.env.EMAIL_USER}>`,
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
    await transporter.sendMail(mailOptions);
    console.log(`✅ Price alert email sent to ${email}`);
  } catch (error) {
    console.error('❌ Price Alert Email Error:', error.message);
  }
};

module.exports = { sendVerificationEmail, sendPriceAlertEmail };
