// Debug script to test the integration between chatController and reportChunker
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('\n===== TESTING INTEGRATION BETWEEN CHATCONTROLLER AND REPORTCHUNKER =====');

// Step 1: Import the reportChunker module
console.log('\nStep 1: Importing reportChunker module...');
import('./utils/reportChunker.js')
  .then(reportChunker => {
    console.log('Successfully imported reportChunker module');
    
    // Step 2: Create a test string
    const testString = 'This is a test string.\nIt has multiple lines.\nLet\'s see if chunking works.';
    console.log(`\nStep 2: Created test string (${testString.length} characters)`);
    
    // Step 3: Call the chunkReportText function
    console.log('\nStep 3: Calling chunkReportText function...');
    const chunks = reportChunker.chunkReportText(testString, 20, 5);
    
    // Step 4: Check the results
    console.log(`\nStep 4: Checking results - Created ${chunks.length} chunks`);
    chunks.forEach((chunk, i) => {
      console.log(`Chunk ${i+1}: "${chunk}"`);
    });
    
    // Step 5: Test with a real file if available
    console.log('\nStep 5: Testing with a real file if available...');
    const testFilePath = path.join(__dirname, 'package.json');
    
    if (fs.existsSync(testFilePath)) {
      console.log(`Reading file: ${testFilePath}`);
      const fileText = fs.readFileSync(testFilePath, 'utf8');
      console.log(`File read successfully. Text length: ${fileText.length} characters`);
      
      console.log('Chunking file text...');
      const fileChunks = reportChunker.chunkReportText(fileText, 500, 50);
      console.log(`Created ${fileChunks.length} chunks from file`);
    } else {
      console.log(`Test file not found: ${testFilePath}`);
    }
    
    console.log('\n===== INTEGRATION TEST COMPLETED SUCCESSFULLY =====');
  })
  .catch(error => {
    console.error('\n===== ERROR IN INTEGRATION TEST =====');
    console.error(error);
  }); 