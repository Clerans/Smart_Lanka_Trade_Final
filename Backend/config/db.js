const oracledb = require('oracledb');
require('dotenv').config();

// Enable auto-commit for development simplicity
oracledb.autoCommit = true;

async function connectDB() {
  try {
    await oracledb.createPool({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT,
      poolMax: 10,
      poolMin: 2,
      poolIncrement: 1
    });
    console.log('✅ Oracle DB Connected (Pool Created)');
  } catch (err) {
    console.error('❌ Oracle DB connection error:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
