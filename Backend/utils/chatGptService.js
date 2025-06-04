import openai from '../config/openaiConfig.js';
import dotenv from "dotenv";

dotenv.config();

/**
 * Sends a request to the OpenAI API for generating dispute-related content
 * @param {string} userMessage - The user's message or query
 * @returns {Promise<string>} - The AI-generated response
 */
export async function generateDisputeResponse(userMessage) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Using a standard OpenAI model
      messages: [
        {
          role: "system",
          content: "You are JAM Dispute Bot — a friendly, knowledgeable AI assistant trained in U.S. consumer credit law, dispute best practices, and the proprietary methodology of JAM Capital Consultants.\n\nYour job is to help users understand credit disputes, explain their credit report issues, and generate professional, legally sound dispute letters based on JAM's expert principles.\n\nYou always use clear, supportive, and empowering language that builds trust. Assume the user may be frustrated, confused, or unfamiliar with credit terminology — so speak with encouragement, clarity, and patience.\n\nYou reference relevant parts of the Fair Credit Reporting Act (FCRA) and structure each letter to be respectful, concise, and effective — never overly aggressive or legally threatening. Do not guarantee results.\n\nJAM Dispute Bot follows JAM Capital Consultants' strategic credit dispute framework:\n\n🧠 Dispute Strategies:\nFactual Disputing: Compare all fields across bureaus. Flag inconsistencies in balance, payment history, dates, status, or account type. Challenge duplicates, outdated info, or accounts only reporting to one bureau.\n\nConsumer Law-Based Disputing: When users say the account isn't theirs, request contracts or proof of account ownership. Ask how balances were calculated or who authorized the reporting.\n\nMetro 2 Compliance: Identify coding errors, missing fields, skipped payment months, or charge-offs still reporting payments. Highlight any violations of data format standards — if they can't correct it, they must delete it.\n\n✍️ Preferred Letter Styles:\nFactual Letters: Clear, data-based, side-by-side bureau comparisons when needed.\n\nConsumer Letters: Emotional, personal, ask direct questions about verification and authorization.\n\nMetro 2 Letters: Compliance-focused, referencing reporting structure and formatting.\n\n🧾 Dispute Logic:\nIf data can't be verified or proven, it's inaccurate and should be removed.\n\nIf ownership or documentation is missing, the reporting is not legally valid.\n\nAny Metro 2 formatting error makes the account disputable.\n\n💬 JAM's Core Philosophy:\nIf they can't prove it, they can't report it.\n\nThe credit bureaus don't define truth — the consumer does.\n\nAccuracy must exist across all 3 bureaus. One error = flawed.\n\nEvery dispute is a case. Investigate it thoroughly.\n\nWe don't just delete accounts — we educate and empower clients.\n\nThe more specific and raw the letter, the more power it holds.\n\nJAM Dispute Bot is part of the JAM Engine — a platform built to restore power, rebuild credit, and respect the process.\n\nAlways conclude with a reminder that the user can reach out to JAM Capital Consultants for additional help, full-service support, or a personalized credit improvement plan."
        },
        {
          role: "user",
          content: userMessage
        }
      ],
      temperature: 0.7,
      max_tokens: 2048,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    throw new Error("Failed to generate dispute response");
  }
}

/**
 * Generates a dispute letter based on specific parameters
 * @param {Array} disputeItems - Array of dispute items
 * @param {Object} userInfo - User information object
 * @returns {Promise<string>} - The generated dispute letter
 */
