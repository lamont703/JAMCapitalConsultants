// gptAnalyzer.js - analyzes credit report chunks to identify disputable items using GPT. 3rd step in the credit report analysis process.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configure OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


/**
 * Analyzes credit report chunks to identify disputable items
 * @param {Array<string>} chunks - Array of text chunks from the credit report
 * @param {Object} options - Analysis options
 * @returns {Promise<Array>} - Array of disputable items
 */
export async function analyzeChunks(chunks, options = {}) {
  const showOutput = options.showOutput !== undefined ? options.showOutput : true;
  
  if (showOutput) console.log(`\n===== ANALYZING ${chunks.length} CREDIT REPORT CHUNKS =====\n`);
  
  const allDisputableItems = [];
  
  for (let i = 0; i < chunks.length; i++) {
    if (showOutput) console.log(`\nAnalyzing chunk ${i+1}/${chunks.length} (${chunks[i].length} characters)...`);
    
    try {
      const chunkItems = await analyzeChunkWithGpt(chunks[i], { ...options, showOutput });
      if (showOutput) console.log(`Found ${chunkItems.length} disputable items in chunk ${i+1}`);
      
      // Add chunk number to each item for reference
      chunkItems.forEach(item => {
        item.chunk_number = i + 1;
      });
      
      allDisputableItems.push(...chunkItems);
    } catch (error) {
      if (showOutput) console.error(`Error analyzing chunk ${i+1}:`, error.message);
    }
  }
  
  if (showOutput) {
    console.log(`\n===== ANALYSIS COMPLETE =====`);
    console.log(`Total disputable items found: ${allDisputableItems.length}`);
  }
  
  return allDisputableItems;
}

/**
 * Analyzes a single chunk with GPT to extract disputable items
 * @param {string} chunkText - Text content to analyze
 * @param {Object} options - Analysis options
 * @returns {Promise<Array>} - Array of disputable items
 */
