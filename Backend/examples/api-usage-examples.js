/**
 * JAM Capital API Usage Examples
 * 
 * This file contains practical examples of how to use the JAM Capital API
 * client library in different scenarios and applications.
 */

import JamCapitalAPI, { APIError, SERVICE_TYPES } from '../lib/jam-capital-api.js';

// ==========================================
// EXAMPLE 1: BASIC SETUP AND AUTHENTICATION
// ==========================================

async function basicSetupExample() {
    console.log('📋 Example 1: Basic Setup and Authentication');
    console.log('='.repeat(50));
    
    // Initialize the API client
    const api = new JamCapitalAPI({
        baseURL: 'https://jam-capital-backend.azurewebsites.net/api',
        debug: true // Enable debug logging for development
    });
    
    try {
        // Check if the API is healthy
        console.log('Checking API health...');
        const health = await api.getHealth();
        console.log('API Status:', health.status);
        console.log('Environment:', health.environment);
        
        // Authenticate as admin
        console.log('\nAuthenticating admin...');
        const loginResult = await api.loginAdmin('admin@jamcapital.com', 'password');
        console.log('Login successful:', loginResult.user.name);
        console.log('Token expires in:', loginResult.expiresIn);
        
        // Check authentication status
        console.log('Is authenticated:', api.isAuthenticated());
        
        // Logout
        console.log('\nLogging out...');
        await api.logout();
        console.log('Logged out successfully');
        
    } catch (error) {
        console.error('Error:', error.message);
        if (error instanceof APIError) {
            console.error('Status:', error.status);
        }
    }
}

// ==========================================
// EXAMPLE 2: CREDENTIAL MANAGEMENT WORKFLOW
// ==========================================

async function credentialManagementExample() {
    console.log('\n📋 Example 2: Credential Management Workflow');
    console.log('='.repeat(50));
    
    const api = new JamCapitalAPI({
        baseURL: 'https://jam-capital-backend.azurewebsites.net/api'
    });
    
    try {
        // Authenticate
        await api.loginAdmin('admin@jamcapital.com', 'password');
        console.log('✅ Admin authenticated');
        
        const userEmail = 'user@example.com';
        const serviceType = SERVICE_TYPES.SMART_CREDIT;
        
        // Retrieve existing credentials
        console.log(`\nRetrieving ${serviceType} credentials for ${userEmail}...`);
        try {
            const credentials = await api.retrieveCredentials({
                userEmail: userEmail,
                serviceType: serviceType,
                purpose: 'account_verification'
            });
            
            if (credentials.data.warning) {
                console.log('⚠️ Warning:', credentials.data.warning);
                console.log('Decryption Status:', credentials.data.decryptionStatus);
                
                // Handle corrupted credentials
                console.log('Credentials appear to be corrupted and need re-entry');
            } else {
                console.log('✅ Credentials retrieved successfully');
                console.log('Service Email:', credentials.data.email);
                console.log('Last Accessed:', new Date(credentials.data.lastAccessed).toLocaleString());
            }
            
        } catch (error) {
            if (error.status === 404) {
                console.log('ℹ️ No credentials found for this user/service combination');
            } else {
                throw error;
            }
        }
        
        // Get credential history
        console.log('\nRetrieving credential access history...');
        try {
            const history = await api.getCredentialHistory(userEmail);
            console.log(`Found ${history.data.length} access records`);
            
            history.data.slice(0, 3).forEach(record => {
                console.log(`- ${record.serviceType} accessed by ${record.accessedBy} at ${new Date(record.accessedAt).toLocaleString()}`);
            });
        } catch (error) {
            console.log('No history available or access denied');
        }
        
    } catch (error) {
        console.error('Credential management error:', error.message);
    }
}

// ==========================================
// EXAMPLE 3: USER SEARCH AND MANAGEMENT
// ==========================================

async function userManagementExample() {
    console.log('\n📋 Example 3: User Search and Management');
    console.log('='.repeat(50));
    
    const api = new JamCapitalAPI({
        baseURL: 'https://jam-capital-backend.azurewebsites.net/api'
    });
    
    try {
        // Authenticate as admin
        await api.loginAdmin('admin@jamcapital.com', 'password');
        
        // Search for users by email
        console.log('Searching for users...');
        const searchResults = await api.searchUsers({
            email: 'user@example.com',
            limit: 10
        });
        
        console.log(`Found ${searchResults.total} users matching search criteria:`);
        searchResults.data.forEach(user => {
            console.log(`- ${user.name} (${user.email}) - Created: ${new Date(user.createdAt).toLocaleDateString()}`);
        });
        
        // Get all users with pagination
        console.log('\nGetting all users (first page)...');
        const allUsers = await api.getAllUsers({
            page: 1,
            limit: 20,
            sortBy: 'createdAt',
            sortOrder: 'desc'
        });
        
        console.log(`Total users: ${allUsers.data.pagination.total}`);
        console.log(`Page ${allUsers.data.pagination.page} of ${allUsers.data.pagination.pages}`);
        
        // Display recent users
        console.log('\nRecent users:');
        allUsers.data.users.slice(0, 5).forEach(user => {
            const lastLogin = user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never';
            console.log(`- ${user.name} (${user.email}) - Last login: ${lastLogin}`);
        });
        
    } catch (error) {
        console.error('User management error:', error.message);
    }
}

