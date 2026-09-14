const oracledb = require('oracledb');
require('dotenv').config({ quiet: true });

async function migrate() {
  console.log('--- Oracle Database Schema Migration (v6 - Secure OTP Hashing) ---');
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

    // 1. Alter SL_EMAIL_VERIFICATION OTP column to VARCHAR2(128)
    console.log('1. Expanding OTP column in SL_EMAIL_VERIFICATION for SHA-256 hash storage...');
    try {
      await connection.execute(`ALTER TABLE SL_EMAIL_VERIFICATION MODIFY (OTP VARCHAR2(128))`);
      console.log('   - [SUCCESS] Modified SL_EMAIL_VERIFICATION.OTP to VARCHAR2(128)');
    } catch (err) {
      console.log('   - [INFO] Column modification note:', err.message);
    }

    // 2. Alter SL_PASSWORD_RESET OTP column to VARCHAR2(128)
    console.log('2. Expanding OTP column in SL_PASSWORD_RESET for SHA-256 hash storage...');
    try {
      await connection.execute(`ALTER TABLE SL_PASSWORD_RESET MODIFY (OTP VARCHAR2(128))`);
      console.log('   - [SUCCESS] Modified SL_PASSWORD_RESET.OTP to VARCHAR2(128)');
    } catch (err) {
      console.log('   - [INFO] Column modification note:', err.message);
    }

    await connection.commit();
    console.log('----------------------------------------------------');
    console.log('🎉 Database Schema Migration (v6) Completed Successfully!');
  } catch (err) {
    console.error('❌ Migration Note/Error:', err.message);
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
