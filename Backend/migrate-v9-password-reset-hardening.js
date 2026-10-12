/**
 * Backend/migrate-v9-password-reset-hardening.js
 * Migration to add ATTEMPTS and CREATED_AT tracking to SL_PASSWORD_RESET
 */

const oracledb = require('oracledb');
const db = require('./config/db');

async function runMigration() {
  console.log('🔄 Running Migration v9: Password Reset OTP Hardening...');
  let pool;
  let connection;

  try {
    pool = await db();
    connection = await pool.getConnection();

    // 1. Inspect existing columns in SL_PASSWORD_RESET
    const colRes = await connection.execute(
      `SELECT COLUMN_NAME FROM USER_TAB_COLUMNS WHERE TABLE_NAME = 'SL_PASSWORD_RESET'`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const existingCols = new Set((colRes.rows || []).map(r => r.COLUMN_NAME.toUpperCase()));

    // Add ATTEMPTS if missing
    if (!existingCols.has('ATTEMPTS')) {
      try {
        await connection.execute(`ALTER TABLE SL_PASSWORD_RESET ADD (ATTEMPTS NUMBER DEFAULT 0 NOT NULL)`);
        console.log('✅ Added ATTEMPTS column to SL_PASSWORD_RESET');
      } catch (err) {
        if (err.message && (err.message.includes('ORA-01430') || err.message.includes('already exists'))) {
          console.log('ℹ️ ATTEMPTS column already exists on SL_PASSWORD_RESET');
        } else {
          throw err;
        }
      }
    } else {
      console.log('ℹ️ ATTEMPTS column already exists on SL_PASSWORD_RESET');
    }

    // Add CREATED_AT if missing
    if (!existingCols.has('CREATED_AT')) {
      try {
        await connection.execute(`ALTER TABLE SL_PASSWORD_RESET ADD (CREATED_AT TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP)`);
        console.log('✅ Added CREATED_AT column to SL_PASSWORD_RESET');
      } catch (err) {
        if (err.message && (err.message.includes('ORA-01430') || err.message.includes('already exists'))) {
          console.log('ℹ️ CREATED_AT column already exists on SL_PASSWORD_RESET');
        } else {
          throw err;
        }
      }
    } else {
      console.log('ℹ️ CREATED_AT column already exists on SL_PASSWORD_RESET');
    }

    // 2. Check and add index for faster lookup
    const idxRes = await connection.execute(
      `SELECT INDEX_NAME FROM USER_INDEXES WHERE TABLE_NAME = 'SL_PASSWORD_RESET' AND INDEX_NAME = 'IDX_PWD_RESET_USER_EXP'`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (!idxRes.rows || idxRes.rows.length === 0) {
      try {
        await connection.execute(`
          CREATE INDEX IDX_PWD_RESET_USER_EXP ON SL_PASSWORD_RESET (USER_ID, EXPIRES_AT, USED)
        `);
        console.log('✅ Created index IDX_PWD_RESET_USER_EXP');
      } catch (err) {
        if (err.message && (err.message.includes('ORA-00955') || err.message.includes('already exists'))) {
          console.log('ℹ️ Index IDX_PWD_RESET_USER_EXP already exists');
        } else {
          throw err;
        }
      }
    } else {
      console.log('ℹ️ Index IDX_PWD_RESET_USER_EXP already exists in metadata');
    }

    await connection.commit();

    // 3. Post-migration verification
    const postColRes = await connection.execute(
      `SELECT COLUMN_NAME FROM USER_TAB_COLUMNS WHERE TABLE_NAME = 'SL_PASSWORD_RESET'`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const postCols = new Set((postColRes.rows || []).map(r => r.COLUMN_NAME.toUpperCase()));
    if (!postCols.has('ATTEMPTS') || !postCols.has('CREATED_AT')) {
      throw new Error('Post-migration verification failed: Missing ATTEMPTS or CREATED_AT on SL_PASSWORD_RESET');
    }

    console.log('🎉 Migration v9 completed and verified successfully!');
    return true;
  } catch (err) {
    console.error('❌ Migration v9 failed:', err.message);
    if (connection) {
      try { await connection.rollback(); } catch (rbErr) {}
    }
    if (require.main === module) {
      process.exit(1);
    }
    throw err;
  } finally {
    if (connection) {
      try { await connection.close(); } catch (closeErr) {}
    }
  }
}

if (require.main === module) {
  runMigration().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = runMigration;
