const oracledb = require('oracledb');
const connectDB = require('./config/db');
require('dotenv').config({ quiet: true });

async function createPerformanceIndexes() {
  let pool;
  let connection;
  try {
    console.log('🚀 Connecting to Oracle DB for performance indexing...');
    pool = await connectDB();
    connection = await oracledb.getConnection();

    const indexes = [
      {
        name: 'IDX_TX_USER_CREATED',
        sql: `CREATE INDEX IDX_TX_USER_CREATED ON TRANSACTIONS(USER_ID, CREATED_AT DESC)`
      },
      {
        name: 'IDX_TX_REC_CREATED',
        sql: `CREATE INDEX IDX_TX_REC_CREATED ON TRANSACTIONS(RECIPIENT_USER_ID, CREATED_AT DESC)`
      },
      {
        name: 'IDX_PORTFOLIOS_USER_QTY',
        sql: `CREATE INDEX IDX_PORTFOLIOS_USER_QTY ON PORTFOLIOS(USER_ID, QUANTITY)`
      },
      {
        name: 'IDX_SL_USERS_UID',
        sql: `CREATE INDEX IDX_SL_USERS_UID ON SL_USERS(ACCOUNT_UID)`
      }
    ];

    for (const idx of indexes) {
      try {
        console.log(`⏳ Creating index: ${idx.name}...`);
        await connection.execute(idx.sql);
        console.log(`✅ Index ${idx.name} created successfully.`);
      } catch (err) {
        if (err.message && (err.message.includes('ORA-00955') || err.message.includes('name is already used'))) {
          console.log(`ℹ️ Index ${idx.name} already exists.`);
        } else {
          console.warn(`⚠️ Warning creating ${idx.name}:`, err.message);
        }
      }
    }

    console.log('🎉 Database performance indexing complete!');
  } catch (err) {
    console.error('❌ Index migration error:', err.message);
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) {}
    }
    if (pool) {
      try { await connectDB.closePool(); } catch (e) {}
    }
  }
}

createPerformanceIndexes();
