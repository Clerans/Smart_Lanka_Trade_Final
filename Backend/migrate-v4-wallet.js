const oracledb = require('oracledb');
const crypto = require('crypto');
require('dotenv').config({ quiet: true });

function generateAccountUID() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous chars
  let code = '';
  const bytes = crypto.randomBytes(7);
  for (let i = 0; i < 7; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return `SLT-${code}`;
}

async function migrate() {
  console.log('--- Oracle Database Schema Migration (v4 - Wallet & Transfers) ---');
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

    // 1. Add ACCOUNT_UID to SL_USERS
    console.log('1. Adding ACCOUNT_UID column to SL_USERS...');
    try {
      await connection.execute(`ALTER TABLE SL_USERS ADD (ACCOUNT_UID VARCHAR2(30) UNIQUE)`);
      console.log('   - [SUCCESS] Added ACCOUNT_UID to SL_USERS');
    } catch (err) {
      if (err.message.includes('ORA-01430') || err.message.includes('already exists')) {
        console.log('   - [SKIPPED] ACCOUNT_UID column already exists in SL_USERS');
      } else {
        console.error('   - [WARNING] Could not alter SL_USERS:', err.message);
      }
    }

    // 2. Backfill existing users with unique ACCOUNT_UID
    console.log('2. Backfilling ACCOUNT_UID for existing users...');
    try {
      const usersRes = await connection.execute(
        `SELECT ID, ACCOUNT_UID FROM SL_USERS WHERE ACCOUNT_UID IS NULL`,
        [],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      for (const row of usersRes.rows) {
        let uniqueUid = generateAccountUID();
        let updated = false;
        let attempts = 0;
        while (!updated && attempts < 10) {
          try {
            await connection.execute(
              `UPDATE SL_USERS SET ACCOUNT_UID = :uid WHERE ID = :userId`,
              { uid: uniqueUid, userId: row.ID }
            );
            updated = true;
          } catch (e) {
            uniqueUid = generateAccountUID();
            attempts++;
          }
        }
        console.log(`   - [USER ${row.ID}] Assigned UID: ${uniqueUid}`);
      }
      await connection.commit();
      console.log(`   - [SUCCESS] Backfilled ${usersRes.rows.length} users with unique UIDs`);
    } catch (err) {
      console.error('   - [ERROR] Failed backfilling UIDs:', err.message);
    }

    // 3. Add payment & transfer metadata columns to TRANSACTIONS
    console.log('3. Enhancing TRANSACTIONS table with payment & transfer fields...');
    const txColumns = [
      { col: 'PAYMENT_METHOD VARCHAR2(30)', name: 'PAYMENT_METHOD' },
      { col: 'PROVIDER_REF VARCHAR2(100)', name: 'PROVIDER_REF' },
      { col: 'SENDER_USER_ID NUMBER', name: 'SENDER_USER_ID' },
      { col: 'RECIPIENT_USER_ID NUMBER', name: 'RECIPIENT_USER_ID' },
      { col: 'RECIPIENT_UID VARCHAR2(30)', name: 'RECIPIENT_UID' },
      { col: 'DESCRIPTION VARCHAR2(500)', name: 'DESCRIPTION' },
      { col: 'FAILURE_REASON VARCHAR2(500)', name: 'FAILURE_REASON' },
      { col: 'IDEMPOTENCY_KEY VARCHAR2(100)', name: 'IDEMPOTENCY_KEY' }
    ];

    for (const item of txColumns) {
      try {
        await connection.execute(`ALTER TABLE TRANSACTIONS ADD (${item.col})`);
        console.log(`   - [SUCCESS] Added column ${item.name} to TRANSACTIONS`);
      } catch (err) {
        if (err.message.includes('ORA-01430') || err.message.includes('already exists')) {
          console.log(`   - [SKIPPED] Column ${item.name} already exists in TRANSACTIONS`);
        } else {
          console.warn(`   - [WARN] Adding ${item.name}: ${err.message}`);
        }
      }
    }

    // 4. Create Indexes
    console.log('4. Creating performance indexes...');
    const indexes = [
      { sql: `CREATE INDEX IDX_USERS_ACCOUNT_UID ON SL_USERS(ACCOUNT_UID)`, desc: 'IDX_USERS_ACCOUNT_UID' },
      { sql: `CREATE INDEX IDX_TX_IDEMPOTENCY ON TRANSACTIONS(IDEMPOTENCY_KEY)`, desc: 'IDX_TX_IDEMPOTENCY' },
      { sql: `CREATE INDEX IDX_TX_PROVIDER_REF ON TRANSACTIONS(PROVIDER_REF)`, desc: 'IDX_TX_PROVIDER_REF' },
      { sql: `CREATE INDEX IDX_TX_SENDER ON TRANSACTIONS(SENDER_USER_ID)`, desc: 'IDX_TX_SENDER' },
      { sql: `CREATE INDEX IDX_TX_RECIPIENT ON TRANSACTIONS(RECIPIENT_USER_ID)`, desc: 'IDX_TX_RECIPIENT' }
    ];

    for (const idx of indexes) {
      try {
        await connection.execute(idx.sql);
        console.log(`   - [SUCCESS] Created index ${idx.desc}`);
      } catch (err) {
        if (err.message.includes('ORA-00955') || err.message.includes('already exists') || err.message.includes('name is already used')) {
          console.log(`   - [SKIPPED] Index ${idx.desc} already exists`);
        } else {
          console.warn(`   - [WARN] Creating index ${idx.desc}: ${err.message}`);
        }
      }
    }

    await connection.commit();
    console.log('----------------------------------------------------');
    console.log('🎉 Database Schema Migration (v4) Completed Successfully!');
  } catch (err) {
    console.error('❌ Migration Failed:', err.message);
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
  migrate();
}

module.exports = { migrate, generateAccountUID };
