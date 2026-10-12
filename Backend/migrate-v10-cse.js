/**
 * Backend/migrate-v10-cse.js
 * Migration to add ASSET_TYPE column to PORTFOLIOS and TRANSACTIONS tables.
 * Defaults to 'CRYPTO' to preserve 100% backward compatibility with existing holdings and orders.
 * Fully idempotent, owner-aware, with automatic verification and reversible rollback.
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

    const userTab = await connection.execute(
      `SELECT TABLE_NAME FROM USER_TABLES WHERE TABLE_NAME = :tName`,
      [tableName],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (userTab.rows && userTab.rows.length > 0) {
      return { owner: currSchema || sessUser, qualifiedName: tableName };
    }

    const allTabs = await connection.execute(
      `SELECT OWNER, TABLE_NAME FROM ALL_TABLES WHERE TABLE_NAME = :tName AND (OWNER = :currSchema OR OWNER = :sessUser)`,
      [tableName, currSchema, sessUser],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (allTabs.rows && allTabs.rows.length > 0) {
      const owner = allTabs.rows[0].OWNER.toUpperCase();
      return { owner, qualifiedName: `"${owner}"."${tableName}"` };
    }

    return { owner: currSchema || sessUser, qualifiedName: tableName };
  } catch (err) {
    const fallback = (process.env.DB_USER || '').toUpperCase();
    return { owner: fallback, qualifiedName: tableName };
  }
}

async function columnExists(connection, owner, tableName, columnName) {
  const result = await connection.execute(
    `SELECT COLUMN_NAME FROM ALL_TAB_COLUMNS 
     WHERE OWNER = :owner AND TABLE_NAME = :tableName AND COLUMN_NAME = :colName`,
    { owner, tableName, colName: columnName.toUpperCase() },
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );
  return result.rows && result.rows.length > 0;
}

async function runMigration() {
  let pool;
  let connection;
  try {
    console.log('[MIGRATE-V10-CSE] Connecting to Oracle Database...');
    pool = await db();
    connection = await pool.getConnection();
    console.log('[MIGRATE-V10-CSE] Successfully acquired database connection.');

    // 1. Resolve PORTFOLIOS & TRANSACTIONS
    const portfoliosMeta = await resolveTableOwner(connection, 'PORTFOLIOS');
    const transactionsMeta = await resolveTableOwner(connection, 'TRANSACTIONS');

    console.log(`[MIGRATE-V10-CSE] Target tables: PORTFOLIOS (${portfoliosMeta.qualifiedName}), TRANSACTIONS (${transactionsMeta.qualifiedName})`);

    // 2. Add ASSET_TYPE to PORTFOLIOS if missing
    const hasPortfolioAssetType = await columnExists(connection, portfoliosMeta.owner, 'PORTFOLIOS', 'ASSET_TYPE');
    if (!hasPortfolioAssetType) {
      console.log('[MIGRATE-V10-CSE] Adding ASSET_TYPE column to PORTFOLIOS...');
      await connection.execute(
        `ALTER TABLE ${portfoliosMeta.qualifiedName} ADD (ASSET_TYPE VARCHAR2(10) DEFAULT 'CRYPTO' NOT NULL)`
      );
      console.log('[MIGRATE-V10-CSE] Column ASSET_TYPE added to PORTFOLIOS successfully.');
    } else {
      console.log('[MIGRATE-V10-CSE] Column ASSET_TYPE already exists on PORTFOLIOS. Skipping.');
    }

    // 3. Add ASSET_TYPE to TRANSACTIONS if missing
    const hasTxAssetType = await columnExists(connection, transactionsMeta.owner, 'TRANSACTIONS', 'ASSET_TYPE');
    if (!hasTxAssetType) {
      console.log('[MIGRATE-V10-CSE] Adding ASSET_TYPE column to TRANSACTIONS...');
      await connection.execute(
        `ALTER TABLE ${transactionsMeta.qualifiedName} ADD (ASSET_TYPE VARCHAR2(10) DEFAULT 'CRYPTO' NOT NULL)`
      );
      console.log('[MIGRATE-V10-CSE] Column ASSET_TYPE added to TRANSACTIONS successfully.');
    } else {
      console.log('[MIGRATE-V10-CSE] Column ASSET_TYPE already exists on TRANSACTIONS. Skipping.');
    }

    await connection.commit();

    // 4. Post-migration verification
    const verifyPortfolios = await columnExists(connection, portfoliosMeta.owner, 'PORTFOLIOS', 'ASSET_TYPE');
    const verifyTx = await columnExists(connection, transactionsMeta.owner, 'TRANSACTIONS', 'ASSET_TYPE');

    if (!verifyPortfolios || !verifyTx) {
      throw new Error('[MIGRATE-V10-CSE] Verification failed: ASSET_TYPE column was not detected post-migration.');
    }

    console.log('[MIGRATE-V10-CSE] Verification passed: PORTFOLIOS and TRANSACTIONS both support ASSET_TYPE.');
    console.log('[MIGRATE-V10-CSE] Migration V10 completed successfully.');
    return true;
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (_) {}
    }
    console.error('[MIGRATE-V10-CSE] Migration failed:', error.message);
    throw error;
  } finally {
    if (connection) {
      try { await connection.close(); } catch (_) {}
    }
  }
}

async function rollbackMigration() {
  let pool;
  let connection;
  try {
    console.log('[MIGRATE-V10-CSE] Reversing Migration V10...');
    pool = await db();
    connection = await pool.getConnection();

    const portfoliosMeta = await resolveTableOwner(connection, 'PORTFOLIOS');
    const transactionsMeta = await resolveTableOwner(connection, 'TRANSACTIONS');

    try {
      await connection.execute(`ALTER TABLE ${portfoliosMeta.qualifiedName} DROP COLUMN ASSET_TYPE`);
      console.log('[MIGRATE-V10-CSE] Dropped ASSET_TYPE from PORTFOLIOS.');
    } catch (e) {
      console.warn('[MIGRATE-V10-CSE] Drop ASSET_TYPE from PORTFOLIOS skipped:', e.message);
    }

    try {
      await connection.execute(`ALTER TABLE ${transactionsMeta.qualifiedName} DROP COLUMN ASSET_TYPE`);
      console.log('[MIGRATE-V10-CSE] Dropped ASSET_TYPE from TRANSACTIONS.');
    } catch (e) {
      console.warn('[MIGRATE-V10-CSE] Drop ASSET_TYPE from TRANSACTIONS skipped:', e.message);
    }

    await connection.commit();
    console.log('[MIGRATE-V10-CSE] Rollback completed.');
  } finally {
    if (connection) {
      try { await connection.close(); } catch (_) {}
    }
  }
}

module.exports = {
  runMigration,
  rollbackMigration
};

if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
