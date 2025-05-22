import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Only show startup message when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('\n===== REPORT CHUNKER SCRIPT STARTED =====');
  console.log(`Script path: ${import.meta.url}`);
  console.log(`Arguments: ${process.argv.join(', ')}`);
}

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
console.log(`Directory: ${__dirname}`);

/**
 * Chunks a credit report text into manageable sections for processing
 * @param {string} reportText - The full text of the credit report
 * @param {number} maxChunkSize - Maximum size of each chunk in characters (default: 10000)
 * @param {number} overlapSize - Number of characters to overlap between chunks (default: 200)
 * @return {Array<string>} Array of text chunks
 */
export function chunkReportText(reportText, maxChunkSize = 10000, overlapSize = 200) {
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
  const maxIterations = 1000; // Prevent infinite loops
  
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
 * Save chunks to disk for inspection (debugging utility)
 * @param {Array<string>} chunks - Array of text chunks
 * @param {string} prefix - Optional prefix for chunk filenames
 */
export function saveChunksToFiles(chunks, prefix = 'chunk') {
  try {
    // Create chunks directory if it doesn't exist
    const chunksDir = path.join(__dirname, '../chunks');
    if (!fs.existsSync(chunksDir)) {
      fs.mkdirSync(chunksDir, { recursive: true });
    }
    
    // Clear existing chunks with this prefix
    fs.readdirSync(chunksDir).forEach(file => {
      if (file.startsWith(prefix)) {
        try {
          fs.unlinkSync(path.join(chunksDir, file));
        } catch (err) {
          console.error(`Error removing file ${file}:`, err);
        }
      }
    });
    
    // Write new chunks
    chunks.forEach((chunk, i) => {
      try {
        const chunkPath = path.join(chunksDir, `${prefix}_${i+1}.txt`);
        fs.writeFileSync(chunkPath, chunk);
        console.log(`Saved ${prefix}_${i+1} to ${chunkPath} (${chunk.length} characters)`);
      } catch (err) {
        console.error(`Error saving chunk ${i+1}:`, err);
      }
    });
    
    console.log(`Saved ${chunks.length} chunks to ${chunksDir}`);
  } catch (error) {
    console.error('Error saving chunks to files:', error);
  }
}

// Simple test function that doesn't require arguments
function runSimpleTest() {
  console.log('\n===== RUNNING SIMPLE TEST =====');
  
  // Test with a simple string
  const testString = 'This is a test string.\nIt has multiple lines.\nLet\'s see if chunking works.';
  console.log(`Test string: "${testString}"`);
  
  try {
    const chunks = chunkReportText(testString, 20, 5);
    console.log(`Created ${chunks.length} chunks from test string`);
    
    chunks.forEach((chunk, i) => {
      console.log(`Chunk ${i+1}: "${chunk}"`);
    });
  } catch (error) {
    console.error('Error in simple test:', error);
  }
}

// If this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`\n===== REPORT CHUNKER TEST MODE =====`);
  
  // Use a hardcoded test file if no argument is provided
  const testFilePath = process.argv[2] || path.join(__dirname, '../package.json');
  
  console.log(`Testing with file: ${testFilePath}`);
  
  try {
    if (fs.existsSync(testFilePath)) {
      const fileText = fs.readFileSync(testFilePath, 'utf8');
      console.log(`File read successfully. Text length: ${fileText.length} characters`);
      
      const chunks = chunkReportText(fileText);
      console.log(`Created ${chunks.length} chunks`);
    } else {
      console.error(`Test file does not exist: ${testFilePath}`);
      runSimpleTest();
    }
  } catch (error) {
    console.error('Error:', error);
    runSimpleTest();
  }
} 