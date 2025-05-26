import { analyzeChunkWithSpecificFocus } from './analyzeChunksWithFocus.js';
import { removeDuplicateItems } from './removeDuplicateItems.js';

/**
 * Performs comprehensive multi-pass analysis of credit report chunks with parallel processing
 * @param {Array<string>} chunks - Array of text chunks from the credit report
 * @param {Object} options - Analysis options
 * @returns {Promise<Array>} - Array of all disputable items
 */
// Keep this for now
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