import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Saves chunks to text files for debugging and analysis
 * @param {Array<string>} chunks - Array of text chunks
 * @param {string} filePrefix - Prefix for the output files
 * @return {void}
 */
// Keep this for now
export function saveChunksToFiles(chunks, filePrefix) {
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