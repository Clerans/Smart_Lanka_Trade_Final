const oracledb = require('oracledb');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function setupDatabase() {
  console.log('--- Oracle Database Setup ---');
  
  let connection;
  try {
    connection = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT
    });

    console.log('✅ Connected to Oracle. Reading schema.sql...');

    const schemaPath = path.join(__dirname, 'schema.sql');
    const sqlScript = fs.readFileSync(schemaPath, 'utf8');

    // Split script into individual commands (by semicolon)
    // We filter out empty lines and trim whitespace
    const commands = sqlScript
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0);

    console.log(`🚀 Executing ${commands.length} SQL commands...`);

    for (const cmd of commands) {
      try {
        await connection.execute(cmd);
        // Extract the first word for logging (CREATE, INSERT, etc)
        const type = cmd.split(' ')[0].toUpperCase();
        console.log(`   - ${type} executed successfully.`);
      } catch (err) {
        console.error(`   ❌ Error executing command: ${cmd.substring(0, 50)}...`);
        console.error(`   Reason: ${err.message}`);
      }
    }

    await connection.commit();
    console.log('------------------------------');
    console.log('🎉 Database Setup Complete!');

  } catch (err) {
    console.error('❌ Setup Failed:');
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

setupDatabase();
