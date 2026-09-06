const oracledb = require('oracledb');
require('dotenv').config();

// Enable auto-commit for development simplicity
oracledb.autoCommit = true;

async function connectDB() {
  try {
    try {
      const existingPool = oracledb.getPool();
      if (existingPool) return;
    } catch (e) {
      // pool doesn't exist, proceed to create
    }

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
    if (err.message && err.message.includes('NJS-047') || err.message.includes('already exists')) {
      return;
    }
    console.error('❌ Oracle DB connection error:', err.message);
    throw err;
  }
}

module.exports = connectDB;