async function analyzeChunkWithGpt(chunkText, options = {}) {
  const showOutput = options.showOutput !== undefined ? options.showOutput : true;
  
  try {
    // Create a system prompt that instructs GPT on how to analyze credit reports
    const systemPrompt = `You are JAM Dispute Bot — a friendly, knowledgeable AI assistant trained in U.S. consumer credit law, dispute best practices, and the proprietary methodology of JAM Capital Consultants.

Your job is to help users understand credit disputes, explain their credit report issues, and generate professional, legally sound dispute letters based on JAM's expert principles.

You always use clear, supportive, and empowering language that builds trust. Assume the user may be frustrated, confused, or unfamiliar with credit terminology — so speak with encouragement, clarity, and patience.

You reference relevant parts of the Fair Credit Reporting Act (FCRA) and structure each letter to be respectful, concise, and effective — never overly aggressive or legally threatening. Do not guarantee results.

JAM Dispute Bot follows JAM Capital Consultants' strategic credit dispute framework:

🧠 Dispute Strategies:
Factual Disputing: Compare all fields across bureaus. Flag inconsistencies in balance, payment history, dates, status, or account type. Challenge duplicates, outdated info, or accounts only reporting to one bureau.

Consumer Law-Based Disputing: When users say the account isn't theirs, request contracts or proof of account ownership. Ask how balances were calculated or who authorized the reporting.

Metro 2 Compliance: Identify coding errors, missing fields, skipped payment months, or charge-offs still reporting payments. Highlight any violations of data format standards — if they can't correct it, they must delete it.

✍️ Preferred Letter Styles:
Factual Letters: Clear, data-based, side-by-side bureau comparisons when needed.

Consumer Letters: Emotional, personal, ask direct questions about verification and authorization.

Metro 2 Letters: Compliance-focused, referencing reporting structure and formatting.

🧾 Dispute Logic:
If data can't be verified or proven, it's inaccurate and should be removed.

If ownership or documentation is missing, the reporting is not legally valid.

Any Metro 2 formatting error makes the account disputable.

💬 JAM's Core Philosophy:
If they can't prove it, they can't report it.

The credit bureaus don't define truth — the consumer does.

Accuracy must exist across all 3 bureaus. One error = flawed.

Every dispute is a case. Investigate it thoroughly.

We don't just delete accounts — we educate and empower clients.

The more specific and raw the letter, the more power it holds.

JAM Dispute Bot is part of the JAM Engine — a platform built to restore power, rebuild credit, and respect the process.

For each disputable item, extract the following information:
1. Creditor name
2. Account number (last 4 digits only, if available)
3. Account type
4. Issue type (late payment, collection, inquiry, etc.)
5. Specific issue details
6. Reason why this item might be disputable

Format your response as a JSON object with an "items" array containing objects with these fields:
{
  "items": [
    {
      "creditor_name": string,
      "account_number": string (last 4 digits only),
      "account_type": string,
      "issue_type": string,
      "issue_details": string,
      "dispute_reason": string,
      "original_text": string (the relevant text from the report)
    },
    ...more items
  ]
}

Only include items that have legitimate reasons for dispute, such as:
- Inaccurate information
- Outdated information (older than 7 years for most negative items)
- Unverifiable information
- Duplicate accounts
- Accounts that don't belong to the consumer
- Unauthorized inquiries
- Incorrect personal information

If no disputable items are found, return {"items": []}.`;

    // User prompt with the report text
    const userPrompt = `Please analyze this credit report text and identify potential disputable items:

${chunkText}

Return ONLY a valid JSON object with an "items" array containing disputable items with no additional text or explanation.`;

    // Call GPT API with updated system prompt and assistant examples
    if (showOutput) console.log(`Calling GPT API to analyze chunk...`);
    const model = options.model || "gpt-4o-mini";
    const temperature = options.temperature || 0.1;
    
    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        { 
          role: "user", 
          content: "what is our dispute strategy" 
        },
        { 
          role: "assistant", 
          content: "Great question! JAM Capital Consultants' dispute strategy is built around a powerful, multi-layered approach designed to protect your rights and help you achieve accurate credit reporting. Here's a concise summary of our core dispute strategy:\n\n### 🧠 JAM's Dispute Strategy\n\n1. **Factual Disputing**  \n   We carefully compare all account details across the three major credit bureaus (Experian, Equifax, and TransUnion). This includes balances, payment histories, dates, account types, and statuses.  \n   - We flag discrepancies like duplicate accounts, accounts showing different balances or payment histories, outdated information, or accounts that only appear on one bureau.  \n   - If the data isn't consistent everywhere, it's inaccurate and challengeable.\n\n2. **Consumer Law-Based Disputing**  \n   When you say an account isn't yours or contains unauthorized information, we challenge the bureaus and creditors to provide contracts or proof of ownership.  \n   - We ask for detailed verification about how balances or fees were calculated.  \n   - We question who authorized the reporting and ensure your rights under the Fair Credit Reporting Act (FCRA) are upheld.\n\n3. **Metro 2 Compliance Disputing**  \n   Metro 2 is the data reporting standard lenders and bureaus must follow.  \n   - We identify reporting issues such as coding errors, missing required fields, skipped months in payment histories, or accounts showing payments after charge-off dates.  \n   - If the data format is incorrect or incomplete, they are required to fix it—or remove the information altogether.\n\n### 🧾 Core Dispute Logic\n- If they **can't verify or prove** the accuracy of the info, it must be removed.  \n- Without **proper ownership documents** or valid authorization, the reporting is not legally valid.  \n- Any **Metro 2 compliance error** gives you legal grounds to dispute.\n\n### 💬 Our Philosophy  \nRemember, the bureaus don't define truth — *you* do. Only accurate, verified, consistent information should remain on your report. One error in one bureau means the whole report is flawed.\n\n---\n\nIf you want, I can help you draft a dispute letter using this strategy tailored to your specific issue. Or, if you prefer full-service support, JAM Capital Consultants is ready to assist you with a personalized plan.\n\nFeel free to share any details about your credit problem, and I'll guide you from there!" 
        },
        { 
          role: "assistant", 
          content: "JAM Capital Consultants' dispute strategy is a precise, multi-layered approach built on three key pillars:\n\n1. **Factual Disputing**  \n   We compare account details across all three bureaus—balances, payment history, dates, statuses, and account types. Any differences like duplicates, outdated info, or mismatched data signal inaccuracies that must be challenged.\n\n2. **Consumer Law-Based Disputing**  \n   If you say an account isn't yours or is incorrect, we request contracts or proof of ownership and ask how balances were calculated or who authorized reporting, enforcing your rights under the Fair Credit Reporting Act (FCRA).\n\n3. **Metro 2 Compliance Disputing**  \n   We check for reporting errors under the Metro 2 standard—coding mistakes, missing fields, skipped payment months, or illogical data like payments reported after charge-offs. Such violations require correction or deletion.\n\n**Core logic:** If info can't be verified, is unauthorized, or breaks Metro 2 rules, it's inaccurate and must be removed.\n\nIn short: The bureaus don't decide truth—you do. Correct, consistent data across all bureaus is the standard. One error anywhere means your report is flawed. We're here to help you build disputes that are clear, specific, and effective.\n\nIf you want, I can help draft a letter or guide you step-by-step. You can also reach out to JAM Capital Consultants for full-service or personalized credit improvement plans anytime." 
        },
        { role: "user", content: userPrompt }
      ],
      temperature: temperature,
      max_tokens: 2048,
      response_format: { type: "json_object" }
    });

    // Extract the response text
    const responseText = response.choices[0].message.content;
    if (showOutput) console.log(`Received response from GPT (${responseText.length} characters)`);
    
    try {
      // Parse the JSON response
      const parsedResponse = JSON.parse(responseText);
      
      // Check if the response contains an items array
      if (parsedResponse.items && Array.isArray(parsedResponse.items)) {
        if (showOutput) console.log(`Found ${parsedResponse.items.length} disputable items in response`);
        return parsedResponse.items;
      }
      
      // Check if the response itself is an array
      if (Array.isArray(parsedResponse)) {
        if (showOutput) console.log(`Found ${parsedResponse.length} disputable items in response`);
        return parsedResponse;
      }
      
      // If we have a different structure, try to extract items
      if (typeof parsedResponse === 'object') {
        // Look for any array property that might contain items
        for (const key in parsedResponse) {
          if (Array.isArray(parsedResponse[key])) {
            if (showOutput) console.log(`Found ${parsedResponse[key].length} disputable items in response.${key}`);
            return parsedResponse[key];
          }
        }
        
        // If no arrays found, convert object properties to an array if they look like items
        if (parsedResponse.creditor_name || parsedResponse.account_number) {
          if (showOutput) console.log(`Found a single disputable item in response`);
          return [parsedResponse];
        }
      }
      
      // If we can't find items, return empty array
      if (showOutput) console.log(`No disputable items found in response`);
      return [];
      
    } catch (parseError) {
      console.error(`Error parsing GPT response as JSON:`, parseError);
      console.error(`Response text:`, responseText);
      return [];
    }
    
  } catch (error) {
    console.error(`Error calling GPT API:`, error);
    throw error;
  }
}

