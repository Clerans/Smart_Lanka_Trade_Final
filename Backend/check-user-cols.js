const oracledb = require('oracledb');
const connectDB = require('./config/db');

async function check() {
  let conn;
  try {
    await connectDB();
    conn = await oracledb.getConnection();
    const res = await conn.execute(
      "SELECT COLUMN_NAME, DATA_TYPE, DATA_LENGTH FROM USER_TAB_COLS WHERE TABLE_NAME = 'SL_USERS'",
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    console.log("SL_USERS COLUMNS:\n", JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error("Error:", err);
  } finally {
    if (conn) await conn.close();
    process.exit(0);
  }
}

check();
