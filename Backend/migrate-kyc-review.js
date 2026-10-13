const oracledb = require('oracledb');
const connectDB = require('./config/db');
require('dotenv').config({ quiet: true });

async function migrateKYCReview() {
  console.log('--- Oracle Database Schema Migration: KYC Review & Confirmation Columns ---');
  let connection;
  try {
    await connectDB();
    connection = await oracledb.getConnection();

    const columnsToAdd = [
      { col: 'CONFIRMED_NAME', type: 'VARCHAR2(200)' },
      { col: 'CONFIRMED_DOB', type: 'VARCHAR2(50)' },
      { col: 'CONFIRMED_GENDER', type: 'VARCHAR2(20)' },
      { col: 'CONFIRMED_DATA', type: 'VARCHAR2(4000)' },
      { col: 'RAW_OCR_JSON', type: 'VARCHAR2(4000)' }
    ];

    for (const item of columnsToAdd) {
      try {
        await connection.execute(`ALTER TABLE KYC_DOCUMENTS ADD ${item.col} ${item.type}`);
        console.log(`   - [SUCCESS] Added column ${item.col} to KYC_DOCUMENTS`);
      } catch (err) {
        if (err.message.includes('ORA-01430') || err.message.includes('already exists')) {
          console.log(`   - [SKIPPED] Column ${item.col} already exists in KYC_DOCUMENTS`);
        } else {
          console.warn(`   - [WARN] Column ${item.col}: ${err.message}`);
        }
      }
    }

    await connection.commit();
    console.log('🎉 KYC Review Schema migration completed successfully!');
  } catch (error) {
    console.error('❌ KYC Review Migration failed:', error.message);
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) {}
    }
    process.exit(0);
  }
}

migrateKYCReview();
