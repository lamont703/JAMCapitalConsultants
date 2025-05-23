import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractTextFromImage } from '../utils/fileProcessing.js';
import { testPdfExtraction } from '../utils/pdfTextExtractor.js';
import { generateDisputeResponse, analyzeCreditReports, generateDisputeLetter } from '../utils/chatGptService.js';
import crypto from 'crypto';
import { ensureCacheDirectory, cleanupCache, clearCache, getCacheStats } from '../utils/cacheManager.js';
import { analyzeChunks, analyzeChunksFromFiles, comprehensiveAnalyzeChunksFromFiles } from '../utils/gptAnalyzer.js';

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the extractTextFromFiles function
async function extractTextFromFiles(files) {
  let combinedText = '';
  
  //console.log(`\n===== PROCESSING ${files.length} CREDIT REPORT FILES =====\n`);
  
  for (const file of files) {
    try {
      console.log(`\n----- Processing file: ${file.originalname} (${file.mimetype}) -----`);
      let extractedText = '';
      
      // Extract text based on file type
      if (file.mimetype === 'application/pdf') {
        console.log(`Extracting text from PDF file: ${file.path}`);
        extractedText = await testPdfExtraction(file.path);
        console.log(`Extracted ${extractedText.length} characters from PDF`);
      } else if (file.mimetype.startsWith('image/')) {
        console.log(`Extracting text from image file: ${file.path}`);
        extractedText = await extractTextFromImage(file.path);
        console.log(`Extracted ${extractedText.length} characters from image`);
      } else {
        console.log(`Reading text from file: ${file.path}`);
        extractedText = fs.readFileSync(file.path, 'utf8');
        console.log(`Read ${extractedText.length} characters from file`);
      }
      
      // Add to combined text
      combinedText += extractedText + '\n\n';
      
      console.log(`Text sample (first 200 chars): ${extractedText.substring(0, 200)}...`);
    } catch (error) {
      console.error(`Error processing file ${file.originalname}:`, error);
    }
  }
  
  return combinedText;
}