/**
 * Displays disputable items in a formatted way in the terminal
 * @param {Array} items - Array of disputable items
 */
export function displayDisputableItems(items, options = {}) {
  const showOutput = options.showOutput !== undefined ? options.showOutput : true;
  if (!showOutput) return;
  
  console.log(`\n===== DISPLAYING ${items.length} DISPUTABLE ITEMS =====\n`);
  
  if (items.length === 0) {
    console.log('No disputable items found.');
    return;
  }
  
  // Group items by creditor
  const itemsByCreditor = {};
  items.forEach(item => {
    const creditor = item.creditor_name || 'Unknown Creditor';
    if (!itemsByCreditor[creditor]) {
      itemsByCreditor[creditor] = [];
    }
    itemsByCreditor[creditor].push(item);
  });
  
  // Display items by creditor
  Object.keys(itemsByCreditor).sort().forEach(creditor => {
    console.log(`\n----- ${creditor.toUpperCase()} -----`);
    
    itemsByCreditor[creditor].forEach((item, index) => {
      console.log(`\nItem #${index + 1}:`);
      console.log(`Account: ${item.account_number ? `****${item.account_number}` : 'N/A'}`);
      console.log(`Type: ${item.account_type || 'N/A'}`);
      console.log(`Issue: ${item.issue_type || 'N/A'}`);
      console.log(`Details: ${item.issue_details || 'N/A'}`);
      console.log(`Dispute Reason: ${item.dispute_reason || 'N/A'}`);
      console.log(`Found in chunk: ${item.chunk_number || 'N/A'}`);
    });
  });
  
  console.log('\n===== END OF DISPUTABLE ITEMS =====\n');
}

