const oracledb = require('oracledb');
require('dotenv').config();

async function migrate() {
  console.log('--- Oracle Autonomous AI Database 26ai Schema Migration (v5 - Firebase Auth) ---');
  let connection;
  try {
    const config = {
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT
    };

    if (process.env.DB_WALLET_PATH) {
      config.configDir = process.env.DB_WALLET_PATH;
      config.walletLocation = process.env.DB_WALLET_PATH;
      if (process.env.DB_WALLET_PASSWORD) {
        config.walletPassword = process.env.DB_WALLET_PASSWORD;
      }
    }

    connection = await oracledb.getConnection(config);
    console.log('✅ Connected to Oracle Autonomous AI Database 26ai.');

    // 1. Add FIREBASE_UID to SL_USERS (VARCHAR2(128) UNIQUE)
    console.log('1. Adding FIREBASE_UID column to SL_USERS...');
    try {
      await connection.execute(`ALTER TABLE SL_USERS ADD (FIREBASE_UID VARCHAR2(128) UNIQUE)`);
      console.log('   - [SUCCESS] Added FIREBASE_UID to SL_USERS');
    } catch (err) {
      const isColumnExists = err.errorNum === 1430 || (err.message && err.message.includes('ORA-01430'));
      if (isColumnExists) {
        console.log('   - [SKIPPED] FIREBASE_UID column already exists in SL_USERS (ORA-01430)');
      } else {
        console.error('   - [WARNING] Could not alter SL_USERS:', err.message);
      }
    }

    // 2. Create index for FIREBASE_UID (if not auto-created by UNIQUE constraint)
    console.log('2. Verifying index for FIREBASE_UID...');
    try {
      await connection.execute(`CREATE INDEX IDX_USERS_FIREBASE_UID ON SL_USERS(FIREBASE_UID)`);
      console.log('   - [SUCCESS] Created index IDX_USERS_FIREBASE_UID');
    } catch (err) {
      const isIndexHandled = 
        err.errorNum === 955 || 
        err.errorNum === 1408 || 
        err.errorNum === 2261 ||
        (err.message && (err.message.includes('ORA-00955') || err.message.includes('ORA-01408') || err.message.includes('ORA-02261')));
      if (isIndexHandled) {
        console.log('   - [SKIPPED] Index already exists or column is already indexed (ORA-00955/01408)');
      } else {
        console.warn('   - [WARN] Creating index:', err.message);
      }
    }

    await connection.commit();
    console.log('----------------------------------------------------');
    console.log('🎉 Database Schema Migration (v5) Completed Successfully on Oracle 26ai!');
  } catch (err) {
    console.error('❌ Migration Failed:', err.message);
    throw err;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error(err);
      }
    }
  }
}

if (require.main === module) {
  migrate().catch(() => process.exit(1));
}

module.exports = { migrate };
