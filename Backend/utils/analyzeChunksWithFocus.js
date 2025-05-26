import pLimit from 'p-limit';
import { openai } from '../config/openaiConfig.js';

const limit = pLimit(5);

/**
 * Analyzes a chunk with specific focus area (with rate limiting)
 * @param {string} chunkText - Text content to analyze
 * @param {Object} analysisPass - Analysis pass configuration
 * @param {Object} options - Analysis options
 * @returns {Promise<Array>} - Array of disputable items
 */
// Keep this for now
export async function analyzeChunkWithSpecificFocus(chunkText, analysisPass, options = {}) {
  // Wrap the entire function in the rate limiter
  return limit(async () => {
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
- Only list each unique account/issue ONCE
- If you see the same account mentioned multiple times, consolidate into a single entry
- Focus on unique, distinct disputable items


JAM's Core Philosophy for ${analysisPass.focus}:
- If they can't prove it, they can't report it
- The credit bureaus don't define truth — the consumer does
- Accuracy must exist across all 3 bureaus. One error = flawed
- When in doubt, DISPUTE IT

For this focused analysis on ${analysisPass.focus}, extract EVERY potential issue you can find. Be very liberal in what you consider disputable - it's better to flag something that might not be disputable than to miss a real opportunity.

IMPORTANT: Your response MUST be valid JSON. Keep descriptions concise to avoid truncation.

Format your response as a JSON object with an "items" array:

{
  "items": [
    {
      "creditor_name": "string",
      "account_number": "string (last 4 digits only)",
      "account_type": "string",
      "issue_type": "string",
      "issue_details": "string (keep brief)",
      "dispute_reason": "string (keep brief)",
      "original_text": "string (keep brief)",
      "confidence_level": "high|medium|low"
    }
  ]
}

If no disputable items are found for ${analysisPass.focus}, return {"items": []}.`;

      const userPrompt = `Analyze this credit report text SPECIFICALLY for ${analysisPass.name}. ${analysisPass.prompt}

Be EXTREMELY thorough - find EVERY potential issue related to ${analysisPass.focus}. When in doubt, include it:

${chunkText.substring(0, 4000)}

Return ONLY a valid JSON object with ALL potential ${analysisPass.focus} issues you can find. Keep descriptions brief.`;

      const model = options.model || "gpt-4o-mini";
      const temperature = options.temperature || 0.1;
      
      const response = await openai.chat.completions.create({
        model: model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: temperature,
        max_tokens: 2500,
        response_format: { type: "json_object" }
      });

      let responseText = response.choices[0].message.content.trim();
      
      // Clean up response
      if (responseText.startsWith('```json')) {
        responseText = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (responseText.startsWith('```')) {
        responseText = responseText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
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
        console.error(`JSON parse error for ${analysisPass.name}:`, parseError.message);
        
        // Try to recover by finding the last complete item
        try {
          const itemsMatch = responseText.match(/"items":\s*\[(.*)\]/s);
          if (itemsMatch) {
            let itemsContent = itemsMatch[1];
            
            // Find the last complete object (ends with })
            const lastCompleteItem = itemsContent.lastIndexOf('}');
            if (lastCompleteItem > -1) {
              itemsContent = itemsContent.substring(0, lastCompleteItem + 1);
              const fixedJson = `{"items":[${itemsContent}]}`;
              
              const fixedResponse = JSON.parse(fixedJson);
              if (fixedResponse.items && Array.isArray(fixedResponse.items)) {
                console.log(`Recovered ${fixedResponse.items.length} items for ${analysisPass.name}`);
                return fixedResponse.items;
              }
            }
          }
        } catch (fixError) {
          console.error(`Could not recover JSON for ${analysisPass.name}`);
        }
        
        return [];
      }
      
    } catch (error) {
      console.error(`Error in ${analysisPass.name} analysis:`, error.message);
      return [];
    }
  });
}