/**
 * Saves disputable items to a JSON file
 * @param {Array} items - Array of disputable items
 * @param {string} filePath - Path to save the file
 */
export function saveDisputableItems(items, filePath) {
  try {
    const outputDir = path.dirname(filePath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    fs.writeFileSync(filePath, JSON.stringify(items, null, 2));
    console.log(`Saved ${items.length} disputable items to ${filePath}`);
  } catch (error) {
    console.error(`Error saving disputable items: ${error.message}`);
  }
}

/**
 * Main function to analyze credit report chunks from files
 * @param {string} chunksDir - Directory containing chunk files
 * @param {string} filePrefix - Prefix for chunk files
 * @param {Object} options - Analysis options
 * @returns {Promise<Array>} - Array of disputable items
 */
export async function analyzeChunksFromFiles(chunksDir, filePrefix, options = {}) {
  // Default showOutput to true if not specified
  const showOutput = options.showOutput !== undefined ? options.showOutput : true;
  
  if (showOutput) {
    console.log(`\n===== ANALYZING CHUNKS FROM FILES =====\n`);
    console.log(`Looking for chunks in: ${chunksDir}`);
    console.log(`File prefix: ${filePrefix}`);
  }
  
  try {
    // Check if directory exists
    if (!fs.existsSync(chunksDir)) {
      if (showOutput) console.log(`Chunks directory does not exist: ${chunksDir}`);
      throw new Error(`Chunks directory does not exist: ${chunksDir}`);
    }
    
    // Get chunk files
    const chunkFiles = fs.readdirSync(chunksDir)
      .filter(file => file.startsWith(filePrefix))
      .sort((a, b) => {
        const numA = parseInt(a.replace(`${filePrefix}_`, '').replace('.txt', ''));
        const numB = parseInt(b.replace(`${filePrefix}_`, '').replace('.txt', ''));
        return numA - numB;
      });
    
    if (showOutput) console.log(`Found ${chunkFiles.length} chunk files`);
    
    if (chunkFiles.length === 0) {
      if (showOutput) console.log(`No chunk files found with prefix: ${filePrefix}`);
      throw new Error(`No chunk files found with prefix: ${filePrefix}`);
    }
    
    // Read chunks from files
    const chunks = chunkFiles.map(chunkFile => {
      const chunkPath = path.join(chunksDir, chunkFile);
      return fs.readFileSync(chunkPath, 'utf8');
    });
    
    if (showOutput) console.log(`Loaded ${chunks.length} chunks from files`);
    
    // Analyze chunks with the same showOutput option
    const disputableItems = await analyzeChunks(chunks, { ...options, showOutput });
    
    // Display items in terminal only if showOutput is true
    if (showOutput) {
      displayDisputableItems(disputableItems);
    }
    
    // Save items to file
    const outputPath = path.join(chunksDir, `${filePrefix}_analysis.json`);
    saveDisputableItems(disputableItems, outputPath);
    
    return disputableItems;
  } catch (error) {
    if (showOutput) console.error(`Error analyzing chunks from files: ${error.message}`);
    return [];
  }
}

/**
 * Performs comprehensive multi-pass analysis of credit report chunks with parallel processing
 * @param {Array<string>} chunks - Array of text chunks from the credit report
 * @param {Object} options - Analysis options
 * @returns {Promise<Array>} - Array of all disputable items
 */
export async function comprehensiveAnalyzeChunks(chunks, options = {}) {
  const showOutput = options.showOutput !== undefined ? options.showOutput : true;
  
  if (showOutput) console.log(`\n===== COMPREHENSIVE ANALYSIS OF ${chunks.length} CHUNKS =====\n`);
  
  // Define different analysis passes
  const analysisPasses = [
    {
      name: "Personal Information Errors",
      focus: "personal_info",
      prompt: "Focus ONLY on personal information errors: incorrect names, addresses, SSN, employment history, phone numbers, date of birth, etc. Be extremely thorough - even minor spelling differences or outdated addresses should be flagged."
    },
    {
      name: "Account Status Issues", 
      focus: "account_status",
      prompt: "Focus ONLY on account status problems: incorrect balances, wrong payment statuses, closed accounts showing as open, paid accounts showing balances, etc. Flag ANY inconsistency in account status."
    },
    {
      name: "Payment History Errors",
      focus: "payment_history", 
      prompt: "Focus ONLY on payment history issues: late payments that weren't late, missing payments, incorrect payment dates, payments showing after charge-off, etc. Be aggressive - question ANY payment history that seems questionable."
    },
    {
      name: "Duplicate Accounts",
      focus: "duplicates",
      prompt: "Focus ONLY on finding duplicate accounts: same creditor with multiple entries, similar account numbers, accounts that appear to be the same but with different details, etc."
    },
    {
      name: "Outdated Information",
      focus: "outdated",
      prompt: "Focus ONLY on outdated information: items older than 7 years (except bankruptcies which are 10 years), old addresses, outdated employment, etc. Be strict about reporting timeframes."
    },
    {
      name: "Unauthorized Inquiries",
      focus: "inquiries",
      prompt: "Focus ONLY on credit inquiries: unauthorized hard inquiries, inquiries you don't recognize, inquiries from companies you never applied with, etc. Flag ANY inquiry that seems questionable."
    },
    {
      name: "Collections & Charge-offs",
      focus: "collections",
      prompt: "Focus ONLY on collections and charge-offs: incorrect amounts, paid collections still showing, collections that should be removed, charge-offs with incorrect dates or amounts, etc."
    },
    {
      name: "Metro 2 Compliance Issues",
      focus: "metro2",
      prompt: "Focus ONLY on Metro 2 format violations: missing required fields, incorrect codes, formatting errors, accounts missing payment history, incomplete data fields, etc."
    },
    {
      name: "Unverifiable Information",
      focus: "unverifiable",
      prompt: "Focus ONLY on information that cannot be easily verified: accounts with missing documentation, creditors that no longer exist, accounts with incomplete information, etc."
    },
    {
      name: "General Inconsistencies",
      focus: "inconsistencies",
      prompt: "Focus ONLY on ANY other inconsistencies, errors, or questionable information not covered in other passes. Be extremely aggressive - if ANYTHING looks wrong, flag it."
    }
  ];
  
  // Create all analysis tasks upfront
  const analysisPromises = [];
  
  if (showOutput) console.log(`Creating ${analysisPasses.length * chunks.length} parallel analysis tasks...`);
  
  for (const pass of analysisPasses) {
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const promise = analyzeChunkWithSpecificFocus(chunks[chunkIndex], pass, { 
        ...options, 
        showOutput: false // Disable individual output to avoid spam
      })
      .then(passItems => {
        // Add metadata to items
        passItems.forEach(item => {
          item.chunk_number = chunkIndex + 1;
          item.analysis_pass = pass.focus;
          item.pass_name = pass.name;
        });
        
        return { 
          passName: pass.name, 
          chunkIndex, 
          items: passItems,
          success: true 
        };
      })
      .catch(error => {
        if (showOutput) {
          console.error(`Error in ${pass.name} analysis for chunk ${chunkIndex + 1}:`, error.message);
        }
        return { 
          passName: pass.name, 
          chunkIndex, 
          items: [],
          success: false,
          error: error.message 
        };
      });
      
      analysisPromises.push(promise);
    }
  }
  
  // Execute all analysis tasks in parallel
  if (showOutput) {
    console.log(`Executing ${analysisPromises.length} analysis tasks in parallel...`);
    console.log(`This should complete much faster than sequential processing!`);
  }
  
  const startTime = Date.now();
  const results = await Promise.all(analysisPromises);
  const endTime = Date.now();
  
  if (showOutput) {
    console.log(`Parallel analysis completed in ${((endTime - startTime) / 1000).toFixed(2)} seconds`);
  }
  
  // Collect all items and organize results
  const allDisputableItems = [];
  const passResults = {};
  
  results.forEach(result => {
    if (result.success && result.items.length > 0) {
      allDisputableItems.push(...result.items);
      
      // Track results by pass for reporting
      if (!passResults[result.passName]) {
        passResults[result.passName] = { total: 0, chunks: [] };
      }
      passResults[result.passName].total += result.items.length;
      passResults[result.passName].chunks.push({
        chunkIndex: result.chunkIndex,
        itemCount: result.items.length
      });
    }
  });
  
  // Remove duplicates
  const uniqueItems = removeDuplicateItems(allDisputableItems);
  
  if (showOutput) {
    console.log(`\n===== PARALLEL ANALYSIS RESULTS =====`);
    console.log(`Total items found across all passes: ${allDisputableItems.length}`);
    console.log(`Unique disputable items after deduplication: ${uniqueItems.length}`);
    
    // Show breakdown by analysis pass
    console.log(`\n--- Results by Analysis Pass ---`);
    Object.entries(passResults).forEach(([passName, data]) => {
      console.log(`${passName}: ${data.total} items`);
    });
    
    console.log(`\n===== COMPREHENSIVE ANALYSIS COMPLETE =====`);
  }
  
  return uniqueItems;
}

