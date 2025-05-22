import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractTextFromPdf, extractTextFromImage } from '../utils/fileProcessing.js';
import { testPdfExtraction } from '../utils/pdfTextExtractor.js';
import { chunkReportText, saveChunksToFiles } from '../utils/reportChunker.js';
import { generateDisputeResponse, analyzeCreditReports, generateDisputeLetter } from '../chatGptService.js';
import crypto from 'crypto';
import { ensureCacheDirectory, cleanupCache, clearCache, getCacheStats } from '../utils/cacheManager.js';
import { processReportWithGpt } from '../utils/reportAnalyzer.js';


// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the extractTextFromFiles function
async function extractTextFromFiles(files) {
  let combinedText = '';
  
  console.log(`\n===== PROCESSING ${files.length} CREDIT REPORT FILES =====\n`);
  
  for (const file of files) {
    try {
      console.log(`\n----- Processing file: ${file.originalname} (${file.mimetype}) -----`);
      let extractedText = '';
      
      // Extract text based on file type
      if (file.mimetype === 'application/pdf') {
        console.log(`Extracting text from PDF file: ${file.path}`);
        extractedText = await extractTextFromPdf(file.path);
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

// Helper function to parse dispute letters
function parseDisputeLetters(text, items) {
  // Simple parsing - split by "LETTER" or similar headers
  const letterSections = text.split(/LETTER\s+\d+|DISPUTE\s+LETTER\s+\d+/i).filter(section => section.trim().length > 0);
  
  // If we couldn't parse properly, create one letter per item
  if (letterSections.length !== items.length) {
    return items.map((item, index) => {
      const itemText = typeof item === 'string' ? item : item.description || JSON.stringify(item);
      return {
        recipient: `Credit Bureau ${index + 1}`,
        content: text, // Just return the whole text if parsing failed
        item: itemText
      };
    });
  }
  
  // Create structured letter objects
  return letterSections.map((section, index) => {
    // Try to extract recipient from the letter
    const recipientMatch = section.match(/TO:\s*([^\n]+)/i) || 
                          section.match(/ATTN:\s*([^\n]+)/i) ||
                          section.match(/([^,]+),\s*\n/);
    
    const recipient = recipientMatch ? recipientMatch[1].trim() : `Credit Bureau ${index + 1}`;
    const itemText = typeof items[index] === 'string' ? items[index] : items[index].description || JSON.stringify(items[index]);
    
    return {
      recipient: recipient,
      content: section.trim(),
      item: itemText
    };
  });
}

export const chatController = {
  // Handle regular chat messages
  async handleChatMessage(req, res) {
    try {
      const { message, context } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }
      
      console.log(`\n===== CHAT MESSAGE RECEIVED =====`);
      console.log(`Message: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`);
      
      // Generate response using ChatGPT
      const response = await generateDisputeResponse(message, context);
      
      return res.json({ response });
    } catch (error) {
      console.error('Error handling chat message:', error);
      return res.status(500).json({ error: 'Failed to process message' });
    }
  },
  
  // Analyze credit reports
  async analyzeReports(req, res) {
    try {
      // Check if force refresh is requested
      const forceRefresh = req.body.forceRefresh === 'true';
      
      console.log(`\n========== CREDIT REPORT ANALYSIS REQUEST ==========`);
      console.log(`Force refresh: ${forceRefresh}`);
      console.log(`Files received: ${req.files.length}`);
      
      // Ensure cache directory exists and clean up old files if needed
      ensureCacheDirectory();
      cleanupCache();
      
      // Generate a hash of the report files to use as a cache key
      const fileContents = [];
      for (const file of req.files) {
        const content = fs.readFileSync(file.path);
        fileContents.push(content);
      }
      
      // Create a hash of the combined file contents
      const contentHash = crypto
        .createHash('md5')
        .update(Buffer.concat(fileContents))
        .digest('hex');
      
      const cacheFilePath = path.join(__dirname, '../cache', `${contentHash}.json`);
      console.log(`Cache file path: ${cacheFilePath}`);
      
      // Check if we have a cached result and force refresh is not requested
      if (!forceRefresh && fs.existsSync(cacheFilePath)) {
        console.log('Using cached analysis result');
        const cachedResult = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
        
        // Add a flag to indicate this is from cache
        cachedResult.fromCache = true;
        
        // Clean up uploaded files
        req.files.forEach(file => {
          fs.unlink(file.path, (err) => {
            if (err) console.error(`Error deleting file ${file.path}:`, err);
          });
        });
        
        return res.json(cachedResult);
      }
      
      // If no cache exists or force refresh is requested, proceed with analysis
      console.log(forceRefresh ? 'Force refresh requested' : 'No cached result found', ', performing new analysis');
      
      // Process each file to extract text and disputable items
      const disputableItems = [];
      const processedFiles = [];
      
      for (const file of req.files) {
        console.log(`\n----- Processing file: ${file.originalname} (${file.mimetype}) -----`);
        let extractedText = '';
        
        try {
          // Extract text based on file type using our improved extractor for PDFs
          if (file.mimetype === 'application/pdf') {
            console.log(`Using improved PDF extraction for: ${file.path}`);
            
            // First, modify testPdfExtraction to return the extracted text
            extractedText = await testPdfExtraction(file.path);
            
            if (!extractedText || extractedText.length === 0) {
              console.log(`Improved extraction failed, falling back to standard method`);
              extractedText = await extractTextFromPdf(file.path);
            }
          } else if (file.mimetype.startsWith('image/')) {
            console.log(`Extracting text from image file: ${file.path}`);
            extractedText = await extractTextFromImage(file.path);
          } else {
            console.log(`Reading text from file: ${file.path}`);
            extractedText = fs.readFileSync(file.path, 'utf8');
          }
          
          console.log(`Extracted ${extractedText.length} characters from ${file.originalname}`);
          
          // Store the processed file info
          processedFiles.push({
            filename: file.originalname,
            path: file.path,
            textLength: extractedText.length
          });
          
          // Process the extracted text with GPT
          console.log(`\n----- Chunking extracted text from ${file.originalname} -----`);
          let textChunks = [];
          
          try {
            // Debug the extracted text
            console.log(`Text to chunk: ${extractedText.substring(0, 100)}...`);
            console.log(`Text length: ${extractedText.length} characters`);
            
            // Ensure we have text to chunk
            if (!extractedText || extractedText.length === 0) {
              throw new Error("No text extracted from PDF");
            }
            
            // Force re-import the chunking functions to ensure they're loaded correctly
            const reportChunker = await import('../utils/reportChunker.js');
            
            // Chunk the text with explicit parameters
            console.log("About to call chunkReportText...");
            textChunks = reportChunker.chunkReportText(extractedText, 10000, 200);
            console.log(`Successfully created ${textChunks.length} chunks for processing`);
            
            // Save chunks for debugging
            const filePrefix = file.originalname.replace(/\W+/g, '_');
            reportChunker.saveChunksToFiles(textChunks, filePrefix);
            
            // Debug: Print the first 100 characters of each chunk
            textChunks.forEach((chunk, i) => {
              console.log(`Chunk ${i+1} preview: ${chunk.substring(0, 100).replace(/\n/g, ' ')}...`);
            });
            
            // Process each chunk with GPT
            console.log(`\n----- Processing ${textChunks.length} chunks with GPT -----`);
            for (let i = 0; i < textChunks.length; i++) {
              const chunk = textChunks[i];
              console.log(`Processing chunk ${i+1}/${textChunks.length} (${chunk.length} characters)...`);
              
              const chunkResults = await processReportWithGpt(file.path, chunk);
              console.log(`Chunk ${i+1} yielded ${chunkResults.length} disputable items`);
              
              disputableItems.push(...chunkResults);
            }
            
            console.log(`\n----- Completed processing all chunks from ${file.originalname} -----`);
            console.log(`Total disputable items found: ${disputableItems.length}`);
            
          } catch (error) {
            console.error(`Error chunking or processing text: ${error.message}`);
            console.error(error.stack);
            
            // Fallback to processing the entire text as one chunk
            console.log(`Falling back to processing entire text as a single chunk`);
            const fallbackResults = await processReportWithGpt(file.path, extractedText);
            disputableItems.push(...fallbackResults);
          }
        } catch (error) {
          console.error(`Error processing file ${file.originalname}:`, error);
          // Continue with other files even if one fails
        }
      }
      
      // Generate a summary and detailed analysis using GPT
      console.log(`\nGenerating analysis for ${disputableItems.length} disputable items...`);
      const analysisResult = await analyzeCreditReports(disputableItems);
      
      // Format the analysis for display
      const formattedAnalysis = analysisResult.detailedAnalysis.replace(/\n/g, '<br>');
      
      // Prepare response object with both structured and formatted data
      const responseObj = {
        summary: analysisResult.summary,
        analysis: analysisResult.detailedAnalysis,
        formattedAnalysis: formattedAnalysis,
        foundItems: analysisResult.foundItems || disputableItems,
        extractedItems: disputableItems,
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
      return res.status(500).json({ error: 'Failed to analyze reports', message: error.message });
    }
  },
  
  // Generate dispute letters
  async generateDisputeLetters(req, res) {
    try {
      const { items, personalInfo } = req.body;
      
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'No items provided for dispute letters' });
      }
      
      console.log(`\n===== GENERATING DISPUTE LETTERS =====`);
      console.log(`Items to dispute: ${items.length}`);
      console.log(`Personal info provided: ${personalInfo ? 'Yes' : 'No'}`);
      
      // Generate dispute letters using ChatGPT
      const letters = await generateDisputeLetter(items, personalInfo);
      
      return res.json({ letters });
    } catch (error) {
      console.error('Error generating dispute letters:', error);
      return res.status(500).json({ error: 'Failed to generate dispute letters' });
    }
  },
  
  // Cache management endpoint
  async manageCache(req, res) {
    try {
      const action = req.query.action;
      
      if (action === 'clear') {
        await clearCache();
        return res.json({ message: 'Cache cleared successfully' });
      } else if (action === 'stats') {
        const stats = await getCacheStats();
        return res.json(stats);
      } else {
        return res.status(400).json({ error: 'Invalid action. Use "clear" or "stats".' });
      }
    } catch (error) {
      console.error('Error managing cache:', error);
      return res.status(500).json({ error: 'Failed to manage cache' });
    }
  }
};

// If this file is run directly, test with a sample PDF
if (import.meta.url === `file://${process.argv[1]}`) {
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
  
  // Test the PDF extraction
  testPdfExtraction(testFilePath)
    .then(text => {
      console.log(`\nExtracted ${text.length} characters from PDF`);
      
      // Test chunking
      const chunks = chunkReportText(text);
      console.log(`\nChunked into ${chunks.length} parts`);
      
      process.exit(0);
    })
    .catch(err => {
      console.error('Error in test:', err);
      process.exit(1);
    });
}
