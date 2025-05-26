import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractTextFromImage } from '../utils/fileProcessing.js';
import { PdfExtraction } from '../utils/pdfTextExtractor.js';
import { generateDisputeResponse, generateDisputeLetter } from '../utils/chatGptService.js';
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
        extractedText = await PdfExtraction(file.path);
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
  
  // Analyze credit reports (Keep this for now)
  async analyzeReports(req, res) {
    // Add startTime at the very beginning
    const startTime = Date.now();
    
    try {
      console.log('\n===== ANALYZING CREDIT REPORTS =====\n');
      console.log(`Analysis started at: ${new Date().toISOString()}`);
      
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
      console.log(`Cache file will be saved to: ${cacheFilePath}`);
      
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
          console.log(`\n----- Processing ${file.originalname} -----`);
          console.log(`File size: ${file.size} bytes`);
          console.log(`File type: ${file.mimetype}`);
          
          // Generate a unique prefix for this file's chunks
          const filePrefix = crypto.randomBytes(8).toString('hex') + '_' + Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9]/g, '_');
          
          if (file.mimetype === 'application/pdf') {
            console.log(`Extracting text from PDF: ${file.path}`);

            // Extract text from PDF
            const extractedText = await PdfExtraction(file.path);
            console.log(`Extracted ${extractedText.length} characters from PDF`);
            
            // Save the extracted text to a chunk file
            const chunkPath = path.join(chunksDir, `${filePrefix}_1.txt`);
            fs.writeFileSync(chunkPath, extractedText);
            console.log(`Saved extracted text to: ${chunkPath}`);
            
            // Analyze the chunk with debugging
            console.log(`Analyzing PDF content from ${file.originalname}...`);
            console.log(`Calling comprehensiveAnalyzeChunksFromFiles with:`);
            console.log(`- chunksDir: ${chunksDir}`);
            console.log(`- filePrefix: ${filePrefix}`);
            
            const textAnalysisResult = await comprehensiveAnalyzeChunksFromFiles(chunksDir, filePrefix, { showOutput: true });
            
            // Debug the result
            console.log(`Analysis result type: ${typeof textAnalysisResult}`);
            console.log(`Analysis result:`, textAnalysisResult);
            
            if (!textAnalysisResult) {
              console.error(`ERROR: comprehensiveAnalyzeChunksFromFiles returned undefined/null`);
              throw new Error('Analysis function returned no results');
            }
            
            if (!textAnalysisResult.summary) {
              console.error(`ERROR: Analysis result missing summary property`);
              console.log(`Available properties:`, Object.keys(textAnalysisResult));
              
              // Try to handle different return formats
              if (Array.isArray(textAnalysisResult)) {
                console.log(`Result is an array with ${textAnalysisResult.length} items`);
                // Create a summary object for array results
                const summary = {
                  uniqueItems: textAnalysisResult.length,
                  totalItems: textAnalysisResult.length,
                  categories: {}
                };
                
                // Count items by category
                textAnalysisResult.forEach(item => {
                  const category = item.analysis_pass || 'unknown';
                  summary.categories[category] = (summary.categories[category] || 0) + 1;
                });
                
                // Reconstruct the expected format
                const reconstructedResult = {
                  summary: summary,
                  allItems: textAnalysisResult,
                  categorizedItems: {}
                };
                
                console.log(`Reconstructed result with summary:`, reconstructedResult.summary);
                
                console.log(`Found ${reconstructedResult.summary.uniqueItems} disputable items in ${file.originalname}`);
                
                // Store categorized results
                processedFiles.push({
                  filename: file.originalname,
                  path: file.path,
                  textLength: extractedText.length,
                  totalItems: reconstructedResult.summary.uniqueItems,
                  categories: reconstructedResult.summary.categories
                });
                
                // Add to overall items
                allDisputableItems.push(...reconstructedResult.allItems);
                
              } else {
                throw new Error('Analysis result has unexpected format - not array and no summary');
              }
            } else {
              // Normal case - result has summary
              console.log(`Found ${textAnalysisResult.summary.uniqueItems} disputable items in ${file.originalname}`);
              
              // Store categorized results
              processedFiles.push({
                filename: file.originalname,
                path: file.path,
                textLength: extractedText.length,
                totalItems: textAnalysisResult.summary.uniqueItems,
                categories: textAnalysisResult.summary.categories
              });
              
              // Add to overall items for legacy compatibility
              allDisputableItems.push(...textAnalysisResult.allItems);
            }
          }
          else {
            console.log(`Reading text from file: ${file.path}`);
            const extractedText = fs.readFileSync(file.path, 'utf8');
            console.log(`Read ${extractedText.length} characters from text file`);
            
            // Save the extracted text to a chunk file
            const chunkPath = path.join(chunksDir, `${filePrefix}_1.txt`);
            fs.writeFileSync(chunkPath, extractedText);
            console.log(`Saved text to: ${chunkPath}`);
            
            // Analyze the chunk
            console.log(`Analyzing text from ${file.originalname}...`);
            const textAnalysisResult = await comprehensiveAnalyzeChunksFromFiles(chunksDir, filePrefix, { showOutput: false });
            
            console.log(`Found ${textAnalysisResult.summary.uniqueItems} disputable items in ${file.originalname}`);
            
            // Store categorized results
            processedFiles.push({
              filename: file.originalname,
              path: file.path,
              textLength: extractedText.length,
              analysisResult: textAnalysisResult,
              totalItems: textAnalysisResult.summary.uniqueItems
            });
            
            // Add to overall items for legacy compatibility
            allDisputableItems.push(...textAnalysisResult.allItems);
          }
          
          console.log(`\n----- Completed processing ${file.originalname} -----`);
          
        } catch (error) {
          console.error(`Error processing file ${file.originalname}:`, error);
          console.error(`Error stack:`, error.stack);
          // Continue with other files even if one fails
        }
      }
      
      // Calculate processing time for file analysis
      const fileProcessingTime = Date.now() - startTime;
      console.log(`\nFile processing completed in ${fileProcessingTime}ms`);
      
      // Generate a summary from the comprehensive analysis results
      console.log(`\nGenerating summary for ${allDisputableItems.length} disputable items...`);

      const gptAnalysisStart = Date.now();

      // Categorize items for better organization
      const categorizedItems = {};
      allDisputableItems.forEach(item => {
        const category = item.analysis_pass || 'other';
        if (!categorizedItems[category]) {
          categorizedItems[category] = [];
        }
        categorizedItems[category].push(item);
      });
      
      // Create a simple summary instead of re-analyzing
      const analysisResult = {
        summary: `Found ${allDisputableItems.length} potential dispute items across ${processedFiles.length} credit report(s). Items include ${Object.keys(categorizedItems).join(', ')} issues.`,
        detailedAnalysis: generateDetailedSummary(allDisputableItems, categorizedItems),
        foundItems: allDisputableItems.length > 0
      };

      const gptAnalysisTime = Date.now() - gptAnalysisStart;
      console.log(`Summary generation completed in ${gptAnalysisTime}ms`);
      
      // Calculate total processing time
      const totalProcessingTime = Date.now() - startTime;
      console.log(`Total analysis time: ${totalProcessingTime}ms`);
      
      // Prepare response object with both structured and formatted data
      const responseObj = {
        summary: analysisResult.summary,
        analysis: analysisResult.detailedAnalysis,
        formattedAnalysis: analysisResult.detailedAnalysis.replace(/\n/g, '<br>'),
        foundItems: analysisResult.foundItems,
        extractedItems: allDisputableItems,
        processedFiles: processedFiles
      };
      
      // Add a flag to indicate this is a fresh analysis
      responseObj.fromCache = false;
      
      console.log(`\nCategorized items:`, Object.keys(categorizedItems).map(cat => `${cat}: ${categorizedItems[cat].length}`));
      
      // Save results to cache with better formatting
      try {
        const cacheData = {
          timestamp: new Date().toISOString(),
          summary: {
            totalFiles: processedFiles.length,
            totalUniqueItems: allDisputableItems.length,
            analysisDate: new Date().toLocaleDateString(),
            processingTime: `${totalProcessingTime}ms`,
            fileProcessingTime: `${fileProcessingTime}ms`,
            gptAnalysisTime: `${gptAnalysisTime}ms`
          },
          
          // Categorized dispute items for easy reading
          disputeItems: {
            personalInformation: categorizedItems.personal_info || [],
            accountStatus: categorizedItems.account_status || [],
            paymentHistory: categorizedItems.payment_history || [],
            duplicateAccounts: categorizedItems.duplicates || [],
            unauthorizedInquiries: categorizedItems.inquiries || [],
            collections: categorizedItems.collections || [],
            unverifiableInfo: categorizedItems.unverifiable || [],
            outdatedInfo: categorizedItems.outdated || []
          },
          
          // Individual dispute items with clear structure
          allDisputeItems: allDisputableItems.map((item, index) => ({
            id: index + 1,
            creditor: item.creditor_name,
            accountNumber: item.account_number,
            accountType: item.account_type,
            issueType: item.issue_type,
            issueDetails: item.issue_details,
            disputeReason: item.dispute_reason,
            confidenceLevel: item.confidence_level,
            category: item.analysis_pass,
            originalText: item.original_text?.substring(0, 200) + '...' // Truncate for readability
          })),
          
          // File processing details
          processedFiles: processedFiles.map(file => ({
            filename: file.filename,
            itemsFound: file.totalItems || file.items,
            fileSize: file.textLength ? `${Math.round(file.textLength / 1024)}KB` : 'Unknown',
            processingStatus: 'Success'
          })),
          
          // GPT Analysis Summary
          gptAnalysis: {
            summary: analysisResult.summary,
            detailedAnalysis: analysisResult.detailedAnalysis,
            foundItems: analysisResult.foundItems
          },
          
          // Dispute recommendations by priority
          disputeRecommendations: {
            highPriority: allDisputableItems
              .filter(item => item.confidence_level === 'high')
              .map(item => ({
                creditor: item.creditor_name,
                issue: item.issue_type,
                reason: item.dispute_reason
              })),
            
            mediumPriority: allDisputableItems
              .filter(item => item.confidence_level === 'medium')
              .map(item => ({
                creditor: item.creditor_name,
                issue: item.issue_type,
                reason: item.dispute_reason
              })),
            
            lowPriority: allDisputableItems
              .filter(item => item.confidence_level === 'low')
              .map(item => ({
                creditor: item.creditor_name,
                issue: item.issue_type,
                reason: item.dispute_reason
              }))
          }
        };

        // Save to cache with pretty formatting
        fs.writeFileSync(cacheFilePath, JSON.stringify(cacheData, null, 2));
        console.log(`\nResults cached to: ${cacheFilePath}`);
        console.log(`Cache file size: ${Math.round(fs.statSync(cacheFilePath).size / 1024)}KB`);
        
      } catch (cacheError) {
        console.error('Error saving to cache:', cacheError);
        console.error('Cache error stack:', cacheError.stack);
      }
      
      console.log(`\n===== ANALYSIS COMPLETE =====`);
      console.log(`Total items found: ${allDisputableItems.length}`);
      console.log(`Files processed: ${processedFiles.length}`);
      console.log(`Total time: ${totalProcessingTime}ms`);
      console.log(`Analysis finished at: ${new Date().toISOString()}`);
      
      res.json(responseObj);
      
    } catch (error) {
      const errorTime = Date.now() - startTime;
      console.error('\n===== ANALYSIS ERROR =====');
      console.error(`Error occurred after ${errorTime}ms`);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      console.error('Error at:', new Date().toISOString());
      
      res.status(500).json({ 
        error: 'Failed to analyze credit reports',
        details: error.message,
        processingTime: `${errorTime}ms`
      });
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

  // Clear analysis cache (Keep this for now)
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
      return module.PdfExtraction(testFilePath);
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

function generateDetailedSummary(items, categorizedItems) {
  let summary = `## Credit Report Analysis Summary\n\n`;
  summary += `I've analyzed your credit reports and found **${items.length} potential dispute items** that could be challenged.\n\n`;
  
  Object.keys(categorizedItems).forEach(category => {
    const categoryItems = categorizedItems[category];
    summary += `### ${category.replace('_', ' ').toUpperCase()} (${categoryItems.length} items)\n`;
    categoryItems.slice(0, 3).forEach(item => {
      summary += `- **${item.creditor_name}**: ${item.issue_type} - ${item.dispute_reason}\n`;
    });
    if (categoryItems.length > 3) {
      summary += `- ...and ${categoryItems.length - 3} more items\n`;
    }
    summary += `\n`;
  });
  
  return summary;
}