/**
 * Analyzes a chunk with specific focus area
 * @param {string} chunkText - Text content to analyze
 * @param {Object} analysisPass - Analysis pass configuration
 * @param {Object} options - Analysis options
 * @returns {Promise<Array>} - Array of disputable items
 */
async function analyzeChunkWithSpecificFocus(chunkText, analysisPass, options = {}) {
  const showOutput = options.showOutput !== undefined ? options.showOutput : true;
  
  try {
    const systemPrompt = `You are JAM Dispute Bot specializing in ${analysisPass.name}. 

${analysisPass.prompt}

Be EXTREMELY thorough and aggressive in finding issues. Your job is to find EVERY possible dispute opportunity related to ${analysisPass.focus}. Look for:
- ANY inconsistencies, no matter how small
- Missing information that should be present
- Information that seems questionable or unverifiable
- Formatting or coding errors
- Anything that doesn't look 100% accurate and verifiable

JAM's Core Philosophy for ${analysisPass.focus}:
- If they can't prove it, they can't report it
- The credit bureaus don't define truth — the consumer does
- Accuracy must exist across all 3 bureaus. One error = flawed
- When in doubt, DISPUTE IT

For this focused analysis on ${analysisPass.focus}, extract EVERY potential issue you can find. Be very liberal in what you consider disputable - it's better to flag something that might not be disputable than to miss a real opportunity.

Format your response as a JSON object with an "items" array:

{
  "items": [
    {
      "creditor_name": string,
      "account_number": string (last 4 digits only),
      "account_type": string,
      "issue_type": string,
      "issue_details": string,
      "dispute_reason": string,
      "original_text": string (the relevant text from the report),
      "confidence_level": "high|medium|low"
    }
  ]
}

If no disputable items are found for ${analysisPass.focus}, return {"items": []}.`;

    const userPrompt = `Analyze this credit report text SPECIFICALLY for ${analysisPass.name}. ${analysisPass.prompt}

Be EXTREMELY thorough - find EVERY potential issue related to ${analysisPass.focus}. When in doubt, include it:

${chunkText}

Return ONLY a valid JSON object with ALL potential ${analysisPass.focus} issues you can find.`;

    const model = options.model || "gpt-4o-mini";
    const temperature = options.temperature || 0.1;
    
    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: temperature,
      max_tokens: 2048,
      response_format: { type: "json_object" }
    });

    const responseText = response.choices[0].message.content;
    
    try {
      const parsedResponse = JSON.parse(responseText);
      
      if (parsedResponse.items && Array.isArray(parsedResponse.items)) {
        return parsedResponse.items;
      }
      
      if (Array.isArray(parsedResponse)) {
        return parsedResponse;
      }
      
      if (typeof parsedResponse === 'object') {
        for (const key in parsedResponse) {
          if (Array.isArray(parsedResponse[key])) {
            return parsedResponse[key];
          }
        }
        
        if (parsedResponse.creditor_name || parsedResponse.account_number) {
          return [parsedResponse];
        }
      }
      
      return [];
      
    } catch (parseError) {
      console.error(`Error parsing GPT response for ${analysisPass.name}:`, parseError);
      return [];
    }
    
  } catch (error) {
    console.error(`Error in ${analysisPass.name} analysis:`, error);
    throw error;
  }
}

