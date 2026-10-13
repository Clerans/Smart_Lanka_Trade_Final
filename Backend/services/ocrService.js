const { createWorker } = require('tesseract.js');
const fs = require('fs');

/**
 * OCR Service using Tesseract.js
 * Extracts raw textual data and recognition confidence from identity document images
 * Features intelligent multi-orientation recognition (handles portrait/vertical photos taken by mobile devices)
 */

/**
 * Recognizes text from image file path or buffer with orientation awareness
 * @param {string|Buffer} imageInput - File path or buffer
 * @returns {Promise<{ text: string, confidence: number, lines: string[] }>}
 */
async function recognizeText(imageInput) {
  let worker = null;
  try {
    worker = await createWorker('eng', 1, {
      errorHandler: (err) => console.error('Tesseract Worker Internal Warning:', err)
    });
    
    // 1. Initial text recognition (standard 0 deg)
    const ret0 = await worker.recognize(imageInput);
    let bestResult = {
      text: ret0.data.text || '',
      confidence: parseFloat((ret0.data.confidence || 0).toFixed(2)),
      lines: ret0.data.lines ? ret0.data.lines.map(l => l.text.trim()).filter(Boolean) : []
    };

    let bestAlpha = (bestResult.text.match(/[a-zA-Z0-9]/g) || []).length;

    // 2. If confidence is low (< 60%) or few alphanumeric characters found (common when mobile photo is rotated),
    // test 90°, 180°, and 270° orientations and pick the orientation with clearest card text.
    if (bestResult.confidence < 60 || bestAlpha < 30) {
      for (const angle of [90, 180, 270]) {
        try {
          const rotRet = await worker.recognize(imageInput, {
            rotateRadians: (angle * Math.PI) / 180
          });
          const rotText = rotRet.data.text || '';
          const rotConf = parseFloat((rotRet.data.confidence || 0).toFixed(2));
          const rotAlpha = (rotText.match(/[a-zA-Z0-9]/g) || []).length;

          // If rotation yields significantly more readable alphanumeric characters, adopt it
          if (rotAlpha > bestAlpha + 10 || (rotAlpha >= bestAlpha && rotConf > bestResult.confidence + 10)) {
            bestResult = {
              text: rotText,
              confidence: rotConf,
              lines: rotRet.data.lines ? rotRet.data.lines.map(l => l.text.trim()).filter(Boolean) : []
            };
            bestAlpha = rotAlpha;
          }
        } catch (rotErr) {
          // ignore rotation attempt error
        }
      }
    }

    return bestResult;
  } catch (error) {
    console.error('❌ Tesseract OCR recognition error:', error.message);
    throw new Error(`OCR Processing Failed: ${error.message}`);
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch (termErr) {
        // ignore termination errors
      }
    }
  }
}

module.exports = {
  recognizeText
};
