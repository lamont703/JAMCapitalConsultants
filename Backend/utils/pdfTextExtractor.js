import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFDocument } from 'pdf-lib';

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Tests PDF text extraction using a custom approach
 * @param {string} filePath - Path to the PDF file
 */
export async function testPdfExtraction(filePath) {
  try {
    console.log(`\n===== TESTING PDF EXTRACTION: ${filePath} =====\n`);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`File does not exist: ${filePath}`);
      return;
    }
    
    // Read the file as buffer
    console.log(`Reading PDF file...`);
    const dataBuffer = fs.readFileSync(filePath);
    
    // Use a different approach - first check if it's a valid PDF
    try {
      await PDFDocument.load(dataBuffer);
      console.log("PDF validation successful - file is a valid PDF");
    } catch (err) {
      console.error("PDF validation failed - file may be corrupted:", err.message);
    }
    
    // Use the existing PDF extraction function from your codebase
    console.log(`Extracting text using your existing function...`);
    const { extractTextFromPdf } = await import('./fileProcessing.js');
    const reportText = await extractTextFromPdf(filePath);
    
    console.log(`PDF extraction successful. Text length: ${reportText.length} characters\n`);
    
    // Show basic stats
    const lines = reportText.split('\n');
    console.log(`Number of lines: ${lines.length}`);
    console.log(`Average line length: ${Math.round(reportText.length / lines.length)} characters\n`);
    
    // Show the first 10 lines
    console.log(`===== FIRST 10 LINES =====`);
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      console.log(`Line ${i+1}: ${lines[i].substring(0, 100)}${lines[i].length > 100 ? '...' : ''}`);
    }
    
    // Show a sample from the middle
    console.log(`\n===== MIDDLE SAMPLE =====`);
    const middleIndex = Math.floor(lines.length / 2);
    for (let i = middleIndex; i < Math.min(middleIndex + 10, lines.length); i++) {
      console.log(`Line ${i+1}: ${lines[i].substring(0, 100)}${lines[i].length > 100 ? '...' : ''}`);
    }
    
    // Look for common credit report sections with improved patterns
    console.log(`\n===== SECTION DETECTION =====`);
    const sectionPatterns = [
      { 
        pattern: /\b(?:personal|consumer)\s+information\b/i, 
        name: "Personal Information",
        priority: 1
      },
      { 
        pattern: /\b(?:accounts?|tradelines?)\s+(?:in\s+good\s+standing)?\b/i, 
        name: "Accounts",
        priority: 2
      },
      { 
        pattern: /\bpublic\s+records?\b/i, 
        name: "Public Records",
        priority: 3
      },
      { 
        pattern: /\b(?:credit\s+)?inquiries\b/i, 
        name: "Inquiries",
        priority: 4
      },
      { 
        pattern: /\bcollections?\s+(?:accounts?)?\b/i, 
        name: "Collections",
        priority: 5
      },
      { 
        pattern: /\bcredit\s+score\b/i, 
        name: "Credit Score",
        priority: 6
      },
      {
        pattern: /\b(?:potentially\s+)?negative\s+(?:items?|accounts?)\b/i,
        name: "Negative Items",
        priority: 7
      },
      {
        pattern: /\bcharge(?:-|\s+)?offs?\b/i,
        name: "Charge-Offs",
        priority: 8
      }
    ];

    // First pass: Find all occurrences of each section pattern
    const sectionOccurrences = [];

    for (const section of sectionPatterns) {
      for (let i = 0; i < lines.length; i++) {
        if (section.pattern.test(lines[i])) {
          sectionOccurrences.push({
            name: section.name,
            lineIndex: i,
            priority: section.priority,
            line: lines[i].trim()
          });
        }
      }
    }

    // Sort occurrences by line index and then by priority (for same line)
    sectionOccurrences.sort((a, b) => {
      if (a.lineIndex === b.lineIndex) {
        return a.priority - b.priority;
      }
      return a.lineIndex - b.lineIndex;
    });

    // Filter out duplicate sections on the same line (keep the higher priority one)
    const uniqueSections = [];
    let lastLineIndex = -1;

    for (const occurrence of sectionOccurrences) {
      if (occurrence.lineIndex !== lastLineIndex) {
        uniqueSections.push(occurrence);
        lastLineIndex = occurrence.lineIndex;
      }
    }

    // Display the detected sections
    if (uniqueSections.length === 0) {
      console.log("No sections detected in the document");
    } else {
      console.log(`Found ${uniqueSections.length} distinct sections:`);
      
      for (const section of uniqueSections) {
        console.log(`Found "${section.name}" section at line ${section.lineIndex + 1}: "${section.line}"`);
        
        // Show a few lines after this section header
        console.log(`  Context:`);
        for (let i = section.lineIndex + 1; i < Math.min(section.lineIndex + 5, lines.length); i++) {
          console.log(`    ${lines[i].trim().substring(0, 100)}${lines[i].length > 100 ? '...' : ''}`);
        }
        
        // If this isn't the last section, show the section length
        const nextSectionIndex = uniqueSections.indexOf(section) + 1;
        if (nextSectionIndex < uniqueSections.length) {
          const nextSection = uniqueSections[nextSectionIndex];
          const sectionLength = nextSection.lineIndex - section.lineIndex;
          console.log(`  Section length: ${sectionLength} lines`);
        }
      }
    }
    
    // Check for account numbers (masked with X's)
    console.log(`\n===== ACCOUNT NUMBER DETECTION =====`);
    const accountNumberPattern = /\b(?:\d{4}[ -]?){3}\d{4}\b|\bXX+\d{4}\b/;
    let accountNumberCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
      if (accountNumberPattern.test(lines[i])) {
        accountNumberCount++;
        if (accountNumberCount <= 3) { // Show only first 3 examples
          console.log(`Found potential account number at line ${i+1}: "${lines[i].trim().substring(0, 100)}..."`);
        }
      }
    }
    
    console.log(`Total potential account numbers found: ${accountNumberCount}`);
    
    // Check for common PDF extraction issues
    console.log(`\n===== EXTRACTION QUALITY CHECK =====`);
    
    // Check for character encoding issues
    const nonAsciiCount = (reportText.match(/[^\x00-\x7F]/g) || []).length;
    console.log(`Non-ASCII characters: ${nonAsciiCount} (${(nonAsciiCount / reportText.length * 100).toFixed(2)}% of text)`);
    
    // Check for layout issues (lines that might be merged incorrectly)
    const longLineCount = lines.filter(line => line.length > 200).length;
    console.log(`Unusually long lines (>200 chars): ${longLineCount} (${(longLineCount / lines.length * 100).toFixed(2)}% of lines)`);
    
    // Check for potential table data
    const tableLineCount = lines.filter(line => (line.match(/\s{3,}/g) || []).length > 3).length;
    console.log(`Potential table lines (with multiple spaces): ${tableLineCount} (${(tableLineCount / lines.length * 100).toFixed(2)}% of lines)`);
    
    console.log(`\n===== PDF EXTRACTION TEST COMPLETE =====\n`);
    console.log(`\n===== CHUNK TESTING =====\n`);
    const { chunkReportText, saveChunksToFiles } = await import('./reportChunker.js');
    const textChunks = chunkReportText(reportText, 10000, 200);
    saveChunksToFiles(textChunks, 'test_chunks');
    console.log(`\n===== CHUNK TESTING COMPLETE =====\n`);
  } catch (error) {
    console.error('Error testing PDF extraction:', error);
    console.error(error.stack);
  }
}

// Main function
async function main() {
  // Use the specific file path you provided
  const filePath = './uploads/1747722766395-Equifax_FACT_Rpt_06092014.pdf';
  
  if (!fs.existsSync(filePath)) {
    console.error(`File does not exist: ${filePath}`);
    process.exit(1);
  }
  
  console.log(`Testing PDF extraction for: ${filePath}`);
  
  // Run the test
  await testPdfExtraction(filePath);
}

main().catch(err => {
  console.error('Error in main function:', err);
  process.exit(1);
});
