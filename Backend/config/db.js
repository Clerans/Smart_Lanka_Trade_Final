const oracledb = require('oracledb');
require('dotenv').config();

// Transaction management: explicit commits/rollbacks
oracledb.autoCommit = false;

async function connectDB() {
  try {
    try {
      const existingPool = oracledb.getPool();
      if (existingPool) return existingPool;
    } catch (e) {
      // pool doesn't exist, proceed to create
    }

    const pool = await oracledb.createPool({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT,
      poolMax: parseInt(process.env.DB_POOL_MAX || '15', 10),
      poolMin: parseInt(process.env.DB_POOL_MIN || '2', 10),
      poolIncrement: parseInt(process.env.DB_POOL_INCREMENT || '1', 10),
      poolTimeout: parseInt(process.env.DB_POOL_TIMEOUT || '60', 10),
      queueTimeout: parseInt(process.env.DB_QUEUE_TIMEOUT || '60000', 10)
    });
    console.log(`✅ Oracle DB Connected (Pool Created: max=${pool.poolMax}, min=${pool.poolMin})`);
    return pool;
  } catch (err) {
    if (err.message && (err.message.includes('NJS-047') || err.message.includes('already exists'))) {
      return;
    }
    console.error('❌ Oracle DB connection error:', err.message);
    throw err;
  }
}

async function closePool() {
  try {
    const pool = oracledb.getPool();
    if (pool) {
      await pool.close(10);
      console.log('🛑 Oracle DB Connection Pool Closed Gracefully');
    }
  } catch (err) {
    // ignore if pool already closed
  }
}

module.exports = connectDB;
module.exports.closePool = closePool;
