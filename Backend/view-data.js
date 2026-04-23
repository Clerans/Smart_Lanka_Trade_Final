const oracledb = require('oracledb');
require('dotenv').config();

async function viewData() {
  console.log('--- Viewing SmartLanka Tables ---');
  
  let connection;
  try {
    connection = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT
    });

    const tables = ['SL_USERS', 'SL_WALLETS'];

    for (const table of tables) {
      console.log(`\n📊 Table: ${table}`);
      const result = await connection.execute(
        `SELECT * FROM ${table}`,
        [],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      if (result.rows.length === 0) {
        console.log('   (Empty - No data yet)');
      } else {
        console.table(result.rows);
      }
    }

  } catch (err) {
    console.error('❌ Error viewing data:');
    console.error(err.message);
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

viewData();
