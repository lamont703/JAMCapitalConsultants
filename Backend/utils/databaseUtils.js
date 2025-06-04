// Database utility functions
import { CosmosService } from '../services/cosmosService.js';

// Initialize CosmosDB service
const cosmosService = new CosmosService();

// This function should integrate with your existing user document system
export async function getUserDocuments(userEmail) {
  try {
    console.log(`Looking for documents for user: ${userEmail}`);
    
    // Initialize the cosmos service if not already done
    await cosmosService.initialize();
    
    // First, get the user by email to get their user ID
    const user = await cosmosService.getUserByEmail(userEmail);
    
    if (!user) {
      console.log(`User not found with email: ${userEmail}`);
      throw new Error('User not found');
    }
    
    console.log(`Found user: ${user.id} for email: ${userEmail}`);
    
    // Query for documents associated with this user
    // Assuming documents have a userId field and documentType field
    const query = `
      SELECT * FROM c 
      WHERE c.userId = @userId 
      AND (c.documentType = @docType1 OR c.documentType = @docType2 OR c.type = @docType3)
      ORDER BY c.createdAt DESC
    `;
    
    const parameters = [
      { name: '@userId', value: user.id },
      { name: '@docType1', value: 'credit-report' },
      { name: '@docType2', value: 'credit_report' },
      { name: '@docType3', value: 'document' } // fallback for generic documents
    ];
    
    const documents = await cosmosService.queryDocuments(query, parameters);
    
    console.log(`Found ${documents.length} documents for user ${userEmail}`);
    
    // Filter for credit reports if we got generic documents
    const creditReports = documents.filter(doc => {
      const isReportType = doc.documentType === 'credit-report' || 
                          doc.documentType === 'credit_report' ||
                          doc.type === 'credit-report';
      const hasReportInName = doc.fileName?.toLowerCase().includes('credit') ||
                             doc.originalName?.toLowerCase().includes('credit') ||
                             doc.name?.toLowerCase().includes('credit');
      
      return isReportType || hasReportInName;
    });
    
    console.log(`Found ${creditReports.length} credit reports for user ${userEmail}`);
    
    return creditReports;
    
  } catch (error) {
    console.error('Error getting user documents:', error);
    throw error;
  }
}

// Additional helper function to get user by email (for other uses)
export async function getUserByEmail(userEmail) {
  try {
    await cosmosService.initialize();
    return await cosmosService.getUserByEmail(userEmail);
  } catch (error) {
    console.error('Error getting user by email:', error);
    throw error;
  }
}

// Helper function to save analysis results back to the database
export async function saveAnalysisResults(userId, analysisData) {
  try {
    await cosmosService.initialize();
    return await cosmosService.saveDisputeAnalysis(userId, analysisData);
  } catch (error) {
    console.error('Error saving analysis results:', error);
    throw error;
  }
} 