import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

/**
 * Extracts plain text from a file buffer based on its MIME type.
 * Caps the output at 4,000 characters.
 * @param {Buffer} buffer - File buffer
 * @param {string} mimeType - File mime type
 * @returns {Promise<string>} Extracted text
 */
export const extractText = async (buffer, mimeType) => {
  try {
    let extractedText = '';

    if (mimeType === 'application/pdf') {
      const data = await pdf(buffer);
      extractedText = data.text || '';
    } else if (mimeType === 'text/plain') {
      extractedText = buffer.toString('utf-8');
    } else if (mimeType.startsWith('image/')) {
      // Images (PNG, JPG, JPEG) are out-of-scope for OCR, return empty string as per task.md
      extractedText = '';
    }

    // Cap output at 4000 characters
    return extractedText.substring(0, 4000).trim();
  } catch (error) {
    console.error('Error extracting text from file:', error.message);
    throw new Error(`Text extraction failed: ${error.message}`);
  }
};
