const oracledb = require('oracledb');
const connectDB = require('./config/db');

async function migrate() {
  let conn;
  try {
    await connectDB();
    conn = await oracledb.getConnection();

    // Check existing columns
    const res = await conn.execute(
      "SELECT COLUMN_NAME FROM USER_TAB_COLS WHERE TABLE_NAME = 'SL_USERS'",
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const existingCols = res.rows.map(r => r.COLUMN_NAME);

    if (!existingCols.includes('PHONE_NUMBER')) {
      console.log('Adding PHONE_NUMBER column to SL_USERS...');
      await conn.execute("ALTER TABLE SL_USERS ADD (PHONE_NUMBER VARCHAR2(30))");
      console.log('✅ Added PHONE_NUMBER');
    } else {
      console.log('PHONE_NUMBER column already exists');
    }

    if (!existingCols.includes('PROFILE_IMAGE')) {
      console.log('Adding PROFILE_IMAGE column to SL_USERS...');
      await conn.execute("ALTER TABLE SL_USERS ADD (PROFILE_IMAGE CLOB)");
      console.log('✅ Added PROFILE_IMAGE');
    } else {
      console.log('PROFILE_IMAGE column already exists');
    }

    await conn.commit();
    console.log('🎉 Migration completed successfully.');
  } catch (err) {
    console.error('❌ Migration error:', err);
  } finally {
    if (conn) await conn.close();
    process.exit(0);
  }
}

migrate();
