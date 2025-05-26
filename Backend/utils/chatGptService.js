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
 * @param {Object} disputeDetails - Details about the dispute
 * @returns {Promise<string>} - The generated dispute letter
 */
export async function generateDisputeLetter(disputeDetails) {
  const { 
    disputeType, 
    creditorName, 
    accountNumber, 
    issueDescription,
    userInfo,
    creditorInfo,
    currentDate
  } = disputeDetails;
  
  let prompt = `Generate a professional dispute letter for a ${disputeType} issue with ${creditorName} (account ending in ${accountNumber}).
  
Issue details: ${issueDescription}

${userInfo || ''}

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
