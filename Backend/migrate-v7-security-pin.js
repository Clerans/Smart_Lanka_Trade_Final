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
    connection = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT,
      configDir: process.env.DB_WALLET_PATH,
      walletLocation: process.env.DB_WALLET_PATH,
      walletPassword: process.env.DB_WALLET_PASSWORD
    });

    console.log('✅ Connected to Oracle Database.');

    const alterations = [
      {
        sql: `ALTER TABLE SL_USERS ADD (PIN_HASH VARCHAR2(255))`,
        desc: 'Add PIN_HASH to SL_USERS'
      },
      {
        sql: `ALTER TABLE SL_USERS ADD (TWO_FACTOR_ENABLED NUMBER(1) DEFAULT 0 NOT NULL)`,
        desc: 'Add TWO_FACTOR_ENABLED to SL_USERS'
      },
      {
        sql: `ALTER TABLE SL_USERS ADD (PIN_FAILED_ATTEMPTS NUMBER DEFAULT 0 NOT NULL)`,
        desc: 'Add PIN_FAILED_ATTEMPTS to SL_USERS'
      },
      {
        sql: `ALTER TABLE SL_USERS ADD (PIN_LOCKED_UNTIL TIMESTAMP)`,
        desc: 'Add PIN_LOCKED_UNTIL to SL_USERS'
      }
    ];

    for (const alt of alterations) {
      try {
        await connection.execute(alt.sql);
        console.log(`   - [SUCCESS] ${alt.desc}`);
      } catch (err) {
        if (err.message.includes('ORA-01430') || err.message.includes('already exists')) {
          console.log(`   - [SKIPPED] ${alt.desc} (already exists)`);
        } else {
          console.warn(`   - [WARNING] Failed: ${alt.desc}:`, err.message);
        }
      }
    }

    await connection.commit();
    console.log('✅ Migration v7 complete.');
  } catch (err) {
    console.error('❌ Migration v7 encountered an error:', err.message);
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
  migrate();
}

module.exports = migrate;
