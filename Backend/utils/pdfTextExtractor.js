import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFDocument } from 'pdf-lib';

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Chunks a credit report text into manageable sections for processing
 * @param {string} reportText - The full text of the credit report
 * @param {number} maxChunkSize - Maximum size of each chunk in characters (default: 10000)
 * @param {number} overlapSize - Number of characters to overlap between chunks (default: 200)
 * @return {Array<string>} Array of text chunks
 */
function chunkReportText(reportText, maxChunkSize = 100000, overlapSize = 200) {
  console.log(`\n===== CHUNKING REPORT TEXT =====`);
  console.log(`Total text length: ${reportText ? reportText.length : 0} characters`);
  console.log(`Max chunk size: ${maxChunkSize}, Overlap size: ${overlapSize}`);
  
  if (!reportText || reportText.length === 0) {
    console.log(`Warning: Empty report text provided to chunker`);
    return [];
  }
  
  // Normalize line endings and whitespace
  const normalizedText = reportText
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  // If the text is small enough, return it as a single chunk
  if (normalizedText.length <= maxChunkSize) {
    console.log(`Text is small enough to process as a single chunk`);
    return [normalizedText];
  }
  
  // Split the text into chunks
  const chunks = [];
  let currentPosition = 0;
  
  // Safety check to prevent infinite loops
  let safetyCounter = 0;
  const maxIterations = 1000;
  
  while (currentPosition < normalizedText.length && safetyCounter < maxIterations) {
    safetyCounter++;
    
    // Determine end position for this chunk
    let endPosition = Math.min(currentPosition + maxChunkSize, normalizedText.length);
    
    // Try to find a paragraph break to split at
    if (endPosition < normalizedText.length) {
      const paragraphBreak = normalizedText.lastIndexOf('\n\n', endPosition);
      if (paragraphBreak > currentPosition && paragraphBreak > endPosition - maxChunkSize / 2) {
        endPosition = paragraphBreak + 2; // Include the paragraph break
      } else {
        // Try to find a line break
        const lineBreak = normalizedText.lastIndexOf('\n', endPosition);
        if (lineBreak > currentPosition && lineBreak > endPosition - maxChunkSize / 2) {
          endPosition = lineBreak + 1; // Include the line break
        }
      }
    }
    
    // Extract the chunk
    const chunk = normalizedText.substring(currentPosition, endPosition);
    chunks.push(chunk);
    
    // Move position for next chunk, including overlap
    const nextPosition = Math.max(currentPosition, endPosition - overlapSize);
    
    // Check if we're making progress
    if (nextPosition <= currentPosition) {
      console.log(`Warning: Chunking not making progress at position ${currentPosition}. Breaking loop.`);
      // Force progress by moving forward at least one character
      currentPosition = endPosition;
    } else {
      currentPosition = nextPosition;
    }
    
    // Debug output
    console.log(`Chunk ${chunks.length}: ${chunk.length} chars, Next position: ${currentPosition}/${normalizedText.length}`);
  }
  
  if (safetyCounter >= maxIterations) {
    console.log(`Warning: Reached maximum iterations (${maxIterations}). Chunking may be incomplete.`);
  }
  
  console.log(`Created ${chunks.length} chunks`);
  return chunks;
}

/**
 * Saves chunks to text files for debugging and analysis
 * @param {Array<string>} chunks - Array of text chunks
 * @param {string} filePrefix - Prefix for the output files
 * @return {void}
 */
function saveChunksToFiles(chunks, filePrefix) {
  if (!chunks || chunks.length === 0) {
    console.log('No chunks to save');
    return;
  }
  
  // Create chunks directory if it doesn't exist
  const chunksDir = path.join(__dirname, '../chunks');
  if (!fs.existsSync(chunksDir)) {
    fs.mkdirSync(chunksDir, { recursive: true });
  }
  
  // Save each chunk to a file
  chunks.forEach((chunk, index) => {
    const filePath = path.join(chunksDir, `${filePrefix}_${index + 1}.txt`);
    fs.writeFileSync(filePath, chunk);
    console.log(`Saved ${filePrefix}_${index + 1} to ${filePath} (${chunk.length} characters)`);
  });
  
  console.log(`Saved ${chunks.length} chunks to ${chunksDir}`);
}

/**
 * Tests PDF text extraction using a custom approach
 * @param {string} filePath - Path to the PDF file
 * @param {string} outputPrefix - Prefix for output chunk files
 * @param {Object} options - Additional options
 */
export async function testPdfExtraction(filePath, outputPrefix = 'test_chunks', options = {}) {
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

// Main function
/*async function main() {
  // Use the specific file path you provided
  const filePath = './uploads/1747722766395-Equifax_FACT_Rpt_06092014.pdf';
  
  if (!fs.existsSync(filePath)) {
    console.error(`File does not exist: ${filePath}`);
    process.exit(1);
  }
  
  //console.log(`Testing PDF extraction for: ${filePath}`);
  
  // Run the test
  await testPdfExtraction(filePath);
}*/

//main().catch(err => {
//  console.error('Error in main function:', err);
//  process.exit(1);
//});
