import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFDocument } from 'pdf-lib';
import { chunkReportText } from './chunkReportText.js';
import { saveChunksToFiles } from './saveChunks.js';

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Tests PDF text extraction using a custom approach
 * @param {string} filePath - Path to the PDF file
 * @param {string} outputPrefix - Prefix for output chunk files
 * @param {Object} options - Additional options
 */
// Keep this for now
export async function PdfExtraction(filePath, outputPrefix = 'test_chunks', options = {}) {
  try {
    console.log(`\n===== TESTING PDF EXTRACTION: ${filePath} =====\n`);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`File does not exist: ${filePath}`);
      return '';
    }
    
    // Read the file as buffer
    console.log(`Reading PDF file...`);
    const dataBuffer = fs.readFileSync(filePath);
    
    // Use a different approach - first check if it's a valid PDF
    try {
      await PDFDocument.load(dataBuffer);
      console.log("PDF validation successful - file is a valid PDF");
    } catch (err) {
      console.error("PDF validation failed - file may be corrupted:", err.message);
    }
    
    // Import the extractTextFromPdf function first
    const { extractTextFromPdf } = await import('./fileProcessing.js');
    
    // Now use the imported function
    console.log(`Extracting text using your existing function...`);
    const reportText = await extractTextFromPdf(filePath);
    
    console.log(`PDF extraction successful. Text length: ${reportText.length} characters\n`);
    
    // Show basic stats
    const lines = reportText.split('\n');
    console.log(`Number of lines: ${lines.length}`);
    
    // Process the chunks using the correct prefix
    console.log(`\n===== CHUNK TESTING =====\n`);
    const textChunks = chunkReportText(reportText, 100000, 200);
    
    // Use the outputPrefix parameter instead of hardcoded 'test_chunks'
    saveChunksToFiles(textChunks, outputPrefix);
    console.log(`\n===== CHUNK TESTING COMPLETE =====\n`);

    return reportText;
  } catch (error) {
    console.error('Error in PDF text extraction:', error);
    console.error(error.stack);
    return '';
  }
}