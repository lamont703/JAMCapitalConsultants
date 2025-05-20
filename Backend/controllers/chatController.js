import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateDisputeResponse, analyzeCreditReports, generateDisputeLetter } from '../chatGptService.js';
import { extractTextFromPdf, extractTextFromImage } from '../utils/fileProcessing.js';
import crypto from 'crypto';

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the extractTextFromFiles function
async function extractTextFromFiles(files) {
  let combinedText = '';
  
  for (const file of files) {
    try {
      let extractedText = '';
      
      // Read file content as text
      extractedText = fs.readFileSync(file.path, 'utf8');
      combinedText += extractedText + '\n\n';
    } catch (error) {
      console.error(`Error extracting text from file ${file.originalname}:`, error);
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
      console.log('Received chat message:', req.body.message);
      
      const userMessage = req.body.message;
      if (!userMessage) {
        return res.status(400).json({ error: 'Message is required' });
      }
      
      const response = await generateDisputeResponse(userMessage);
      console.log('Generated response for chat message');
      
      return res.json({ response });
    } catch (error) {
      console.error('Error handling chat message:', error);
      return res.status(500).json({ error: 'Failed to process message' });
    }
  },
  
  // Handle credit report analysis
  async analyzeReports(req, res) {
    try {
      // Check if force refresh is requested
      const forceRefresh = req.body.forceRefresh === 'true';
      
      // Create a cache directory if it doesn't exist
      const cacheDir = path.join(__dirname, '../cache');
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
      
      // Generate a hash of the report files to use as a cache key
      const fileContents = [];
      for (const file of req.files) {
        const content = fs.readFileSync(file.path, 'utf8');
        fileContents.push(content);
      }
      
      // Create a hash of the combined file contents
      const contentHash = crypto
        .createHash('md5')
        .update(fileContents.join(''))
        .digest('hex');
      
      const cacheFilePath = path.join(cacheDir, `${contentHash}.json`);
      
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
      
      // Extract text from the uploaded files
      const extractedText = await extractTextFromFiles(req.files);
      
      // Analyze the extracted text using ChatGPT
      const analysisResult = await analyzeCreditReports(extractedText);
      
      console.log('\n==========================================\n');
      
      // Clean up uploaded files
      req.files.forEach(file => {
        fs.unlink(file.path, (err) => {
          if (err) console.error(`Error deleting file ${file.path}:`, err);
        });
      });
      
      // Create formatted readable text for frontend
      const formattedAnalysis = `
# Credit Report Analysis

## Summary
${analysisResult.summary}

## Detailed Analysis
${analysisResult.detailedAnalysis}
      `;
      
      // Prepare response object with both structured and formatted data
      const responseObj = {
        summary: analysisResult.summary,
        analysis: analysisResult.detailedAnalysis,
        formattedAnalysis: formattedAnalysis,
        foundItems: analysisResult.foundItems
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
  
  // Generate dispute letters
  async generateDisputeLetters(req, res) {
    try {
      const { items } = req.body;
      
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'No items provided for dispute' });
      }
      
      console.log(`Generating dispute letters for ${items.length} items`);
      
      // Format the items for the prompt
      const itemsText = items.map((item, index) => 
        `Item ${index + 1}: ${typeof item === 'string' ? item : item.description || JSON.stringify(item)}`
      ).join('\n\n');
      
      // Generate dispute letters using ChatGPT
      const prompt = `Generate professional dispute letters for the following items from my credit report:
      
${itemsText}

For each item, create a separate letter addressed to the appropriate credit bureau or creditor. 
Follow the standard dispute letter format including:
1. My contact information (use placeholder data)
2. Date
3. Recipient's contact information
4. Reference to the Fair Credit Reporting Act
5. Clear identification of the disputed item
6. Request for investigation and removal
7. Professional closing`;

      const response = await generateDisputeLetter({
        disputeType: 'multiple items',
        creditorName: 'various creditors',
        accountNumber: 'multiple',
        issueDescription: itemsText
      });

      // Parse the generated text into separate letters
      const letters = parseDisputeLetters(response, items);
      
      return res.json({ 
        success: true,
        letters: letters
      });
    } catch (error) {
      console.error('Error generating dispute letters:', error);
      return res.status(500).json({ error: 'Failed to generate dispute letters' });
    }
  }
};
