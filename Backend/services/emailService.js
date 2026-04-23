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

module.exports = { sendVerificationEmail };
