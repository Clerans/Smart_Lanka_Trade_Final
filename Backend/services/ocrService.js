const { createWorker } = require('tesseract.js');
const fs = require('fs');

/**
 * OCR Service using Tesseract.js
 * Extracts raw textual data and recognition confidence from identity document images
 */

/**
 * Recognizes text from image file path or buffer
 * @param {string|Buffer} imageInput - File path or buffer
 * @returns {Promise<{ text: string, confidence: number }>}
 */
async function recognizeText(imageInput) {
  let worker = null;
  try {
    worker = await createWorker('eng');
    
    // Perform text recognition
    const ret = await worker.recognize(imageInput);
    
    const text = ret.data.text || '';
    const confidence = parseFloat((ret.data.confidence || 0).toFixed(2));

    return {
      text,
      confidence,
      lines: ret.data.lines ? ret.data.lines.map(l => l.text.trim()).filter(Boolean) : []
    };
  } catch (error) {
    console.error('❌ Tesseract OCR recognition error:', error.message);
    throw new Error(`OCR Processing Failed: ${error.message}`);
  } finally {
    if (worker) {
      await worker.terminate();
    }
  }
}

module.exports = {
  recognizeText
};