// ==========================================
// EXAMPLE 4: BULK CREDENTIAL CHECKING
// ==========================================

async function bulkCredentialCheckExample() {
    console.log('\n📋 Example 4: Bulk Credential Checking');
    console.log('='.repeat(50));
    
    const api = new JamCapitalAPI({
        baseURL: 'https://jam-capital-backend.azurewebsites.net/api'
    });
    
    const testUsers = [
        'wakeshiad@gmail.com',
        'lashaikevans@gmail.com',
        'amethystware@yahoo.com'
    ];
    
    const services = [
        SERVICE_TYPES.SMART_CREDIT,
        SERVICE_TYPES.IDENTITY_IQ,
        SERVICE_TYPES.CFPB
    ];
    
    try {
        await api.loginAdmin('admin@jamcapital.com', 'password');
        console.log('✅ Authenticated for bulk checking');
        
        const results = {
            working: 0,
            corrupted: 0,
            missing: 0,
            errors: 0
        };
        
        console.log('\nChecking credentials for all users and services...');
        
        for (const userEmail of testUsers) {
            console.log(`\n👤 Checking ${userEmail}:`);
            
            for (const serviceType of services) {
                try {
                    const credentials = await api.retrieveCredentials({
                        userEmail: userEmail,
                        serviceType: serviceType,
                        purpose: 'bulk_verification'
                    });
                    
                    if (credentials.data.warning) {
                        console.log(`  ⚠️  ${serviceType}: CORRUPTED - ${credentials.data.warning}`);
                        results.corrupted++;
                    } else {
                        console.log(`  ✅ ${serviceType}: WORKING`);
                        results.working++;
                    }
                    
                    // Small delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                } catch (error) {
                    if (error.status === 404) {
                        console.log(`  ➖ ${serviceType}: NOT FOUND`);
                        results.missing++;
                    } else if (error.status === 429) {
                        console.log(`  ⏳ ${serviceType}: RATE LIMITED - waiting...`);
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        // Retry once
                        try {
                            const retryResult = await api.retrieveCredentials({
                                userEmail: userEmail,
                                serviceType: serviceType,
                                purpose: 'bulk_verification_retry'
                            });
                            console.log(`  ✅ ${serviceType}: WORKING (after retry)`);
                            results.working++;
                        } catch (retryError) {
                            console.log(`  ❌ ${serviceType}: ERROR AFTER RETRY`);
                            results.errors++;
                        }
                    } else {
                        console.log(`  ❌ ${serviceType}: ERROR - ${error.message}`);
                        results.errors++;
                    }
                }
            }
        }
        
        // Summary
        console.log('\n📊 BULK CHECK SUMMARY:');
        console.log(`✅ Working: ${results.working}`);
        console.log(`⚠️  Corrupted: ${results.corrupted}`);
        console.log(`➖ Missing: ${results.missing}`);
        console.log(`❌ Errors: ${results.errors}`);
        
        const total = results.working + results.corrupted + results.missing + results.errors;
        const healthPercentage = Math.round((results.working / total) * 100);
        console.log(`📈 Health Score: ${healthPercentage}%`);
        
    } catch (error) {
        console.error('Bulk check error:', error.message);
    }
}

// ==========================================
// EXAMPLE 5: ERROR HANDLING AND RETRY LOGIC
// ==========================================

