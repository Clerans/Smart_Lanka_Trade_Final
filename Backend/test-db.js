const oracledb = require('oracledb');
require('dotenv').config();

async function testConnection() {
  console.log('--- Oracle Connection Test ---');
  console.log('Connecting with:');
  console.log(`User: ${process.env.DB_USER}`);
  console.log(`Connect String: ${process.env.DB_CONNECT}`);
  console.log('------------------------------');

  let connection;
  try {
    connection = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT
    });

    console.log('✅ Connection Successful!');
    
    // Check if the tables exist
    const result = await connection.execute(
      `SELECT table_name FROM user_tables WHERE table_name LIKE 'SL_%'`
    );
    
    if (result.rows.length > 0) {
      console.log('✅ Found SmartLanka Tables:');
      result.rows.forEach(row => console.log(`   - ${row[0]}`));
    } else {
      console.log('⚠️ Connection successful, but SL_ tables were not found.');
      console.log('   Did you run the schema.sql script?');
    }

  } catch (err) {
    console.error('❌ Connection Failed:');
    console.error(err.message);
    
    if (err.message.includes('DPI-1047')) {
      console.log('\n💡 TIP: It looks like Oracle Instant Client is missing.');
      console.log('Please download it and add it to your PATH.');
    }
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

testConnection();
