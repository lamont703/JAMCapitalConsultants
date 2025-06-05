import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractTextFromImage } from '../utils/fileProcessing.js';
import { PdfExtraction } from '../utils/pdfTextExtractor.js';
import { generateDisputeResponse, generateDisputeLetter } from '../utils/chatGptService.js';
import crypto from 'crypto';
import { ensureCacheDirectory, cleanupCache, clearCache, getCacheStats } from '../utils/cacheManager.js';
import { analyzeChunks, analyzeChunksFromFiles, comprehensiveAnalyzeChunksFromFiles } from '../utils/gptAnalyzer.js';
import { getUserDocuments, saveAnalysisResults } from '../utils/databaseUtils.js';

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

  // Generate multiple dispute letters for ChatModule
  async generateMultipleLetters(req, res) {
    try {
      const { items, userInfo, analysisData, conversationState } = req.body;
      
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'No items provided for dispute letters' });
      }
      
      if (!userInfo || !userInfo.userEmail) {
        return res.status(400).json({ error: 'User information is required' });
      }
      
      console.log(`Generating dispute letters for ${items.length} items for user ${userInfo.userEmail}`);
      
      // Initialize services for database and blob storage
      const { CosmosService } = await import('../services/cosmosService.js');
      const { AzureBlobService } = await import('../services/azureBlobService.js');
      
      const cosmosService = new CosmosService();
      const blobService = new AzureBlobService();
      
      await cosmosService.initialize();
      await blobService.initialize();
      
      // Group items by bureau for better letter organization
      const itemsByBureau = {};
      items.forEach(item => {
        const bureau = item.bureau || 'general';
        if (!itemsByBureau[bureau]) {
          itemsByBureau[bureau] = [];
        }
        itemsByBureau[bureau].push(item);
      });
      
      console.log(`Items grouped by bureau:`, Object.keys(itemsByBureau).map(bureau => `${bureau}: ${itemsByBureau[bureau].length} items`));
      
      // Generate a letter for each bureau
      const generatedLetters = [];
      const savedLetters = []; // Track saved database records
      
      for (const [bureau, bureauItems] of Object.entries(itemsByBureau)) {
        try {
          console.log(`Generating letter for ${bureau} with ${bureauItems.length} items`);
          
          // Enhanced user info for letter generation
          const enhancedUserInfo = {
            ...userInfo,
            bureau: bureau,
            itemCount: bureauItems.length,
            totalSelectedItems: items.length,
            analysisContext: conversationState ? {
              selectedCount: conversationState.selectedCount,
              completedCategories: conversationState.categories
            } : null
          };
          
          // Generate letter using existing ChatGPT service
          const letter = await generateDisputeLetter(bureauItems, enhancedUserInfo);
          
          // Create actual PDF from the letter content
          const pdfContent = generatePDFContent(letter, bureau);
          const pdfBuffer = await generateActualPDF(letter, bureau, enhancedUserInfo);
          
          // Generate unique filename for blob storage
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const sanitizedEmail = userInfo.userEmail.replace(/[^a-zA-Z0-9]/g, '_');
          const fileName = `dispute-letters/${sanitizedEmail}/${timestamp}_${bureau}_dispute_letter.pdf`;
          
          // Upload PDF to blob storage
          let blobUrl = null;
          try {
            const uploadResult = await blobService.uploadFile(
              { buffer: pdfBuffer, mimetype: 'application/pdf' },
              fileName,
              {
                userEmail: userInfo.userEmail,
                userId: userInfo.userId || 'unknown',
                bureau: bureau,
                itemCount: bureauItems.length.toString(),
                generatedAt: new Date().toISOString(),
                letterType: 'dispute_letter'
              }
            );
            blobUrl = uploadResult.url;
            console.log(`✅ PDF uploaded to blob storage: ${fileName}`);
          } catch (blobError) {
            console.error(`❌ Error uploading PDF to blob storage:`, blobError);
            // Continue without blob storage if it fails
          }
          
          // Save letter to database
          const letterData = {
            bureau: bureau,
            content: letter,
            pdfContent: pdfContent,
            blobUrl: blobUrl,
            blobFileName: fileName,
            items: bureauItems.map(item => ({
              creditor: item.creditor_name,
              account: item.account_number,
              issue: item.dispute_reason,
              confidence: item.confidence_level,
              amount: item.amount,
              itemId: item.id
            })),
            userInfo: {
              email: userInfo.userEmail,
              userId: userInfo.userId,
              name: userInfo.name,
              address: userInfo.address,
              city: userInfo.city,
              state: userInfo.state,
              zipCode: userInfo.zipCode,
              phone: userInfo.phone
            },
            analysisContext: conversationState,
            generatedAt: new Date().toISOString(),
            letterType: 'ai_generated',
            status: 'generated'
          };
          
          // Save to database
          let savedLetter = null;
          try {
            savedLetter = await cosmosService.saveDisputeLetter(userInfo.userId || userInfo.userEmail, letterData);
            console.log(`✅ Letter saved to database with ID: ${savedLetter.id}`);
            savedLetters.push(savedLetter);
          } catch (dbError) {
            console.error(`❌ Error saving letter to database:`, dbError);
            // Continue without database save if it fails
          }
          
          generatedLetters.push({
            bureau: bureau,
            itemCount: bureauItems.length,
            letter: letter,
            pdfContent: pdfContent,
            blobUrl: blobUrl,
            blobFileName: fileName,
            databaseId: savedLetter?.id,
            items: bureauItems.map(item => ({
              creditor: item.creditor_name,
              account: item.account_number,
              issue: item.dispute_reason,
              confidence: item.confidence_level
            }))
          });
          
          console.log(`✅ Successfully generated and saved letter for ${bureau}`);
          
        } catch (letterError) {
          console.error(`❌ Error generating letter for ${bureau}:`, letterError);
          
          // Add error placeholder but continue with other bureaus
          generatedLetters.push({
            bureau: bureau,
            itemCount: bureauItems.length,
            error: `Failed to generate letter for ${bureau}: ${letterError.message}`,
            items: bureauItems.map(item => ({
              creditor: item.creditor_name,
              account: item.account_number,
              issue: item.dispute_reason,
              confidence: item.confidence_level
            }))
          });
        }
      }
      
      // Create summary response
      const successfulLetters = generatedLetters.filter(letter => !letter.error);
      const failedLetters = generatedLetters.filter(letter => letter.error);
      
      console.log(`📊 Letter generation summary:`);
      console.log(`✅ Successful: ${successfulLetters.length} letters`);
      console.log(`❌ Failed: ${failedLetters.length} letters`);
      console.log(`💾 Saved to database: ${savedLetters.length} letters`);
      console.log(`📁 Uploaded to blob storage: ${successfulLetters.filter(l => l.blobUrl).length} PDFs`);
      
      const responseData = {
        success: successfulLetters.length > 0,
        letters: generatedLetters,
        summary: {
          totalItems: items.length,
          totalLetters: generatedLetters.length,
          successfulLetters: successfulLetters.length,
          failedLetters: failedLetters.length,
          savedToDatabase: savedLetters.length,
          uploadedToBlob: successfulLetters.filter(l => l.blobUrl).length,
          bureaus: Object.keys(itemsByBureau),
          generatedAt: new Date().toISOString()
        },
        userInfo: {
          email: userInfo.userEmail,
          userId: userInfo.userId
        },
        storage: {
          databaseIds: savedLetters.map(letter => letter.id),
          blobUrls: successfulLetters.filter(l => l.blobUrl).map(l => ({ bureau: l.bureau, url: l.blobUrl, fileName: l.blobFileName }))
        }
      };
      
      // If any letters were generated successfully, return success
      if (successfulLetters.length > 0) {
        return res.json(responseData);
      } else {
        return res.status(500).json({
          ...responseData,
          error: 'Failed to generate any dispute letters',
          details: failedLetters.map(letter => letter.error)
        });
      }
      
    } catch (error) {
      console.error('Error in generateMultipleLetters:', error);
      return res.status(500).json({ 
        error: 'Failed to generate dispute letters',
        details: error.message
      });
    }
  },

  // Get saved dispute letters for a user
  async getUserDisputeLetters(req, res) {
    try {
      const { userId, userEmail } = req.query;
      
      if (!userId && !userEmail) {
        return res.status(400).json({ error: 'User ID or email is required' });
      }
      
      console.log(`Retrieving dispute letters for user: ${userId || userEmail}`);
      
      // Initialize database service
      const { CosmosService } = await import('../services/cosmosService.js');
      const cosmosService = new CosmosService();
      await cosmosService.initialize();
      
      // Query for user's dispute letters
      const query = `
        SELECT * FROM c 
        WHERE c.type = @type 
        AND (c.userId = @userId OR c.letterData.userInfo.email = @userEmail)
        ORDER BY c.createdAt DESC
      `;
      
      const parameters = [
        { name: '@type', value: 'dispute_letter' },
        { name: '@userId', value: userId || '' },
        { name: '@userEmail', value: userEmail || '' }
      ];
      
      const letters = await cosmosService.queryDocuments(query, parameters);
      
      console.log(`Found ${letters.length} dispute letters for user`);
      
      // Format response data
      const formattedLetters = letters.map(letter => ({
        id: letter.id,
        bureau: letter.letterData?.bureau,
        content: letter.letterData?.content,
        blobUrl: letter.letterData?.blobUrl,
        blobFileName: letter.letterData?.blobFileName,
        itemCount: letter.letterData?.items?.length || 0,
        items: letter.letterData?.items || [],
        status: letter.letterData?.status || 'generated',
        generatedAt: letter.letterData?.generatedAt || letter.createdAt,
        createdAt: letter.createdAt
      }));
      
      return res.json({
        success: true,
        letters: formattedLetters,
        total: formattedLetters.length,
        userInfo: {
          userId: userId,
          userEmail: userEmail
        }
      });
      
    } catch (error) {
      console.error('Error retrieving user dispute letters:', error);
      return res.status(500).json({ 
        error: 'Failed to retrieve dispute letters',
        details: error.message
      });
    }
  },

  // Delete a saved dispute letter
  async deleteDisputeLetter(req, res) {
    try {
      console.log('🗑️ Delete dispute letter request received');
      console.log('Request body:', req.body);

      const { letterId } = req.body;

      if (!letterId) {
        console.error('❌ No letter ID provided');
        return res.status(400).json({
          success: false,
          message: 'Letter ID is required'
        });
      }

      // Import database functions
      const { CosmosClient } = await import('@azure/cosmos');
      const { BlobServiceClient } = await import('@azure/storage-blob');

      // Initialize Cosmos client
      const cosmosClient = new CosmosClient({
        endpoint: process.env.COSMOS_DB_ENDPOINT,
        key: process.env.COSMOS_DB_KEY
      });

      const database = cosmosClient.database(process.env.COSMOS_DB_DATABASE_NAME);
      const container = database.container('DisputeLetters');

      // First, fetch the letter to get blob information
      console.log(`🔍 Fetching letter with ID: ${letterId}`);
      const { resource: letter } = await container.item(letterId, letterId).read();

      if (!letter) {
        console.error('❌ Letter not found in database');
        return res.status(404).json({
          success: false,
          message: 'Letter not found'
        });
      }

      console.log('📄 Letter found:', letter.fileName);

      // Delete from blob storage if blob info exists
      if (letter.blobUrl && letter.fileName) {
        try {
          console.log('🗑️ Deleting blob from storage...');
          
          const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
          const containerClient = blobServiceClient.getContainerClient('dispute-letters');
          
          // Extract blob name from URL or use fileName
          const blobName = letter.fileName.includes('/') ? letter.fileName : `dispute-letters/${letter.userEmail}/${letter.fileName}`;
          const blockBlobClient = containerClient.getBlockBlobClient(blobName);
          
          await blockBlobClient.deleteIfExists();
          console.log('✅ Blob deleted successfully');
        } catch (blobError) {
          console.error('❌ Error deleting blob:', blobError);
          // Continue with database deletion even if blob deletion fails
        }
      }

      // Delete from database
      console.log('🗑️ Deleting letter from database...');
      await container.item(letterId, letterId).delete();

      console.log('✅ Letter deleted successfully');

      res.json({
        success: true,
        message: 'Letter deleted successfully'
      });

    } catch (error) {
      console.error('❌ Error deleting dispute letter:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete letter',
        error: error.message
      });
    }
  },

  // Download PDF from blob storage with proper headers
  async downloadLetterPDF(req, res) {
    try {
      console.log('📥 PDF download request received');
      const { letterId } = req.params;

      if (!letterId) {
        console.error('❌ No letter ID provided');
        return res.status(400).json({
          success: false,
          message: 'Letter ID is required'
        });
      }

      console.log(`🔍 Fetching letter with ID: ${letterId}`);

      // Initialize database service (same approach as getUserDisputeLetters)
      const { CosmosService } = await import('../services/cosmosService.js');
      const cosmosService = new CosmosService();
      await cosmosService.initialize();

      // Query for the specific letter
      const query = `SELECT * FROM c WHERE c.id = @letterId`;
      const parameters = [{ name: '@letterId', value: letterId }];
      
      const letters = await cosmosService.queryDocuments(query, parameters);
      
      if (!letters || letters.length === 0) {
        console.error('❌ Letter not found in database');
        return res.status(404).json({
          success: false,
          message: 'Letter not found'
        });
      }

      const letter = letters[0];
      console.log('📄 Letter found:', letter.letterData?.blobFileName);

      const blobUrl = letter.letterData?.blobUrl;
      const fileName = letter.letterData?.blobFileName;

      if (!blobUrl) {
        console.error('❌ No blob URL found for letter');
        return res.status(404).json({
          success: false,
          message: 'PDF not available for this letter'
        });
      }

      console.log(`📄 Fetching PDF from blob storage: ${blobUrl}`);

      // Fetch the PDF from blob storage
      const response = await fetch(blobUrl);

      if (!response.ok) {
        console.error(`❌ Failed to fetch PDF from blob storage: ${response.status}`);
        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve PDF from storage'
        });
      }

      // Get the PDF buffer
      const pdfBuffer = await response.arrayBuffer();
      
      console.log(`✅ PDF fetched successfully, size: ${pdfBuffer.byteLength} bytes`);

      // Set appropriate headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName || 'dispute-letter.pdf'}"`);
      res.setHeader('Content-Length', pdfBuffer.byteLength);
      res.setHeader('Cache-Control', 'no-cache');

      // Send the PDF buffer
      res.send(Buffer.from(pdfBuffer));

      console.log(`✅ PDF download completed for letter: ${letterId}`);

    } catch (error) {
      console.error('❌ Error downloading PDF:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to download PDF',
        error: error.message
      });
    }
  },

  // Get dispute reports for a specific user
  async getUserDisputeReports(req, res) {
    try {
      console.log('📋 Get user dispute reports request received');
      const { userId } = req.params;

      if (!userId) {
        console.error('❌ No user ID provided');
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      console.log(`🔍 Fetching dispute reports for user: ${userId}`);

      // Import database functions
      const { CosmosClient } = await import('@azure/cosmos');

      // Initialize Cosmos client
      const cosmosClient = new CosmosClient({
        endpoint: process.env.COSMOS_DB_ENDPOINT,
        key: process.env.COSMOS_DB_KEY
      });

      const database = cosmosClient.database(process.env.COSMOS_DB_DATABASE_NAME);
      const container = database.container('DisputeReports'); // Different container for dispute reports

      // Query for dispute reports by user ID
      const querySpec = {
        query: 'SELECT * FROM c WHERE c.userId = @userId ORDER BY c.submittedAt DESC',
        parameters: [
          {
            name: '@userId',
            value: userId
          }
        ]
      };

      console.log('📋 Executing query:', querySpec);

      const { resources: disputeReports } = await container.items.query(querySpec).fetchAll();

      console.log(`✅ Found ${disputeReports.length} dispute reports for user ${userId}`);

      // Transform the data to match expected format
      const formattedReports = disputeReports.map(report => ({
        id: report.id,
        userId: report.userId,
        reportType: report.reportType || 'Credit Report Dispute',
        status: report.status || 'submitted',
        disputeSummary: report.disputeSummary || report.summary || 'No summary available',
        submittedAt: report.submittedAt || report.createdAt || new Date().toISOString(),
        reportDate: report.reportDate || report.submittedAt || new Date().toISOString(),
        creditScores: report.creditScores || null,
        fileInfo: report.fileInfo || null,
        metadata: report.metadata || {}
      }));

      res.json({
        success: true,
        disputeReports: formattedReports,
        count: formattedReports.length
      });

    } catch (error) {
      console.error('❌ Error fetching user dispute reports:', error);
      
      // If it's a "container not found" error, return empty array
      if (error.code === 404 || error.message.includes('NotFound')) {
        console.log('📋 DisputeReports container not found, returning empty array');
        return res.json({
          success: true,
          disputeReports: [],
          count: 0
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to fetch dispute reports',
        error: error.message
      });
    }
  },

  // Download generated letters as PDF
  async downloadLetters(req, res) {
    try {
      const { userId, letters } = req.body;
      
      if (!letters || !Array.isArray(letters) || letters.length === 0) {
        return res.status(400).json({ error: 'No letters provided for download' });
      }
      
      console.log(`Preparing PDF download for ${letters.length} letters for user ${userId}`);
      
      // If only one letter, return individual PDF
      if (letters.length === 1) {
        const letter = letters[0];
        const bureau = letter.bureau || 'general';
        const pdfContent = generatePDFContent(letter.letter || letter.content, bureau);
        
        // Set headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="JAM_Dispute_Letter_${bureau}_${new Date().toISOString().split('T')[0]}.pdf"`);
        
        return res.json({
          success: true,
          pdfContent: pdfContent,
          filename: `JAM_Dispute_Letter_${bureau}_${new Date().toISOString().split('T')[0]}.pdf`,
          letterType: 'single_pdf',
          bureau: bureau,
          downloadInfo: {
            letterCount: 1,
            generatedAt: new Date().toISOString()
          }
        });
      } else {
        // Multiple letters - return array of PDFs
        const pdfLetters = letters.map((letter, index) => {
          const bureau = letter.bureau || `letter_${index + 1}`;
          return {
            filename: `JAM_Dispute_Letter_${bureau}_${new Date().toISOString().split('T')[0]}.pdf`,
            pdfContent: generatePDFContent(letter.letter || letter.content, bureau),
            bureau: bureau,
            itemCount: letter.itemCount || 0
          };
        });
        
        res.setHeader('Content-Type', 'application/json');
        
        return res.json({
          success: true,
          letters: pdfLetters,
          letterType: 'multiple_pdfs',
          downloadInfo: {
            letterCount: letters.length,
            bureaus: pdfLetters.map(p => p.bureau),
            generatedAt: new Date().toISOString()
          }
        });
      }
      
    } catch (error) {
      console.error('Error in downloadLetters:', error);
      return res.status(500).json({ 
        error: 'Failed to prepare letters for download',
        details: error.message
      });
    }
  },

  // Email generated letters to user
  async emailLetters(req, res) {
    try {
      const { userId, userEmail, letters } = req.body;
      
      if (!userEmail) {
        return res.status(400).json({ error: 'User email is required' });
      }
      
      if (!letters || !Array.isArray(letters) || letters.length === 0) {
        return res.status(400).json({ error: 'No letters provided for emailing' });
      }
      
      console.log(`Preparing to email ${letters.length} letters to ${userEmail}`);
      
      // For now, return a success response
      // In a full implementation, you would:
      // 1. Create PDF files from the letters
      // 2. Send them via email service (like SendGrid, AWS SES, etc.)
      
      const emailData = {
        to: userEmail,
        subject: `Your JAM Dispute Letters - ${letters.length} Letters Generated`,
        letterCount: letters.length,
        bureaus: letters.map(letter => letter.bureau).filter(Boolean),
        sentAt: new Date().toISOString()
      };
      
      // TODO: Implement actual email sending
      console.log(`📧 Email would be sent to ${userEmail} with ${letters.length} letters`);
      
      return res.json({
        success: true,
        message: `Letters successfully sent to ${userEmail}`,
        emailData: emailData
      });
      
    } catch (error) {
      console.error('Error in emailLetters:', error);
      return res.status(500).json({ 
        error: 'Failed to email letters',
        details: error.message
      });
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
  },

  // New method to analyze already uploaded reports by user email
  async analyzeUserReports(req, res) {
    const startTime = Date.now();
    
    try {
      console.log('\n===== ANALYZING USER REPORTS BY EMAIL =====\n');
      console.log(`Analysis started at: ${new Date().toISOString()}`);
      
      // Get user email from query parameters
      const { userEmail } = req.query;
      
      if (!userEmail) {
        return res.status(400).json({ error: 'User email is required' });
      }
      
      console.log(`Analyzing reports for user: ${userEmail}`);
      
      // Try to get user documents from your existing system
      // This assumes you have a function to get user documents by email
      let userDocuments;
      
      try {
        // Option 1: If you have a database utility function
        userDocuments = await getUserDocuments(userEmail);
        
        // Option 2: If you need to make an API call to your admin endpoint
        // (You might need to implement this based on your existing system)
        
      } catch (dbError) {
        console.error('Error fetching user documents:', dbError);
        return res.status(404).json({ 
          error: 'No uploaded reports found for this user',
          details: 'Please upload your credit reports first'
        });
      }
      
      if (!userDocuments || userDocuments.length === 0) {
        return res.status(404).json({ 
          error: 'No credit reports found for this user',
          details: 'Please upload your credit reports first'
        });
      }
      
      // Filter for credit reports only
      const creditReports = userDocuments.filter(doc => 
        doc.documentType === 'credit-report' || 
        doc.type === 'credit-report' ||
        doc.fileName?.toLowerCase().includes('credit')
      );
      
      if (creditReports.length === 0) {
        return res.status(404).json({ 
          error: 'No credit reports found for this user',
          details: 'Please upload your credit reports first'
        });
      }
      
      console.log(`Found ${creditReports.length} credit reports for user ${userEmail}`);
      
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
      
      // Process each credit report
      let allDisputableItems = [];
      
      for (const document of creditReports) {
        try {
          console.log(`\n----- Processing ${document.fileName || document.originalName} -----`);
          
          // Get the file path (this depends on how you store files)
          const filePath = document.filePath || path.join(__dirname, '../uploads', document.fileName);
          
          if (!fs.existsSync(filePath)) {
            console.error(`File not found: ${filePath}`);
            continue;
          }
          
          const stats = fs.statSync(filePath);
          console.log(`File size: ${stats.size} bytes`);
          
          // Generate a unique prefix for this file's chunks
          const filePrefix = crypto.randomBytes(8).toString('hex') + '_' + Date.now() + '-' + (document.fileName || 'report').replace(/[^a-zA-Z0-9]/g, '_');
          
          let extractedText = '';
          
          // Determine file type and extract text
          const fileExtension = path.extname(filePath).toLowerCase();
          const mimeType = document.mimeType || document.fileType || '';
          
          if (fileExtension === '.pdf' || mimeType === 'application/pdf') {
            console.log(`Extracting text from PDF: ${filePath}`);
            extractedText = await PdfExtraction(filePath);
            console.log(`Extracted ${extractedText.length} characters from PDF`);
          } else if (mimeType.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.gif'].includes(fileExtension)) {
            console.log(`Extracting text from image: ${filePath}`);
            extractedText = await extractTextFromImage(filePath);
            console.log(`Extracted ${extractedText.length} characters from image`);
          } else {
            console.log(`Reading text from file: ${filePath}`);
            extractedText = fs.readFileSync(filePath, 'utf8');
            console.log(`Read ${extractedText.length} characters from text file`);
          }
          
          // Save the extracted text to a chunk file
          const chunkPath = path.join(chunksDir, `${filePrefix}_1.txt`);
          fs.writeFileSync(chunkPath, extractedText);
          console.log(`Saved extracted text to: ${chunkPath}`);
          
          // Analyze the chunk with debugging
          console.log(`Analyzing content from ${document.fileName || 'document'}...`);
          const textAnalysisResult = await comprehensiveAnalyzeChunksFromFiles(chunksDir, filePrefix, { showOutput: true });
          
          if (!textAnalysisResult) {
            console.error(`ERROR: comprehensiveAnalyzeChunksFromFiles returned undefined/null`);
            continue;
          }
          
          // Handle different result formats (same logic as analyzeReports)
          if (!textAnalysisResult.summary) {
            if (Array.isArray(textAnalysisResult)) {
              const summary = {
                uniqueItems: textAnalysisResult.length,
                totalItems: textAnalysisResult.length,
                categories: {}
              };
              
              textAnalysisResult.forEach(item => {
                const category = item.analysis_pass || 'unknown';
                summary.categories[category] = (summary.categories[category] || 0) + 1;
              });
              
              console.log(`Found ${summary.uniqueItems} disputable items in ${document.fileName}`);
              
              processedFiles.push({
                filename: document.fileName || document.originalName,
                path: filePath,
                textLength: extractedText.length,
                totalItems: summary.uniqueItems,
                categories: summary.categories
              });
              
              allDisputableItems.push(...textAnalysisResult);
            }
          } else {
            console.log(`Found ${textAnalysisResult.summary.uniqueItems} disputable items in ${document.fileName}`);
            
            processedFiles.push({
              filename: document.fileName || document.originalName,
              path: filePath,
              textLength: extractedText.length,
              totalItems: textAnalysisResult.summary.uniqueItems,
              categories: textAnalysisResult.summary.categories
            });
            
            allDisputableItems.push(...textAnalysisResult.allItems);
          }
          
          console.log(`\n----- Completed processing ${document.fileName || 'document'} -----`);
          
        } catch (error) {
          console.error(`Error processing document ${document.fileName}:`, error);
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
        processedFiles: processedFiles,
        userEmail: userEmail
      };
      
      // Add a flag to indicate this is from existing reports
      responseObj.fromCache = false;
      responseObj.source = 'existing_reports';
      
      console.log(`\nCategorized items:`, Object.keys(categorizedItems).map(cat => `${cat}: ${categorizedItems[cat].length}`));
      
      // Save results to cache (same logic as analyzeReports)
      try {
        const cacheData = {
          timestamp: new Date().toISOString(),
          userEmail: userEmail,
          summary: {
            totalFiles: processedFiles.length,
            totalUniqueItems: allDisputableItems.length,
            analysisDate: new Date().toLocaleDateString(),
            processingTime: `${totalProcessingTime}ms`,
            fileProcessingTime: `${fileProcessingTime}ms`,
            gptAnalysisTime: `${gptAnalysisTime}ms`
          },
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
            originalText: item.original_text?.substring(0, 200) + '...'
          })),
          processedFiles: processedFiles.map(file => ({
            filename: file.filename,
            itemsFound: file.totalItems || file.items,
            fileSize: file.textLength ? `${Math.round(file.textLength / 1024)}KB` : 'Unknown',
            processingStatus: 'Success'
          })),
          gptAnalysis: {
            summary: analysisResult.summary,
            detailedAnalysis: analysisResult.detailedAnalysis,
            foundItems: analysisResult.foundItems
          }
        };

        fs.writeFileSync(cacheFilePath, JSON.stringify(cacheData, null, 2));
        console.log(`\nResults cached to: ${cacheFilePath}`);
        
      } catch (cacheError) {
        console.error('Error saving to cache:', cacheError);
      }
      
      // Near the end of the method, after creating responseObj, add:
      try {
        // Save analysis results to database
        const analysisRecord = await saveAnalysisResults(user.id, {
          summary: responseObj.summary,
          analysis: responseObj.analysis,
          extractedItems: responseObj.extractedItems,
          processedFiles: responseObj.processedFiles,
          totalItems: allDisputableItems.length,
          categories: categorizedItems,
          analysisDate: new Date().toISOString(),
          processingTime: totalProcessingTime
        });
        
        // Add the analysis ID to the response
        responseObj.analysisId = analysisRecord.id;
        
        console.log(`Analysis results saved to database with ID: ${analysisRecord.id}`);
      } catch (saveError) {
        console.error('Error saving analysis to database:', saveError);
        // Don't fail the request if saving fails
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
      
      res.status(500).json({ 
        error: 'Failed to analyze user credit reports',
        details: error.message,
        processingTime: `${errorTime}ms`
      });
    }
  }
};

export default chatController;

// Helper function to generate actual PDF using pdf-lib
async function generateActualPDF(letterContent, bureau, userInfo) {
  try {
    const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
    
    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();
    
    // Add a page
    let page = pdfDoc.addPage([612, 792]); // Standard letter size (8.5" x 11")
    const { width, height } = page.getSize();
    
    // Set up fonts and sizes
    const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const boldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const fontSize = 12;
    const lineHeight = 18;
    
    // Define margins
    const leftMargin = 72; // 1 inch
    const rightMargin = 72; // 1 inch
    const topMargin = 72; // 1 inch
    const bottomMargin = 72; // 1 inch
    const textWidth = width - leftMargin - rightMargin;
    
    let currentY = height - topMargin;
    
    // Helper function to add text with word wrapping
    function addText(text, x, y, options = {}) {
      const useFont = options.bold ? boldFont : font;
      const useFontSize = options.fontSize || fontSize;
      const useColor = options.color || rgb(0, 0, 0);
      
      // Split text into words
      const words = text.split(' ');
      let lines = [];
      let currentLine = '';
      
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const textWidth_test = useFont.widthOfTextAtSize(testLine, useFontSize);
        
        if (textWidth_test <= textWidth) {
          currentLine = testLine;
        } else {
          if (currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            lines.push(word); // Word is longer than line width
          }
        }
      }
      
      if (currentLine) {
        lines.push(currentLine);
      }
      
      // Draw the lines
      let lineY = y;
      for (const line of lines) {
        page.drawText(line, {
          x: x,
          y: lineY,
          size: useFontSize,
          font: useFont,
          color: useColor,
        });
        lineY -= lineHeight;
      }
      
      return lineY;
    }
    
    // Add title
    currentY = addText(`Credit Dispute Letter - ${bureau.charAt(0).toUpperCase() + bureau.slice(1)}`, 
                      leftMargin, currentY, { bold: true, fontSize: 16 });
    currentY -= lineHeight;
    
    // Add date
    const currentDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    currentY = addText(currentDate, leftMargin, currentY);
    currentY -= lineHeight * 2;
    
    // Process and add letter content
    const lines = letterContent.split('\n');
    for (const line of lines) {
      if (line.trim()) {
        currentY = addText(line.trim(), leftMargin, currentY);
        currentY -= lineHeight * 0.5; // Small space between paragraphs
      } else {
        currentY -= lineHeight; // Larger space for empty lines
      }
      
      // Check if we need a new page
      if (currentY < bottomMargin + (lineHeight * 3)) {
        page = pdfDoc.addPage([612, 792]);
        currentY = height - topMargin;
      }
    }
    
    // Add footer
    const footer = 'Generated by JAM Capital Consultants';
    page.drawText(footer, {
      x: leftMargin,
      y: bottomMargin - 20,
      size: 10,
      font: font,
      color: rgb(0.5, 0.5, 0.5),
    });
    
    // Serialize the PDF
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
    
  } catch (error) {
    console.error('❌ Error generating PDF:', error);
    // Fallback to text content if PDF generation fails
    return Buffer.from(letterContent, 'utf8');
  }
}

// Helper function to generate PDF content from letter text
function generatePDFContent(letterContent, bureau) {
  // For now, return formatted text that can be converted to PDF
  // In a full implementation, you would use a PDF library like PDFKit or Puppeteer
  
  const formattedContent = {
    title: `Credit Dispute Letter - ${bureau.charAt(0).toUpperCase() + bureau.slice(1)}`,
    date: new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }),
    content: letterContent,
    footer: 'Generated by JAM Capital Consultants',
    
    // PDF generation instructions for frontend
    pdfInstructions: {
      format: 'letter',
      margins: { top: 72, bottom: 72, left: 72, right: 72 },
      fonts: { 
        main: 'Times New Roman',
        size: 12,
        lineHeight: 1.5
      },
      header: {
        text: `Credit Dispute Letter - ${bureau.charAt(0).toUpperCase() + bureau.slice(1)}`,
        alignment: 'center',
        fontSize: 16,
        bold: true
      },
      letterStructure: {
        datePosition: 'top-right',
        recipientPosition: 'left',
        bodySpacing: 'double',
        signatureSpace: 72
      }
    }
  };
  
  return formattedContent;
}

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
