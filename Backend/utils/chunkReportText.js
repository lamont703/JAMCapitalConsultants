/**
 * Chunks a credit report text into manageable sections for processing
 * @param {string} reportText - The full text of the credit report
 * @param {number} maxChunkSize - Maximum size of each chunk in characters (default: 100000)
 * @param {number} overlapSize - Number of characters to overlap between chunks (default: 200)
 * @return {Array<string>} Array of text chunks
 */

// Keep this for now
export function chunkReportText(reportText, maxChunkSize = 100000, overlapSize = 200) {
  console.log(`\n===== CHUNKING REPORT TEXT =====`);
  console.log(`Total text length: ${reportText ? reportText.length : 0} characters`);
  console.log(`Max chunk size: ${maxChunkSize}, Overlap size: ${overlapSize}`);
  
  if (!reportText || reportText.length === 0) {
    console.log(`Warning: Empty report text provided to chunker`);
    return [];
  }
  
  // Normalize line endings and whitespace
  const normalizedText = reportText
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  // If the text is small enough, return it as a single chunk
  if (normalizedText.length <= maxChunkSize) {
    console.log(`Text is small enough to process as a single chunk`);
    return [normalizedText];
  }
  
  // Split the text into chunks
  const chunks = [];
  let currentPosition = 0;
  
  // Safety check to prevent infinite loops
  let safetyCounter = 0;
  const maxIterations = 1000;
  
  while (currentPosition < normalizedText.length && safetyCounter < maxIterations) {
    safetyCounter++;
    
    // Determine end position for this chunk
    let endPosition = Math.min(currentPosition + maxChunkSize, normalizedText.length);
    
    // Try to find a paragraph break to split at
    if (endPosition < normalizedText.length) {
      const paragraphBreak = normalizedText.lastIndexOf('\n\n', endPosition);
      if (paragraphBreak > currentPosition && paragraphBreak > endPosition - maxChunkSize / 2) {
        endPosition = paragraphBreak + 2; // Include the paragraph break
      } else {
        // Try to find a line break
        const lineBreak = normalizedText.lastIndexOf('\n', endPosition);
        if (lineBreak > currentPosition && lineBreak > endPosition - maxChunkSize / 2) {
          endPosition = lineBreak + 1; // Include the line break
        }
      }
    }
    
    // Extract the chunk
    const chunk = normalizedText.substring(currentPosition, endPosition);
    chunks.push(chunk);
    
    // Move position for next chunk, including overlap
    const nextPosition = Math.max(currentPosition, endPosition - overlapSize);
    
    // Check if we're making progress
    if (nextPosition <= currentPosition) {
      console.log(`Warning: Chunking not making progress at position ${currentPosition}. Breaking loop.`);
      // Force progress by moving forward at least one character
      currentPosition = endPosition;
    } else {
      currentPosition = nextPosition;
    }
    
    // Debug output
    console.log(`Chunk ${chunks.length}: ${chunk.length} chars, Next position: ${currentPosition}/${normalizedText.length}`);
  }
  
  if (safetyCounter >= maxIterations) {
    console.log(`Warning: Reached maximum iterations (${maxIterations}). Chunking may be incomplete.`);
  }
  
  console.log(`Created ${chunks.length} chunks`);
  return chunks;
}