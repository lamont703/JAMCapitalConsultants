
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { PDFDocument } from 'pdf-lib';

// Configure OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Analyzes a credit report and extracts structured information
 * @param {string} reportText - The raw text from the credit report
 * @return {Object} Structured report data
 
export async function analyzeReport(reportText) {
  //console.log(`\n===== ANALYZING CREDIT REPORT =====`);
  //console.log(`Report text length: ${reportText.length} characters`);
  
  try {
    // Normalize line endings and remove excessive whitespace
    const normalizedText = reportText
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    
    //console.log(`Normalized text length: ${normalizedText.length} characters`);
    
    // Use GPT to analyze the report instead of manual parsing
    const analysisResults = await processReportWithGpt('', normalizedText);
    
    return {
      report_data: {},  // No longer using structured data
      disputable_items: analysisResults
    };
  } catch (error) {
    console.error('Error analyzing report:', error);
    return {
      error: error.message,
      report_data: {},
      disputable_items: []
    };
  }
}
*/
/**
 * Process a report chunk with GPT to extract disputable items
 * @param {string} filePath - Path to the file (for reference only)
 * @param {string} reportText - Text content to analyze
 * @returns {Promise<Array>} - Array of disputable items

export async function processReportWithGpt(filePath, reportText) {
  try {
    //console.log(`\n===== PROCESSING REPORT WITH GPT =====`);
    //console.log(`Text length: ${reportText.length} characters`);
    
    // Create a system prompt that instructs GPT on how to analyze credit reports
    const systemPrompt = `You are a credit report analysis expert. Your task is to analyze credit report text and identify potential items that could be disputed. 
    
For each disputable item, extract the following information:
1. Creditor name
2. Account number (last 4 digits only, if available)
3. Account type
4. Issue type (late payment, collection, inquiry, etc.)
5. Specific issue details
6. Reason why this item might be disputable

Format your response as a JSON array of objects with these fields:
- creditor_name: string
- account_number: string (last 4 digits only)
- account_type: string
- issue_type: string
- issue_details: string
- dispute_reason: string
- original_text: string (the relevant text from the report)`;

    // User prompt with the report text
    const userPrompt = `Please analyze this credit report text and identify potential disputable items:

${reportText}

Return ONLY a valid JSON array of disputable items with no additional text or explanation.`;

    // Call GPT API
    //console.log(`Calling GPT API to analyze report...`);
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 2048,
      response_format: { type: "json_object" }
    });

    // Extract and parse the response
    const responseText = response.choices[0].message.content;
    console.log(`Received response from GPT (${responseText.length} characters)`);
    
    try {
      // Parse the JSON response
      const parsedResponse = JSON.parse(responseText);
      const disputableItems = parsedResponse.items || parsedResponse;
      
      if (Array.isArray(disputableItems)) {
        //console.log(`Successfully extracted ${disputableItems.length} disputable items`);
        return disputableItems;
      } else {
        console.error(`Response is not an array: ${typeof disputableItems}`);
        return [];
      }
    } catch (parseError) {
      console.error(`Error parsing GPT response: ${parseError.message}`);
      console.error(`Response text: ${responseText.substring(0, 200)}...`);
      return [];
    }
  } catch (error) {
    console.error(`Error processing report with GPT: ${error.message}`);
    return [];
  }
}
 */
/**
 * Processes a PDF file and extracts text using the improved method
 * @param {string} filePath - Path to the PDF file
 * @returns {Promise<string>} - Extracted text

export async function extractTextFromPdf(filePath) {
  try {
    //console.log(`Extracting text from PDF: ${filePath}`);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }
    
    // Read the file as buffer
    const dataBuffer = fs.readFileSync(filePath);
    
    // Validate PDF
    try {
      await PDFDocument.load(dataBuffer);
      console.log("PDF validation successful");
    } catch (err) {
      console.error("PDF validation failed:", err.message);
      throw new Error(`Invalid PDF file: ${err.message}`);
    }
    
    // Use pdf-parse for text extraction
    const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
    
    // Extract text
    const pdfData = await pdfParse(dataBuffer, {
      // Provide an empty render callback to avoid test file dependency issues
      renderPage: () => Promise.resolve()
    });
    
    //console.log(`PDF extraction successful. Text length: ${pdfData.text.length} characters`);
    return pdfData.text;
  } catch (error) {
    console.error(`Error extracting text from PDF: ${filePath}`, error);
    throw error;
  }
}
 */
/**
 * Main function to analyze a credit report file
 * @param {string} filePath - Path to the credit report file
 * @returns {Promise<Object>} - Analysis results

export async function analyzeReportFile(filePath) {
  try {
    //console.log(`\n===== ANALYZING CREDIT REPORT FILE: ${filePath} =====\n`);
    
    // Extract text from PDF
    const reportText = await extractTextFromPdf(filePath);
    
    // Analyze the report
    const analysisResults = await analyzeReport(reportText);
    
    return analysisResults;
  } catch (error) {
    console.error('Error analyzing report file:', error);
    return {
      error: error.message,
      report_data: {},
      disputable_items: []
    };
  }
} 
 */