async function errorHandlingExample() {
    console.log('\n📋 Example 5: Error Handling and Retry Logic');
    console.log('='.repeat(50));
    
    const api = new JamCapitalAPI({
        baseURL: 'https://jam-capital-backend.azurewebsites.net/api'
    });
    
    // Custom retry function
    async function retryOperation(operation, maxRetries = 3, delay = 1000) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                console.log(`Attempt ${attempt} failed: ${error.message}`);
                
                if (attempt === maxRetries) {
                    throw error;
                }
                
                if (error.status === 429) {
                    // Rate limited - wait longer
                    console.log(`Rate limited, waiting ${delay * 2}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay * 2));
                } else if (error.status >= 500) {
                    // Server error - retry with exponential backoff
                    console.log(`Server error, waiting ${delay * attempt}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay * attempt));
                } else {
                    // Client error - don't retry
                    throw error;
                }
            }
        }
    }
    
    try {
        // Example 1: Retry authentication on server errors
        console.log('Testing retry logic for authentication...');
        const loginResult = await retryOperation(async () => {
            return await api.loginAdmin('admin@jamcapital.com', 'password');
        });
        console.log('✅ Authentication successful with retry logic');
        
        // Example 2: Handle different types of errors
        console.log('\nTesting different error scenarios...');
        
        // Test invalid credentials
        try {
            await api.loginAdmin('invalid@email.com', 'wrong-password');
        } catch (error) {
            if (error instanceof APIError) {
                console.log(`Expected auth error: ${error.message} (Status: ${error.status})`);
            }
        }
        
        // Test non-existent user
        try {
            await api.retrieveCredentials({
                userEmail: 'nonexistent@example.com',
                serviceType: SERVICE_TYPES.SMART_CREDIT,
                purpose: 'error_testing'
            });
        } catch (error) {
            if (error.status === 404) {
                console.log('Expected 404 error for non-existent user');
            }
        }
        
        // Test unauthorized access
        api.setAuthToken(null); // Clear auth
        try {
            await api.retrieveCredentials({
                userEmail: 'test@example.com',
                serviceType: SERVICE_TYPES.SMART_CREDIT,
                purpose: 'error_testing'
            });
        } catch (error) {
            if (error.status === 401) {
                console.log('Expected 401 error for unauthorized access');
            }
        }
        
    } catch (error) {
        console.error('Error handling example failed:', error.message);
    }
}

// ==========================================
// EXAMPLE 6: CHAT INTEGRATION
// ==========================================

async function chatIntegrationExample() {
    console.log('\n📋 Example 6: Chat Integration');
    console.log('='.repeat(50));
    
    const api = new JamCapitalAPI({
        baseURL: 'https://jam-capital-backend.azurewebsites.net/api'
    });
    
    try {
        // Authenticate as regular user for chat
        await api.loginUser('user@example.com', 'password');
        console.log('✅ User authenticated for chat');
        
        // Send a message to the AI
        console.log('\nSending message to AI chat...');
        const chatResponse = await api.sendChatMessage({
            message: 'I found an error on my credit report. What should I do?',
            context: 'dispute_assistance'
        });
        
        console.log('AI Response:', chatResponse.data.response);
        
        if (chatResponse.data.suggestions) {
            console.log('\nSuggestions:');
            chatResponse.data.suggestions.forEach((suggestion, index) => {
                console.log(`${index + 1}. ${suggestion}`);
            });
        }
        
        // Get chat history
        console.log('\nRetrieving chat history...');
        const history = await api.getChatHistory({ limit: 5 });
        
        console.log(`Found ${history.data.messages.length} recent messages:`);
        history.data.messages.forEach(msg => {
            console.log(`[${new Date(msg.timestamp).toLocaleString()}] User: ${msg.message}`);
            console.log(`[${new Date(msg.timestamp).toLocaleString()}] AI: ${msg.response.substring(0, 100)}...`);
        });
        
    } catch (error) {
        console.error('Chat integration error:', error.message);
    }
}

// ==========================================
// EXAMPLE 7: INTERCEPTORS AND MIDDLEWARE
// ==========================================

async function interceptorExample() {
    console.log('\n📋 Example 7: Interceptors and Middleware');
    console.log('='.repeat(50));
    
    const api = new JamCapitalAPI({
        baseURL: 'https://jam-capital-backend.azurewebsites.net/api'
    });
    
    // Add request interceptor for logging
    api.addRequestInterceptor(async (requestOptions) => {
        console.log(`🔄 Making ${requestOptions.method} request to ${requestOptions.url}`);
        
        // Add custom headers
        requestOptions.headers['X-Client-Version'] = '1.0.0';
        requestOptions.headers['X-Request-ID'] = `req_${Date.now()}`;
    });
    
    // Add response interceptor for monitoring
    api.addResponseInterceptor(async (response, data) => {
        console.log(`✅ Response ${response.status} received`);
        
        // Log slow responses
        if (response.headers.get('X-Response-Time')) {
            const responseTime = parseInt(response.headers.get('X-Response-Time'));
            if (responseTime > 1000) {
                console.log(`⚠️ Slow response detected: ${responseTime}ms`);
            }
        }
        
        // Log rate limit information
        const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
        if (rateLimitRemaining && parseInt(rateLimitRemaining) < 10) {
            console.log(`⚠️ Rate limit warning: ${rateLimitRemaining} requests remaining`);
        }
    });
    
    try {
        // Make some requests to see interceptors in action
        console.log('Testing interceptors...');
        
        const health = await api.getHealth();
        console.log('Health status:', health.status);
        
        await api.loginAdmin('admin@jamcapital.com', 'password');
        console.log('Login successful');
        
        const users = await api.searchUsers({ limit: 5 });
        console.log(`Found ${users.total} users`);
        
    } catch (error) {
        console.error('Interceptor example error:', error.message);
    }
}