export const chatController = {
  // Handle regular chat messages
  async sendMessage(req, res) {
    try {
      const { message } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }
      
      console.log(`Received message: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`);
      
      // Generate response using GPT
      const response = await generateDisputeResponse(message);
      
      return res.json({ response });
    } catch (error) {
      console.error('Error in sendMessage:', error);
      return res.status(500).json({ error: 'Failed to process message' });
    }
  },
  
  // Analyze credit reports
  async analyzeReports(req, res) {
    try {
      console.log('\n===== ANALYZING CREDIT REPORTS =====\n');
      
      // Check if files were uploaded
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }
      
      console.log(`Received ${req.files.length} files for analysis`);
      
      // Generate a unique ID for this analysis session
      const sessionId = crypto.randomBytes(8).toString('hex');
      console.log(`Analysis session ID: ${sessionId}`);
      
      // Create cache directory if it doesn't exist
      ensureCacheDirectory();
      
      // Create a cache file path for this analysis
      const cacheFilePath = path.join(__dirname, `../cache/analysis_${sessionId}.json`);
      
      // Clean up old cache files
      cleanupCache();
      
      // Track processed files
      const processedFiles = [];
      
      // Create a directory for chunks
      const chunksDir = path.join(__dirname, '../chunks');
      if (!fs.existsSync(chunksDir)) {
        fs.mkdirSync(chunksDir, { recursive: true });
      }
      
      // Process each file
      let allDisputableItems = [];
      
      for (const file of req.files) {
        try {
          console.log(`\n----- Processing file: ${file.originalname} -----`);
          console.log(`File type: ${file.mimetype}, Size: ${file.size} bytes`);
          
          // Generate a unique prefix for this file's chunks
          const filePrefix = `${sessionId}_${path.basename(file.originalname, path.extname(file.originalname))}`;
          
          // Extract text based on file type
          if (file.mimetype === 'application/pdf') {
            console.log(`Extracting text from PDF file: ${file.path}`);
            
            // Debug: Check if file exists and is readable
            if (!fs.existsSync(file.path)) {
              console.error(`PDF file does not exist: ${file.path}`);
              continue;
            }
            
            // Use testPdfExtraction which handles both extraction and chunking
            await testPdfExtraction(file.path, filePrefix, { silent: false });
            
            // Debug: Check if chunks were created
            const chunkFiles = fs.readdirSync(chunksDir)
              .filter(f => f.startsWith(filePrefix));
            
            console.log(`Found ${chunkFiles.length} chunk files for ${file.originalname}`);
            
            if (chunkFiles.length === 0) {
              console.error(`No chunks were created for ${file.originalname}`);
              continue;
            }
            
            // Debug: Check content of first chunk
            const firstChunkPath = path.join(chunksDir, chunkFiles[0]);
            const chunkContent = fs.readFileSync(firstChunkPath, 'utf8');
            console.log(`First chunk contains ${chunkContent.length} characters`);
            console.log(`Sample content: ${chunkContent.substring(0, 200)}...`);
            
            // Now analyze the chunks using gptAnalyzer
            console.log(`Analyzing chunks for ${file.originalname}...`);
            const pdfDisputableItems = await comprehensiveAnalyzeChunksFromFiles(chunksDir, filePrefix, { showOutput: true });
            
            console.log(`Found ${pdfDisputableItems.length} disputable items in ${file.originalname}`);
            allDisputableItems.push(...pdfDisputableItems);
            
            // Store the processed file info
            processedFiles.push({
              filename: file.originalname,
              path: file.path,
              chunks: chunkFiles.length,
              items: pdfDisputableItems.length
            });
          } 
          else if (file.mimetype.startsWith('image/')) {
            console.log(`Extracting text from image file: ${file.path}`);
            const extractedText = await extractTextFromImage(file.path);
            
            // Save the extracted text to a chunk file
            const chunkPath = path.join(chunksDir, `${filePrefix}_1.txt`);
            fs.writeFileSync(chunkPath, extractedText);
            
            // Analyze the chunk
            console.log(`Analyzing text from image ${file.originalname}...`);
            const imageDisputableItems = await comprehensiveAnalyzeChunksFromFiles(chunksDir, filePrefix, { showOutput: false });
            
            console.log(`Found ${imageDisputableItems.length} disputable items in ${file.originalname}`);
            allDisputableItems.push(...imageDisputableItems);
            
            // Store the processed file info
            processedFiles.push({
              filename: file.originalname,
              path: file.path,
              textLength: extractedText.length,
              items: imageDisputableItems.length
            });
          } 
          else {
            console.log(`Reading text from file: ${file.path}`);
            const extractedText = fs.readFileSync(file.path, 'utf8');
            
            // Save the extracted text to a chunk file
            const chunkPath = path.join(chunksDir, `${filePrefix}_1.txt`);
            fs.writeFileSync(chunkPath, extractedText);
            
            // Analyze the chunk
            console.log(`Analyzing text from ${file.originalname}...`);
            const textDisputableItems = await comprehensiveAnalyzeChunksFromFiles(chunksDir, filePrefix, { showOutput: false });
            
            console.log(`Found ${textDisputableItems.length} disputable items in ${file.originalname}`);
            allDisputableItems.push(...textDisputableItems);
            
            // Store the processed file info
            processedFiles.push({
              filename: file.originalname,
              path: file.path,
              textLength: extractedText.length,
              items: textDisputableItems.length
            });
          }
          
          console.log(`\n----- Completed processing ${file.originalname} -----`);
          
        } catch (error) {
          console.error(`Error processing file ${file.originalname}:`, error);
          // Continue with other files even if one fails
        }
      }
      
      // Generate a summary and detailed analysis using GPT
      console.log(`\nGenerating analysis for ${allDisputableItems.length} disputable items...`);
      
      // Convert disputable items to a string for the GPT analysis
      const itemsForAnalysis = JSON.stringify(allDisputableItems, null, 2);
      const analysisResult = await analyzeCreditReports(itemsForAnalysis, true);
      
      // Format the analysis for display
      const formattedAnalysis = analysisResult.detailedAnalysis.replace(/\n/g, '<br>');
      
      // Prepare response object with both structured and formatted data
      const responseObj = {
        summary: analysisResult.summary,
        analysis: analysisResult.detailedAnalysis,
        formattedAnalysis: formattedAnalysis,
        foundItems: analysisResult.foundItems || allDisputableItems.length > 0,
        extractedItems: allDisputableItems,
        processedFiles: processedFiles
      };
      
      // Add a flag to indicate this is a fresh analysis
      responseObj.fromCache = false;
      
      // Save the result to cache
      fs.writeFileSync(cacheFilePath, JSON.stringify(responseObj));
      console.log('Analysis result cached for future use');
      
      return res.json(responseObj);
    } catch (error) {
      console.error('Error analyzing reports:', error);
      return res.status(500).json({ error: 'Failed to analyze reports' });
    }
  },
  
  // Generate a dispute letter
  async generateLetter(req, res) {
    try {
      const { items, userInfo } = req.body;
      
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'No items provided for dispute letter' });
      }
      
      console.log(`Generating dispute letter for ${items.length} items`);
      
      const letter = await generateDisputeLetter(items, userInfo);
      
      return res.json({ letter });
    } catch (error) {
      console.error('Error in generateLetter:', error);
      return res.status(500).json({ error: 'Failed to generate dispute letter' });
    }
  },

  // Clear analysis cache
  async clearCache(req, res) {
    try {
      // Get the cache directory
      const cacheDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../cache');
      
      // Check if directory exists
      if (!fs.existsSync(cacheDir)) {
        return res.json({ message: 'Cache directory does not exist. Nothing to clear.' });
      }
      
      // Read all files in the cache directory
      const files = fs.readdirSync(cacheDir).filter(file => file.endsWith('.json'));
      
      // Delete each file
      let deletedCount = 0;
      for (const file of files) {
        const filePath = path.join(cacheDir, file);
        fs.unlinkSync(filePath);
        deletedCount++;
      }
      
      return res.json({ 
        success: true, 
        message: `Successfully cleared ${deletedCount} cache files.` 
      });
    } catch (error) {
      console.error('Error clearing cache:', error);
      return res.status(500).json({ error: 'Failed to clear cache' });
    }
  },

  // Get cache stats
  async getCacheStats(req, res) {
    try {
      const stats = await getCacheStats();
      return res.json(stats);
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return res.status(500).json({ error: 'Failed to get cache statistics' });
    }
  }
};

export default chatController;

// If this file is run directly, test with a sample PDF
/*if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("\n===== CHAT CONTROLLER TEST MODE =====");
  
  const testFilePath = process.argv[2];
  
  if (!testFilePath) {
    console.error('Please provide a file path as an argument');
    process.exit(1);
  }
  
  if (!fs.existsSync(testFilePath)) {
    console.error(`File does not exist: ${testFilePath}`);
    process.exit(1);
  }
  
  console.log(`Testing with file: ${testFilePath}`);
  
  // Import the PDF extraction function
  import('../utils/pdfTextExtractor.js')
    .then(module => {
      console.log("Successfully imported pdfTextExtractor module");
      
      // Test the PDF extraction
      return module.testPdfExtraction(testFilePath);
    })
    .then(text => {
      console.log(`\nExtracted ${text ? text.length : 0} characters from PDF`);
      console.log("Test completed successfully");
      process.exit(0);
    })
    .catch(err => {
      console.error('Error in test:', err);
      process.exit(1);
    });
}*/
