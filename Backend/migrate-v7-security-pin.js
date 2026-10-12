const oracledb = require('oracledb');
require('dotenv').config({ quiet: true });

/**
 * Migration v7: Authoritative Security Settings, PIN Hashing, and Rate Limiting
 * Adds columns to SL_USERS:
 *  - PIN_HASH VARCHAR2(255)
 *  - TWO_FACTOR_ENABLED NUMBER(1) DEFAULT 0
 *  - PIN_FAILED_ATTEMPTS NUMBER DEFAULT 0
 *  - PIN_LOCKED_UNTIL TIMESTAMP
 */
async function migrate() {
  console.log('--- Oracle Database Schema Migration (v7 - Security PIN & Rate Limiting) ---');
  let connection;
  try {
    const dbConfig = {
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT
    };
    if (process.env.DB_WALLET_PATH) {
      dbConfig.configDir = process.env.DB_WALLET_PATH;
      dbConfig.walletLocation = process.env.DB_WALLET_PATH;
      dbConfig.walletPassword = process.env.DB_WALLET_PASSWORD;
    }

    connection = await oracledb.getConnection(dbConfig);
    console.log('✅ Connected to Oracle Database.');

    // 1. Inspect existing columns in SL_USERS via Oracle metadata
    const colRes = await connection.execute(
      `SELECT COLUMN_NAME FROM USER_TAB_COLUMNS WHERE TABLE_NAME = 'SL_USERS'`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const existingCols = new Set((colRes.rows || []).map(r => r.COLUMN_NAME.toUpperCase()));
    console.log(`ℹ️ SL_USERS currently has ${existingCols.size} columns.`);

    const requiredColumns = [
      {
        name: 'PIN_HASH',
        sql: `ALTER TABLE SL_USERS ADD (PIN_HASH VARCHAR2(255))`,
        desc: 'Add PIN_HASH to SL_USERS'
      },
      {
        name: 'TWO_FACTOR_ENABLED',
        sql: `ALTER TABLE SL_USERS ADD (TWO_FACTOR_ENABLED NUMBER(1) DEFAULT 0 NOT NULL)`,
        desc: 'Add TWO_FACTOR_ENABLED to SL_USERS'
      },
      {
        name: 'PIN_FAILED_ATTEMPTS',
        sql: `ALTER TABLE SL_USERS ADD (PIN_FAILED_ATTEMPTS NUMBER DEFAULT 0 NOT NULL)`,
        desc: 'Add PIN_FAILED_ATTEMPTS to SL_USERS'
      },
      {
        name: 'PIN_LOCKED_UNTIL',
        sql: `ALTER TABLE SL_USERS ADD (PIN_LOCKED_UNTIL TIMESTAMP)`,
        desc: 'Add PIN_LOCKED_UNTIL to SL_USERS'
      }
    ];

    for (const col of requiredColumns) {
      if (existingCols.has(col.name)) {
        console.log(`   - [SKIPPED] ${col.desc} (${col.name} already exists in metadata)`);
        continue;
      }

      try {
        await connection.execute(col.sql);
        console.log(`   - [SUCCESS] ${col.desc}`);
      } catch (err) {
        if (err.message && (err.message.includes('ORA-01430') || err.message.includes('already exists'))) {
          console.log(`   - [SKIPPED] ${col.desc} (column already exists)`);
        } else {
          console.error(`   - [FAILED] ${col.desc}:`, err.message);
          throw new Error(`Migration v7 failed executing '${col.sql}': ${err.message}`);
        }
      }
    }

    await connection.commit();

    // 2. Authoritative Post-Migration Verification
    const verifyRes = await connection.execute(
      `SELECT COLUMN_NAME FROM USER_TAB_COLUMNS WHERE TABLE_NAME = 'SL_USERS'`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const postCols = new Set((verifyRes.rows || []).map(r => r.COLUMN_NAME.toUpperCase()));
    const missing = requiredColumns.filter(c => !postCols.has(c.name));

    if (missing.length > 0) {
      const missingNames = missing.map(m => m.name).join(', ');
      throw new Error(`Post-migration verification failed: Missing required columns in SL_USERS: ${missingNames}`);
    }

    console.log('✅ Migration v7 complete and verified: All security PIN & 2FA columns confirmed present in SL_USERS.');
    return true;
  } catch (err) {
    console.error('❌ Migration v7 encountered an error:', err.message);
    if (connection) {
      try { await connection.rollback(); } catch (rbErr) {}
    }
    if (require.main === module) {
      process.exit(1);
    }
    throw err;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (closeErr) {
        console.error('Error closing connection:', closeErr.message);
      }
    }
  }
}

if (require.main === module) {
  migrate().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = migrate;
