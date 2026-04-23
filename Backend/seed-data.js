const bcrypt = require('bcryptjs');
const User = require('./models/userModel');
const connectDB = require('./config/db');
require('dotenv').config();

async function addDummyUser() {
  console.log('--- Adding Dummy User ---');
  
  try {
    // 1. Initialize DB Connection
    await connectDB();

    const dummyName = 'Test User';
    const dummyEmail = 'test@smartlanka.com';
    const dummyPassword = 'password123';

    console.log(`Checking if ${dummyEmail} exists...`);
    const existing = await User.findByEmail(dummyEmail);
    
    if (existing) {
      console.log('⚠️ Dummy user already exists.');
      return;
    }

    console.log('Hashing password...');
    const hashedPassword = await bcrypt.hash(dummyPassword, 10);

    console.log('Inserting user and creating wallet...');
    const userId = await User.createUser(dummyName, dummyEmail, hashedPassword);

    console.log(`✅ Success! Dummy user created with ID: ${userId}`);
    console.log(`📧 Email: ${dummyEmail}`);
    console.log(`🔑 Password: ${dummyPassword}`);

  } catch (err) {
    console.error('❌ Failed to add dummy user:');
    console.error(err.message);
  } finally {
    process.exit();
  }
}

addDummyUser();
