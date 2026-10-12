/**
 * Backend/migrate-v9-password-reset-hardening.js
 * Migration to add ATTEMPTS, CREATED_AT tracking, and IDX_PWD_RESET_USER_EXP to SL_PASSWORD_RESET
 * Fully owner-aware and fails fast with post-migration verification.
 */

const oracledb = require('oracledb');
const db = require('./config/db');

async function resolveTableOwner(connection, tableName) {
  try {
    const contextRes = await connection.execute(
      `SELECT SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA') AS CURR_SCHEMA, SYS_CONTEXT('USERENV', 'SESSION_USER') AS SESS_USER FROM DUAL`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const currSchema = (contextRes.rows?.[0]?.CURR_SCHEMA || '').toUpperCase();
    const sessUser = (contextRes.rows?.[0]?.SESS_USER || '').toUpperCase();

    // Check USER_TABLES
    const userTab = await connection.execute(
      `SELECT TABLE_NAME FROM USER_TABLES WHERE TABLE_NAME = :tName`,
      [tableName],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (userTab.rows && userTab.rows.length > 0) {
      return { owner: currSchema || sessUser, qualifiedName: tableName };
    }

    // Check ALL_TABLES
    const allTabs = await connection.execute(
      `SELECT OWNER, TABLE_NAME FROM ALL_TABLES WHERE TABLE_NAME = :tName AND (OWNER = :currSchema OR OWNER = :sessUser)`,
      [tableName, currSchema, sessUser],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (allTabs.rows && allTabs.rows.length > 0) {
      const owner = allTabs.rows[0].OWNER.toUpperCase();
      return { owner, qualifiedName: `"${owner}"."${tableName}"` };
    }

    // Check ALL_SYNONYMS
    const synRes = await connection.execute(
      `SELECT TABLE_OWNER, TABLE_NAME FROM ALL_SYNONYMS WHERE SYNONYM_NAME = :tName AND (OWNER = :currSchema OR OWNER = 'PUBLIC')`,
      [tableName, currSchema],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (synRes.rows && synRes.rows.length > 0) {
      const owner = synRes.rows[0].TABLE_OWNER.toUpperCase();
      return { owner, qualifiedName: `"${owner}"."${tableName}"` };
    }

    return { owner: currSchema || sessUser, qualifiedName: tableName };
  } catch (err) {
    console.warn(`Could not resolve owner metadata for ${tableName}, falling back to current user:`, err.message);
    const fallback = (process.env.DB_USER || '').toUpperCase();
    return { owner: fallback, qualifiedName: tableName };
  }
}

async function runMigration() {
  console.log('🔄 Running Migration v9: Password Reset OTP Hardening...');
  let pool;
  let connection;

  try {
    pool = await db();
    connection = await pool.getConnection();

    // 1. Resolve table owner and qualified name
    const { owner, qualifiedName } = await resolveTableOwner(connection, 'SL_PASSWORD_RESET');
    console.log(`ℹ️ Resolved target table SL_PASSWORD_RESET on owner: [${owner}] (target: ${qualifiedName})`);

    // 2. Inspect existing columns in SL_PASSWORD_RESET
    const colRes = await connection.execute(
      `SELECT COLUMN_NAME FROM ALL_TAB_COLUMNS WHERE OWNER = :owner AND TABLE_NAME = 'SL_PASSWORD_RESET'`,
      [owner],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const existingCols = new Set((colRes.rows || []).map(r => r.COLUMN_NAME.toUpperCase()));

    // Add ATTEMPTS if missing
    if (!existingCols.has('ATTEMPTS')) {
      try {
        await connection.execute(`ALTER TABLE ${qualifiedName} ADD (ATTEMPTS NUMBER DEFAULT 0 NOT NULL)`);
        console.log(`✅ Added ATTEMPTS column to [${owner}].SL_PASSWORD_RESET`);
      } catch (err) {
        if (err.message && (err.message.includes('ORA-01430') || err.message.includes('already exists'))) {
          console.log(`ℹ️ ATTEMPTS column already exists on [${owner}].SL_PASSWORD_RESET`);
        } else {
          throw err;
        }
      }
    } else {
      console.log(`ℹ️ ATTEMPTS column already exists on [${owner}].SL_PASSWORD_RESET`);
    }

    // Add CREATED_AT if missing
    if (!existingCols.has('CREATED_AT')) {
      try {
        await connection.execute(`ALTER TABLE ${qualifiedName} ADD (CREATED_AT TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP)`);
        console.log(`✅ Added CREATED_AT column to [${owner}].SL_PASSWORD_RESET`);
      } catch (err) {
        if (err.message && (err.message.includes('ORA-01430') || err.message.includes('already exists'))) {
          console.log(`ℹ️ CREATED_AT column already exists on [${owner}].SL_PASSWORD_RESET`);
        } else {
          throw err;
        }
      }
    } else {
      console.log(`ℹ️ CREATED_AT column already exists on [${owner}].SL_PASSWORD_RESET`);
    }

    // 3. Check and add index IDX_PWD_RESET_USER_EXP
    const idxRes = await connection.execute(
      `SELECT INDEX_NAME FROM ALL_INDEXES WHERE TABLE_NAME = 'SL_PASSWORD_RESET' AND INDEX_NAME = 'IDX_PWD_RESET_USER_EXP' AND (OWNER = :owner OR TABLE_OWNER = :owner)`,
      [owner, owner],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (!idxRes.rows || idxRes.rows.length === 0) {
      try {
        await connection.execute(`
          CREATE INDEX IDX_PWD_RESET_USER_EXP ON ${qualifiedName} (USER_ID, EXPIRES_AT, USED)
        `);
        console.log(`✅ Created index IDX_PWD_RESET_USER_EXP on ${qualifiedName}`);
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

    // 4. Authoritative Post-migration verification
    const postColRes = await connection.execute(
      `SELECT COLUMN_NAME FROM ALL_TAB_COLUMNS WHERE OWNER = :owner AND TABLE_NAME = 'SL_PASSWORD_RESET'`,
      [owner],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const postCols = new Set((postColRes.rows || []).map(r => r.COLUMN_NAME.toUpperCase()));
    if (!postCols.has('ATTEMPTS') || !postCols.has('CREATED_AT')) {
      throw new Error(`Post-migration verification failed: Missing ATTEMPTS or CREATED_AT on [${owner}].SL_PASSWORD_RESET`);
    }

    const postIdxRes = await connection.execute(
      `SELECT INDEX_NAME FROM ALL_INDEXES WHERE TABLE_NAME = 'SL_PASSWORD_RESET' AND INDEX_NAME = 'IDX_PWD_RESET_USER_EXP' AND (OWNER = :owner OR TABLE_OWNER = :owner)`,
      [owner, owner],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (!postIdxRes.rows || postIdxRes.rows.length === 0) {
      throw new Error(`Post-migration verification failed: Missing required index IDX_PWD_RESET_USER_EXP on [${owner}].SL_PASSWORD_RESET`);
    }

    console.log(`🎉 Migration v9 completed and verified successfully: ATTEMPTS, CREATED_AT, and IDX_PWD_RESET_USER_EXP present in [${owner}].`);
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