export async function generateDisputeLetter(disputeItems, userInfo) {
  // Handle both old format (single object) and new format (array + userInfo)
  if (!Array.isArray(disputeItems)) {
    // Old format - single object with disputeDetails
    const disputeDetails = disputeItems;
    const { 
      disputeType, 
      creditorName, 
      accountNumber, 
      issueDescription,
      userInfo: oldUserInfo,
      creditorInfo,
      currentDate
    } = disputeDetails;
    
    let prompt = `Generate a professional dispute letter for a ${disputeType} issue with ${creditorName} (account ending in ${accountNumber}).
    
Issue details: ${issueDescription}

${oldUserInfo || ''}

${creditorInfo || ''}

${currentDate || ''}

The letter should follow JAM Capital Consultants' dispute framework, reference relevant FCRA sections, and be formatted as a proper business letter with the user's information included above. Include the current date, sender's information, recipient's information, subject line, salutation, body, closing, and signature.`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are JAM Dispute Bot — a friendly, knowledgeable AI assistant trained in U.S. consumer credit law, dispute best practices, and the proprietary methodology of JAM Capital Consultants. Your task is to generate professional, legally sound dispute letters based on JAM's expert principles. Include all user and creditor information provided in the proper business letter format."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2048,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
      });

      return response.choices[0].message.content;
    } catch (error) {
      console.error("Error generating dispute letter:", error);
      throw new Error("Failed to generate dispute letter");
    }
  }

  // New format - array of items + userInfo object
  if (!disputeItems || !Array.isArray(disputeItems) || disputeItems.length === 0) {
    throw new Error("No dispute items provided");
  }

  if (!userInfo || !userInfo.userEmail) {
    throw new Error("User information is required");
  }

  console.log(`Generating dispute letter for ${disputeItems.length} items`);
  console.log(`User info:`, userInfo);
  console.log(`Items:`, disputeItems.map(item => ({ creditor: item.creditor_name, account: item.account_number })));

  // Extract user information
  const userName = userInfo.name || `${userInfo.firstName || '[First Name]'} ${userInfo.lastName || '[Last Name]'}`;
  const userEmail = userInfo.userEmail || userInfo.email || '[Email]';
  const userPhone = userInfo.phone || '[Phone Number]';
  const userAddress = userInfo.address || '[Your Address]';
  const userCity = userInfo.city || '[City]';
  const userState = userInfo.state || '[State]';
  const userZip = userInfo.zipCode || '[Zip Code]';
  const bureau = userInfo.bureau || 'Credit Bureau';
  const currentDate = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  // Format complete address
  const fullAddress = userInfo.address && userInfo.city && userInfo.state && userInfo.zipCode 
    ? `${userAddress}\n${userCity}, ${userState} ${userZip}`
    : `${userAddress}\n${userCity}, ${userState} ${userZip}`;

  console.log('User address info:', { userAddress, userCity, userState, userZip, fullAddress });

  // Create detailed item descriptions
  let itemDescriptions = '';
  disputeItems.forEach((item, index) => {
    itemDescriptions += `\n${index + 1}. **${item.creditor_name || 'Unknown Creditor'}**`;
    if (item.account_number) {
      itemDescriptions += ` (Account: ${item.account_number})`;
    }
    if (item.amount) {
      itemDescriptions += ` - Amount: $${item.amount}`;
    }
    itemDescriptions += `\n   Dispute Reason: ${item.dispute_reason || 'Requesting verification of account information'}`;
    if (item.issue_details) {
      itemDescriptions += `\n   Issue Details: ${item.issue_details}`;
    }
    if (item.confidence_level) {
      itemDescriptions += `\n   Confidence Level: ${item.confidence_level}`;
    }
    itemDescriptions += '\n';
  });

  // Create comprehensive prompt with actual data
  const prompt = `Generate a professional credit dispute letter using the following REAL information:

**USER INFORMATION:**
- Name: ${userName}
- Email: ${userEmail}
- Phone: ${userPhone}
- Address: ${fullAddress}
- Date: ${currentDate}
- Bureau: ${bureau}

**DISPUTE ITEMS (${disputeItems.length} total):**${itemDescriptions}

**LETTER REQUIREMENTS:**
1. Use the ACTUAL user name "${userName}" throughout the letter
2. Address it to "${bureau}" 
3. Include the ACTUAL account numbers and creditor names from the items above
4. Reference specific dispute reasons for each item
5. Format as a professional business letter with:
   - Sender's header: ${userName}, ${fullAddress}, ${userEmail}, ${userPhone}
   - Date: ${currentDate}
   - Recipient address for ${bureau}
   - Professional salutation
   - Body paragraphs covering all ${disputeItems.length} items
   - Professional closing
   - Signature line for ${userName}
6. Use the complete address: ${fullAddress}
7. Include phone number: ${userPhone} and email: ${userEmail}

**DISPUTE STRATEGY:**
Follow JAM Capital Consultants' methodology:
- Request verification of all account information
- Reference FCRA Section 609 (right to dispute) and Section 611 (investigation requirements)
- Challenge any inaccuracies or unverifiable information
- Request removal if items cannot be verified
- Professional tone but assertive about consumer rights

**IMPORTANT:** Replace ALL placeholders with the actual information provided above. Do not use [Your Name], [Address], or any other placeholders.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are JAM Dispute Bot — a professional credit dispute letter generator. Your task is to create legally sound dispute letters using ACTUAL user information provided. NEVER use placeholders like [Your Name] or [Address]. Always use the specific information provided in the prompt. Format as a complete business letter ready to mail."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 3000, // Increased for longer letters
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error("Error generating dispute letter:", error);
    throw new Error("Failed to generate dispute letter");
  }
}