// ==========================================
// EXAMPLE 8: PERFORMANCE MONITORING
// ==========================================

async function performanceMonitoringExample() {
    console.log('\n📋 Example 8: Performance Monitoring');
    console.log('='.repeat(50));
    
    const api = new JamCapitalAPI({
        baseURL: 'https://jam-capital-backend.azurewebsites.net/api'
    });
    
    // Performance monitoring utility
    class PerformanceMonitor {
        constructor() {
            this.metrics = [];
        }
        
        async timeOperation(name, operation) {
            const startTime = Date.now();
            try {
                const result = await operation();
                const duration = Date.now() - startTime;
                this.metrics.push({ name, duration, success: true });
                console.log(`⏱️ ${name}: ${duration}ms`);
                return result;
            } catch (error) {
                const duration = Date.now() - startTime;
                this.metrics.push({ name, duration, success: false, error: error.message });
                console.log(`⏱️ ${name}: ${duration}ms (FAILED)`);
                throw error;
            }
        }
        
        getStats() {
            const successful = this.metrics.filter(m => m.success);
            const failed = this.metrics.filter(m => !m.success);
            
            return {
                total: this.metrics.length,
                successful: successful.length,
                failed: failed.length,
                averageTime: successful.reduce((sum, m) => sum + m.duration, 0) / successful.length || 0,
                slowest: Math.max(...successful.map(m => m.duration), 0),
                fastest: Math.min(...successful.map(m => m.duration), 0)
            };
        }
    }
    
    const monitor = new PerformanceMonitor();
    
    try {
        // Monitor various operations
        await monitor.timeOperation('Health Check', () => api.getHealth());
        
        await monitor.timeOperation('Admin Login', () => 
            api.loginAdmin('admin@jamcapital.com', 'password')
        );
        
        await monitor.timeOperation('User Search', () => 
            api.searchUsers({ limit: 10 })
        );
        
        await monitor.timeOperation('Credential Retrieval', () =>
            api.retrieveCredentials({
                userEmail: 'test@example.com',
                serviceType: SERVICE_TYPES.SMART_CREDIT,
                purpose: 'performance_test'
            }).catch(error => {
                if (error.status === 404) return null; // Expected
                throw error;
            })
        );
        
        // Print performance statistics
        const stats = monitor.getStats();
        console.log('\n📊 PERFORMANCE STATISTICS:');
        console.log(`Total Operations: ${stats.total}`);
        console.log(`Successful: ${stats.successful}`);
        console.log(`Failed: ${stats.failed}`);
        console.log(`Average Response Time: ${Math.round(stats.averageTime)}ms`);
        console.log(`Fastest Response: ${stats.fastest}ms`);
        console.log(`Slowest Response: ${stats.slowest}ms`);
        
    } catch (error) {
        console.error('Performance monitoring error:', error.message);
    }
}

// ==========================================
// MAIN EXAMPLE RUNNER
// ==========================================

async function runAllExamples() {
    console.log('🚀 JAM CAPITAL API USAGE EXAMPLES');
    console.log('==================================\n');
    
    const examples = [
        basicSetupExample,
        credentialManagementExample,
        userManagementExample,
        bulkCredentialCheckExample,
        errorHandlingExample,
        chatIntegrationExample,
        interceptorExample,
        performanceMonitoringExample
    ];
    
    for (const example of examples) {
        try {
            await example();
            console.log('\n' + '✅ Example completed successfully'.padEnd(50, ' '));
        } catch (error) {
            console.log('\n' + `❌ Example failed: ${error.message}`.padEnd(50, ' '));
        }
        
        console.log('\n' + '='.repeat(80) + '\n');
    }
    
    console.log('🎉 All examples completed!');
}

// Export individual examples for selective running
export {
    basicSetupExample,
    credentialManagementExample,
    userManagementExample,
    bulkCredentialCheckExample,
    errorHandlingExample,
    chatIntegrationExample,
    interceptorExample,
    performanceMonitoringExample,
    runAllExamples
};

// Run all examples if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runAllExamples().catch(error => {
        console.error('❌ Examples execution failed:', error);
        process.exit(1);
    });
} 