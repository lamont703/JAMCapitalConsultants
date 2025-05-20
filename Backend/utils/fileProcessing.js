import fs from 'fs';
import { promisify } from 'util';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { createWorker } from 'tesseract.js';

const readFile = promisify(fs.readFile);

/**
 * Extracts text content from a PDF file
 * @param {string} filePath - Path to the PDF file
 * @returns {Promise<string>} - Extracted text content
 */
export async function extractTextFromPdf(filePath) {
  try {
    console.log(`Processing PDF file: ${filePath}`);
    const dataBuffer = await readFile(filePath);
    
    // Use pdf-parse directly without relying on its test files
    const data = await pdfParse(dataBuffer);
    
    console.log(`Successfully extracted ${data.text.length} characters from PDF`);
    return data.text;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    return `[Error extracting PDF text: ${error.message}]`;
  }
}

/**
 * Extracts text content from an image file using OCR
 * @param {string} filePath - Path to the image file
 * @returns {Promise<string>} - Extracted text content
 */
export async function extractTextFromImage(filePath) {
  console.log(`Processing image file with OCR: ${filePath}`);
  let worker;
  
  try {
    worker = await createWorker('eng');
    const { data: { text } } = await worker.recognize(filePath);
    console.log(`Successfully extracted ${text.length} characters from image using OCR`);
    return text;
  } catch (error) {
    console.error('Error extracting text from image:', error);
    return `[Error extracting image text: ${error.message}]`;
  } finally {
    if (worker) {
      await worker.terminate();
    }
  }
}

/**
 * Processes a credit report file and extracts relevant information
 * @param {string} filePath - Path to the file
 * @param {string} mimeType - MIME type of the file
 * @returns {Promise<string>} - Extracted and processed text
 */
export async function processCreditReportFile(filePath, mimeType) {
  console.log(`Processing credit report file: ${filePath} (${mimeType})`);
  
  try {
    let extractedText = '';
    
    if (mimeType === 'application/pdf') {
      extractedText = await extractTextFromPdf(filePath);
    } else if (mimeType.startsWith('image/')) {
      extractedText = await extractTextFromImage(filePath);
    } else {
      throw new Error(`Unsupported file type: ${mimeType}`);
    }
    
    // Basic preprocessing of the extracted text
    const processedText = extractedText
      .replace(/\s+/g, ' ')  // Replace multiple spaces with a single space
      .trim();
    
    console.log(`Processed text length: ${processedText.length} characters`);
    return processedText;
  } catch (error) {
    console.error(`Error processing credit report file: ${filePath}`, error);
    return `[Error processing file: ${error.message}]`;
  }
} 