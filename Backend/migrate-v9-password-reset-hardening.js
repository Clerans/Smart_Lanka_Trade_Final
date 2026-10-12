/**
 * Backend/migrate-v9-password-reset-hardening.js
 * Migration to add ATTEMPTS and CREATED_AT tracking to SL_PASSWORD_RESET
 */

const db = require('./config/db');

async function runMigration() {
  console.log('🔄 Running Migration v9: Password Reset OTP Hardening...');
  let pool;
  let connection;

  try {
    pool = await db();
    connection = await pool.getConnection();

    // 1. Add ATTEMPTS column if missing
    try {
      await connection.execute(`
        ALTER TABLE SL_PASSWORD_RESET ADD (
          ATTEMPTS NUMBER DEFAULT 0,
          CREATED_AT TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await connection.commit();
      console.log('✅ Added ATTEMPTS and CREATED_AT columns to SL_PASSWORD_RESET');
    } catch (err) {
      if (err.message && (err.message.includes('ORA-01430') || err.message.includes('already exists'))) {
        console.log('ℹ️ ATTEMPTS and CREATED_AT columns already exist on SL_PASSWORD_RESET');
      } else {
        throw err;
      }
    }

    // 2. Add index for faster email/cooldown/expiry lookups
    try {
      await connection.execute(`
        CREATE INDEX IDX_PWD_RESET_USER_EXP ON SL_PASSWORD_RESET (USER_ID, EXPIRES_AT, USED)
      `);
      await connection.commit();
      console.log('✅ Created index IDX_PWD_RESET_USER_EXP');
    } catch (err) {
      if (err.message && (err.message.includes('ORA-00955') || err.message.includes('already exists'))) {
        console.log('ℹ️ Index IDX_PWD_RESET_USER_EXP already exists');
      } else {
        console.warn('⚠️ Index note:', err.message);
      }
    }

    console.log('🎉 Migration v9 completed successfully!');
  } catch (err) {
    console.error('❌ Migration v9 failed:', err.message);
    if (connection) await connection.rollback();
    process.exit(1);
  } finally {
    if (connection) await connection.close();
  }
}

if (require.main === module) {
  runMigration().then(() => process.exit(0));
}

module.exports = runMigration;
