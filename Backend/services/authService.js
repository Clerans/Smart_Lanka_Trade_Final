const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const userModel = require('../models/userModel');
const { sendVerificationEmail } = require('./emailService');

exports.registerUser = async (name, email, password) => {
  // Generate random token
  const token = crypto.randomBytes(32).toString('hex');
  
  const hashedPassword = await bcrypt.hash(password, 10);
  const userId = await userModel.createUser(name, email, hashedPassword, token);

  // Send verification email (async)
  sendVerificationEmail(email, token);

  return userId;
};

exports.loginUser = async (email, password) => {
  const user = await userModel.findByEmail(email);
  if (!user) throw new Error('User not found');

  // Check if verified
  if (user.IS_VERIFIED === 0) {
    throw new Error('Please verify your email before logging in.');
  }

  const isMatch = await bcrypt.compare(password, user.PASSWORD);
  if (!isMatch) throw new Error('Invalid credentials');

  const token = jwt.sign(
    { id: user.ID, email: user.EMAIL },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );

  return {
    token,
    user: {
      id: user.ID,
      name: user.NAME,
      email: user.EMAIL
    }
  };
};

exports.verifyEmailToken = async (token) => {
  const user = await userModel.findByToken(token);
  if (!user) throw new Error('Invalid or expired verification token.');

  await userModel.verifyUser(user.ID);
  return { message: 'Email verified successfully! You can now log in.' };
};
