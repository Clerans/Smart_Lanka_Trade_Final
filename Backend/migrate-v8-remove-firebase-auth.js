const oracledb = require('oracledb');
require('dotenv').config({ quiet: true });

/**
 * SmartLanka Trade — Safe Firebase Authentication Cleanup Migration (v8)
 *
 * Safety specifications:
 * 1. Checks if SL_USERS.FIREBASE_UID exists.
 * 2. Checks if IDX_USERS_FIREBASE_UID or associated constraints exist.
 * 3. Inspects non-null count:
 *    - If non-null records exist (> 0), aborts destructive drop and reports:
 *      "FIREBASE DATA MIGRATION REQUIRED"
 *    - Never silently deletes user identity records.
 * 4. If count is 0, safely and idempotently drops legacy index, constraints, and column.
 * 5. Does not touch any other columns or tables.
 */

async function getDbConfig() {
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

  return config;
}

async function inspectFirebaseState(connection) {
  // 1. Check column existence in user_tab_cols
  const colRes = await connection.execute(
    `SELECT column_name, data_type, nullable 
     FROM user_tab_cols 
     WHERE table_name = 'SL_USERS' AND column_name = 'FIREBASE_UID'`,
    [],
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );
  const columnExists = Boolean(colRes.rows && colRes.rows.length > 0);

  // 2. Check index existence
  const idxRes = await connection.execute(
    `SELECT index_name 
     FROM user_indexes 
     WHERE table_name = 'SL_USERS' AND (index_name = 'IDX_USERS_FIREBASE_UID' OR index_name LIKE '%FIREBASE%')`,
    [],
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );
  const indexes = (idxRes.rows || []).map(r => r.INDEX_NAME);

  // 3. Check constraints
  const constRes = await connection.execute(
    `SELECT constraint_name, constraint_type 
     FROM user_constraints 
     WHERE table_name = 'SL_USERS' AND constraint_name LIKE '%FIREBASE%'`,
    [],
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );
  const constraints = (constRes.rows || []).map(r => r.CONSTRAINT_NAME);

  // 4. Count non-null rows if column exists
  let nonNullCount = 0;
  let totalCount = 0;
  if (columnExists) {
    const countRes = await connection.execute(
      `SELECT COUNT(*) AS CNT FROM SL_USERS WHERE FIREBASE_UID IS NOT NULL`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    nonNullCount = countRes.rows[0].CNT;

    const totalRes = await connection.execute(
      `SELECT COUNT(*) AS CNT FROM SL_USERS`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    totalCount = totalRes.rows[0].CNT;
  }

  return {
    columnExists,
    indexes,
    constraints,
    nonNullCount,
    totalCount
  };
}

async function migrate(options = {}) {
  console.log('--- Oracle Autonomous AI Database 26ai Schema Migration (v8 - Remove Firebase Auth) ---');
  let connection;

  try {
    const config = await getDbConfig();
    connection = await oracledb.getConnection(config);
    console.log('✅ Connected to Oracle Database.');

    const state = await inspectFirebaseState(connection);

    console.log(`- Column SL_USERS.FIREBASE_UID exists: ${state.columnExists}`);
    console.log(`- Associated Firebase indexes: [${state.indexes.join(', ')}]`);
    console.log(`- Associated Firebase constraints: [${state.constraints.join(', ')}]`);

    if (!state.columnExists && state.indexes.length === 0 && state.constraints.length === 0) {
      console.log('✅ [SKIPPED] No Firebase structures found in SL_USERS. Database is already clean.');
      return { success: true, status: 'ALREADY_CLEAN' };
    }

    if (state.columnExists) {
      console.log(`- Non-null FIREBASE_UID records: ${state.nonNullCount} (out of ${state.totalCount} total users)`);

      // Safety check: Abort if non-null records exist unless explicitly handled
      if (state.nonNullCount > 0 && !options.allowDropNonNull) {
        console.warn('========================================================================');
        console.warn('🚨 FIREBASE DATA MIGRATION REQUIRED');
        console.warn(`Found ${state.nonNullCount} user(s) with non-null FIREBASE_UID in SL_USERS.`);
        console.warn('Destructive database operation halted to protect user accounts.');
        console.warn('To proceed safely, review legacy accounts or back them up before removal.');
        console.warn('========================================================================');
        return {
          success: false,
          status: 'FIREBASE DATA MIGRATION REQUIRED',
          nonNullCount: state.nonNullCount
        };
      }
    }

    // 1. Drop index if exists
    for (const idx of state.indexes) {
      try {
        console.log(`Dropping index ${idx}...`);
        await connection.execute(`DROP INDEX ${idx}`);
        console.log(`   - [SUCCESS] Dropped index ${idx}`);
      } catch (idxErr) {
        if (idxErr.message && idxErr.message.includes('ORA-01418')) {
          console.log(`   - [SKIPPED] Index ${idx} does not exist (ORA-01418)`);
        } else {
          console.warn(`   - [WARN] Could not drop index ${idx}: ${idxErr.message}`);
        }
      }
    }

    // 2. Drop constraints if exists
    for (const cst of state.constraints) {
      try {
        console.log(`Dropping constraint ${cst}...`);
        await connection.execute(`ALTER TABLE SL_USERS DROP CONSTRAINT ${cst}`);
        console.log(`   - [SUCCESS] Dropped constraint ${cst}`);
      } catch (cstErr) {
        if (cstErr.message && cstErr.message.includes('ORA-02443')) {
          console.log(`   - [SKIPPED] Constraint ${cst} does not exist (ORA-02443)`);
        } else {
          console.warn(`   - [WARN] Could not drop constraint ${cst}: ${cstErr.message}`);
        }
      }
    }

    // 3. Drop column FIREBASE_UID if exists
    if (state.columnExists) {
      try {
        console.log('Dropping column FIREBASE_UID from SL_USERS...');
        await connection.execute(`ALTER TABLE SL_USERS DROP COLUMN FIREBASE_UID`);
        console.log('   - [SUCCESS] Dropped column FIREBASE_UID from SL_USERS');
      } catch (colErr) {
        if (colErr.message && colErr.message.includes('ORA-00904')) {
          console.log('   - [SKIPPED] Column FIREBASE_UID does not exist (ORA-00904)');
        } else {
          throw colErr;
        }
      }
    }

    await connection.commit();
    console.log('------------------------------------------------------------------------');
    console.log('🎉 Database Schema Migration (v8 - Remove Firebase Auth) Completed Successfully!');
    return { success: true, status: 'CLEANED' };

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

module.exports = { migrate, inspectFirebaseState };
