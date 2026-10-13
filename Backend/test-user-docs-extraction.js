const path = require('path');
const fs = require('fs');
const { recognizeText } = require('./services/ocrService');
const { extractIdentityDocument } = require('./utils/documentParser');

const uploadsDir = 'C:\\Users\\krish\\.gemini\\antigravity-ide\\brain\\01d17176-b802-44a2-b6e5-d1a91c078cc6\\.user_uploaded';

const dlFrontPath = path.join(uploadsDir, 'media_1791880593059.jpg');
const dlBackPath = path.join(uploadsDir, 'media_1791880592952.jpg');
const nicFrontPath = path.join(uploadsDir, 'media_1791880593134.jpg');
const nicBackPath = path.join(uploadsDir, 'media_1791880593006.jpg');

async function testUserDocs() {
  console.log('====================================================');
  console.log('Testing Real User Documents Extraction with Tesseract');
  console.log('====================================================\n');

  console.log('1. Extracting Driving Licence (Front)...');
  const dlFront = await recognizeText(dlFrontPath);
  console.log(`- DL Front confidence: ${dlFront.confidence}%`);
  console.log(`- DL Front lines: ${dlFront.lines.length}`);
  console.log('- DL Front Raw text snippet:\n', dlFront.text.substring(0, 300), '\n');

  console.log('2. Extracting Driving Licence (Back)...');
  const dlBack = await recognizeText(dlBackPath);
  console.log(`- DL Back confidence: ${dlBack.confidence}%`);
  console.log(`- DL Back lines: ${dlBack.lines.length}`);
  console.log('- DL Back Raw text snippet:\n', dlBack.text.substring(0, 300), '\n');

  console.log('3. Parsing Combined Driving Licence details...');
  const dlParsed = extractIdentityDocument(dlFront.text, dlBack.text, 'DRIVING_LICENCE');
  console.log('DL Extracted Fields:', JSON.stringify(dlParsed.extractedFields, null, 2));
  console.log('DL Field Sources:', JSON.stringify(dlParsed.fieldSources, null, 2));

  console.log('\n----------------------------------------------------\n');

  console.log('4. Extracting NIC (Front)...');
  const nicFront = await recognizeText(nicFrontPath);
  console.log(`- NIC Front confidence: ${nicFront.confidence}%`);
  console.log(`- NIC Front lines: ${nicFront.lines.length}`);
  console.log('- NIC Front Raw text snippet:\n', nicFront.text.substring(0, 300), '\n');

  console.log('5. Extracting NIC (Back)...');
  const nicBack = await recognizeText(nicBackPath);
  console.log(`- NIC Back confidence: ${nicBack.confidence}%`);
  console.log(`- NIC Back lines: ${nicBack.lines.length}`);
  console.log('- NIC Back Raw text snippet:\n', nicBack.text.substring(0, 300), '\n');

  console.log('6. Parsing Combined NIC details...');
  const nicParsed = extractIdentityDocument(nicFront.text, nicBack.text, 'NIC');
  console.log('NIC Extracted Fields:', JSON.stringify(nicParsed.extractedFields, null, 2));
  console.log('NIC Field Sources:', JSON.stringify(nicParsed.fieldSources, null, 2));
  console.log('\n====================================================');
}

testUserDocs().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
