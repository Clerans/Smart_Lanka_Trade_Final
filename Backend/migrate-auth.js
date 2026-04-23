const oracledb = require('oracledb');
require('dotenv').config();

async function migrate() {
  let connection;
  try {
    connection = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT
    });

    console.log('Migrating SL_USERS table...');
    
    await connection.execute(`
      ALTER TABLE SL_USERS 
      ADD (
        IS_VERIFIED NUMBER(1) DEFAULT 0,
        VERIFICATION_TOKEN VARCHAR2(255)
      )
    `);

    await connection.commit();
    console.log('✅ Migration successful! Added IS_VERIFIED and VERIFICATION_TOKEN.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    if (connection) await connection.close();
  }
}

migrate();