/**
 * Removes duplicate items based on creditor name, account number, and issue type
 * @param {Array} items - Array of disputable items
 * @returns {Array} - Array of unique items
 */
function removeDuplicateItems(items) {
  const seen = new Set();
  return items.filter(item => {
    const key = `${item.creditor_name}_${item.account_number}_${item.issue_type}_${item.issue_details}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * Analyzes chunks from files with comprehensive multi-pass approach
 * @param {string} chunksDir - Directory containing chunk files
 * @param {string} filePrefix - Prefix for chunk files
 * @param {Object} options - Analysis options
 * @returns {Promise<Array>} - Array of disputable items
 */
export async function comprehensiveAnalyzeChunksFromFiles(chunksDir, filePrefix, options = {}) {
  const showOutput = options.showOutput !== undefined ? options.showOutput : true;
  
  try {
    // Read all chunk files for this prefix
    const chunkFiles = fs.readdirSync(chunksDir)
      .filter(f => f.startsWith(filePrefix) && f.endsWith('.txt'))
      .sort();
    
    if (chunkFiles.length === 0) {
      if (showOutput) console.log(`No chunk files found for prefix: ${filePrefix}`);
      return [];
    }
    
    if (showOutput) console.log(`Found ${chunkFiles.length} chunk files for comprehensive analysis`);
    
    // Read chunk contents
    const chunks = chunkFiles.map(filename => {
      const filePath = path.join(chunksDir, filename);
      return fs.readFileSync(filePath, 'utf8');
    });
    
    // Use comprehensive analysis
    return await comprehensiveAnalyzeChunks(chunks, options);
    
  } catch (error) {
    console.error('Error in comprehensive chunk analysis:', error);
    return [];
  }
}

// If this file is run directly, analyze chunks from files
if (import.meta.url.endsWith(process.argv[1].replace(/ /g, '%20')) || 
    import.meta.url === `file://${process.argv[1]}` ||
    import.meta.url === `file://${process.argv[1].replace(/ /g, '%20')}`) {
  console.log("Direct execution detected!");
  
  const chunksDir = process.argv[2] || path.join(__dirname, '../chunks');
  const filePrefix = process.argv[3] || 'test_chunks';
  
  console.log(`\n===== CREDIT REPORT ANALYZER =====`);
  console.log(`Chunks directory: ${chunksDir}`);
  console.log(`File prefix: ${filePrefix}`);
  
  // Check if chunks directory exists
  console.log(`Chunks directory exists: ${fs.existsSync(chunksDir)}`);
  
  if (fs.existsSync(chunksDir)) {
    const files = fs.readdirSync(chunksDir);
    console.log(`Files in chunks directory: ${files.join(', ')}`);
    
    const matchingFiles = files.filter(file => file.startsWith(filePrefix));
    console.log(`Files matching prefix '${filePrefix}': ${matchingFiles.join(', ')}`);
  } else {
    console.log("Creating chunks directory...");
    fs.mkdirSync(chunksDir, { recursive: true });
    console.log(`Created chunks directory: ${chunksDir}`);
  }
  
  // Run the analysis
  comprehensiveAnalyzeChunksFromFiles(chunksDir, filePrefix)
    .then(items => {
      console.log(`Analysis complete. Found ${items.length} disputable items.`);
      process.exit(0);
    })
    .catch(error => {
      console.error('Error in analysis:', error);
      process.exit(1);
    });
} else {
  
} 