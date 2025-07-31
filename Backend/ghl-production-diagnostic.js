#!/usr/bin/env node

import dotenv from 'dotenv';
import { GoHighLevelService } from './services/ghlService.js';
import { ghlSyncMiddleware } from './middleware/ghlSyncMiddleware.js';
import { CosmosService } from './services/cosmosService.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

console.log('🚀 GoHighLevel Production Diagnostic Tool');
console.log('=' .repeat(50));

const diagnosticResults = {
    environment: {},
    authentication: {},
    networking: {},
    database: {},
    ghlService: {},
    sync: {},
    recommendations: []
};

async function checkEnvironmentVariables() {
    console.log('\n📋 1. Environment Variables Check');
    console.log('-'.repeat(30));
    
    const requiredVars = [
        'NODE_ENV',
        'GHL_LOCATION_ID',
        'COSMOS_DB_CONNECTION_STRING',
        'JWT_SECRET',
        'OPENAI_API_KEY'
    ];
    
    const optionalVars = [
        'GHL_ACCESS_TOKEN',
        'GHL_WEBHOOK_SECRET',
        'AZURE_STORAGE_CONNECTION_STRING',
        'APPLICATIONINSIGHTS_CONNECTION_STRING'
    ];
    
    diagnosticResults.environment = {
        nodeEnv: process.env.NODE_ENV,
        requiredVars: {},
        optionalVars: {},
        issues: []
    };
    
    // Check required variables
    for (const varName of requiredVars) {
        const value = process.env[varName];
        const exists = !!value;
        diagnosticResults.environment.requiredVars[varName] = {
            exists,
            length: value ? value.length : 0,
            masked: value ? `${value.substring(0, 10)}...` : 'NOT_SET'
        };
        
        if (!exists) {
            diagnosticResults.environment.issues.push(`Missing required variable: ${varName}`);
        }
        
        console.log(`  ${exists ? '✅' : '❌'} ${varName}: ${exists ? `Set (${value.length} chars)` : 'NOT SET'}`);
    }
    
    // Check optional variables
    for (const varName of optionalVars) {
        const value = process.env[varName];
        const exists = !!value;
        diagnosticResults.environment.optionalVars[varName] = {
            exists,
            length: value ? value.length : 0,
            masked: value ? `${value.substring(0, 10)}...` : 'NOT_SET'
        };
        
        console.log(`  ${exists ? '✅' : '⚠️'} ${varName}: ${exists ? `Set (${value.length} chars)` : 'NOT SET'}`);
    }
    
    console.log(`\n📊 Environment: ${process.env.NODE_ENV || 'unknown'}`);
    console.log(`📊 Required vars: ${Object.values(diagnosticResults.environment.requiredVars).filter(v => v.exists).length}/${requiredVars.length}`);
    console.log(`📊 Optional vars: ${Object.values(diagnosticResults.environment.optionalVars).filter(v => v.exists).length}/${optionalVars.length}`);
}

async function checkGHLAuthentication() {
    console.log('\n🔐 2. GoHighLevel Authentication Check');
    console.log('-'.repeat(30));
    
    try {
        const ghlService = new GoHighLevelService();
        
        // Check token service
        const tokenInfo = await ghlService.getTokenInfo();
        diagnosticResults.authentication = {
            tokenInfo,
            issues: []
        };
        
        console.log(`  ${tokenInfo.hasAccessToken ? '✅' : '❌'} Access Token: ${tokenInfo.hasAccessToken ? 'Present' : 'Missing'}`);
        console.log(`  ${tokenInfo.hasRefreshToken ? '✅' : '❌'} Refresh Token: ${tokenInfo.hasRefreshToken ? 'Present' : 'Missing'}`);
        console.log(`  ${!tokenInfo.isExpired ? '✅' : '❌'} Token Status: ${tokenInfo.isExpired ? 'Expired' : 'Valid'}`);
        
        if (tokenInfo.expiresAt) {
            const expiresIn = Math.floor((new Date(tokenInfo.expiresAt) - new Date()) / 1000 / 60);
            console.log(`  ⏰ Expires in: ${expiresIn} minutes`);
        }
        
        // Try to initialize the service
        const initialized = await ghlService.initialize();
        console.log(`  ${initialized ? '✅' : '❌'} Service Initialization: ${initialized ? 'Success' : 'Failed'}`);
        
        if (!initialized) {
            diagnosticResults.authentication.issues.push('GHL service initialization failed');
        }
        
        // Test connection
        const connectionTest = await ghlService.testConnection();
        console.log(`  ${connectionTest.success ? '✅' : '❌'} Connection Test: ${connectionTest.success ? 'Success' : 'Failed'}`);
        
        if (!connectionTest.success) {
            diagnosticResults.authentication.issues.push(`Connection test failed: ${connectionTest.error}`);
        }
        
    } catch (error) {
        diagnosticResults.authentication.issues.push(`Authentication check failed: ${error.message}`);
        console.log(`  ❌ Authentication Error: ${error.message}`);
    }
}

async function checkNetworking() {
    console.log('\n🌐 3. Network Connectivity Check');
    console.log('-'.repeat(30));
    
    const endpoints = [
        'https://services.leadconnectorhq.com',
        'https://api.gohighlevel.com',
        'https://openai.com',
        'https://api.openai.com'
    ];
    
    diagnosticResults.networking = {
        endpoints: {},
        issues: []
    };
    
    for (const endpoint of endpoints) {
        try {
            const startTime = Date.now();
            const response = await axios.get(endpoint, { timeout: 5000 });
            const responseTime = Date.now() - startTime;
            
            diagnosticResults.networking.endpoints[endpoint] = {
                success: true,
                status: response.status,
                responseTime
            };
            
            console.log(`  ✅ ${endpoint}: ${response.status} (${responseTime}ms)`);
        } catch (error) {
            diagnosticResults.networking.endpoints[endpoint] = {
                success: false,
                error: error.message,
                code: error.code
            };
            
            console.log(`  ❌ ${endpoint}: ${error.message}`);
            diagnosticResults.networking.issues.push(`${endpoint}: ${error.message}`);
        }
    }
}

async function checkDatabase() {
    console.log('\n🗄️ 4. Database Connectivity Check');
    console.log('-'.repeat(30));
    
    try {
        const cosmosService = new CosmosService();
        await cosmosService.initialize();
        
        // Test basic operations
        const testUser = {
            id: `diagnostic_test_${Date.now()}`,
            type: 'diagnostic',
            email: 'diagnostic@test.com',
            name: 'Diagnostic Test'
        };
        
        // Create test document
        await cosmosService.createDocument(testUser);
        console.log('  ✅ Database Write: Success');
        
        // Read test document
        const retrieved = await cosmosService.getDocument(testUser.id, 'diagnostic');
        console.log('  ✅ Database Read: Success');
        
        // Delete test document
        await cosmosService.deleteDocument(testUser.id, 'diagnostic');
        console.log('  ✅ Database Delete: Success');
        
        diagnosticResults.database = {
            success: true,
            operations: ['create', 'read', 'delete'],
            issues: []
        };
        
    } catch (error) {
        diagnosticResults.database = {
            success: false,
            error: error.message,
            issues: [`Database error: ${error.message}`]
        };
        
        console.log(`  ❌ Database Error: ${error.message}`);
    }
}

async function checkGHLService() {
    console.log('\n🛠️ 5. GoHighLevel Service Check');
    console.log('-'.repeat(30));
    
    try {
        const ghlService = new GoHighLevelService();
        await ghlService.initialize();
        
        // Test basic operations
        const testEmail = `diagnostic_${Date.now()}@test.com`;
        
        // Test finding non-existent contact
        const existingContact = await ghlService.findContactByEmail(testEmail);
        console.log(`  ✅ Contact Search: ${existingContact ? 'Found existing' : 'No duplicates'}`);
        
        // Test location access
        const locationId = process.env.GHL_LOCATION_ID;
        if (locationId) {
            console.log(`  ✅ Location ID: ${locationId}`);
        }
        
        diagnosticResults.ghlService = {
            success: true,
            operations: ['search'],
            locationId,
            issues: []
        };
        
    } catch (error) {
        diagnosticResults.ghlService = {
            success: false,
            error: error.message,
            issues: [`GHL service error: ${error.message}`]
        };
        
        console.log(`  ❌ GHL Service Error: ${error.message}`);
    }
}

async function checkSyncProcess() {
    console.log('\n🔄 6. Sync Process Check');
    console.log('-'.repeat(30));
    
    try {
        // Create test user data
        const testUserData = {
            id: `sync_test_${Date.now()}`,
            name: 'Sync Test User',
            email: `synctest_${Date.now()}@diagnostic.com`,
            phone: `+1555${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`,
            company: 'Diagnostic Test Company'
        };
        
        console.log(`  📧 Test Email: ${testUserData.email}`);
        console.log(`  📱 Test Phone: ${testUserData.phone}`);
        
        // Test sync process
        const syncResult = await ghlSyncMiddleware.syncNewUser(testUserData);
        
        if (syncResult.success) {
            console.log(`  ✅ Sync Success: ${syncResult.action} - Contact ID: ${syncResult.ghlContactId}`);
            
            diagnosticResults.sync = {
                success: true,
                action: syncResult.action,
                contactId: syncResult.ghlContactId,
                issues: []
            };
        } else {
            console.log(`  ❌ Sync Failed: ${syncResult.error}`);
            
            diagnosticResults.sync = {
                success: false,
                error: syncResult.error,
                issues: [`Sync failed: ${syncResult.error}`]
            };
        }
        
    } catch (error) {
        diagnosticResults.sync = {
            success: false,
            error: error.message,
            issues: [`Sync process error: ${error.message}`]
        };
        
        console.log(`  ❌ Sync Process Error: ${error.message}`);
    }
}

function generateRecommendations() {
    console.log('\n💡 7. Recommendations & Solutions');
    console.log('-'.repeat(30));
    
    const allIssues = [
        ...diagnosticResults.environment.issues,
        ...diagnosticResults.authentication.issues,
        ...diagnosticResults.networking.issues,
        ...diagnosticResults.database.issues,
        ...diagnosticResults.ghlService.issues,
        ...diagnosticResults.sync.issues
    ];
    
    if (allIssues.length === 0) {
        console.log('  ✅ No issues detected! System appears to be working correctly.');
        diagnosticResults.recommendations.push('System is functioning properly');
        return;
    }
    
    // Generate specific recommendations
    allIssues.forEach(issue => {
        if (issue.includes('Missing required variable')) {
            diagnosticResults.recommendations.push(`Set missing environment variable: ${issue}`);
        } else if (issue.includes('Token')) {
            diagnosticResults.recommendations.push('Refresh GoHighLevel authentication tokens');
        } else if (issue.includes('Connection')) {
            diagnosticResults.recommendations.push('Check network connectivity and firewall settings');
        } else if (issue.includes('Database')) {
            diagnosticResults.recommendations.push('Verify Cosmos DB connection string and permissions');
        } else if (issue.includes('duplicate')) {
            diagnosticResults.recommendations.push('Check for duplicate contacts in GoHighLevel');
        }
    });
    
    console.log(`  📊 Total Issues Found: ${allIssues.length}`);
    diagnosticResults.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
    });
}

async function saveResults() {
    const resultsPath = path.join(__dirname, 'diagnostic-results.json');
    
    const report = {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        results: diagnosticResults,
        summary: {
            totalIssues: [
                ...diagnosticResults.environment.issues,
                ...diagnosticResults.authentication.issues,
                ...diagnosticResults.networking.issues,
                ...diagnosticResults.database.issues,
                ...diagnosticResults.ghlService.issues,
                ...diagnosticResults.sync.issues
            ].length,
            overallStatus: [
                ...diagnosticResults.environment.issues,
                ...diagnosticResults.authentication.issues,
                ...diagnosticResults.networking.issues,
                ...diagnosticResults.database.issues,
                ...diagnosticResults.ghlService.issues,
                ...diagnosticResults.sync.issues
            ].length === 0 ? 'HEALTHY' : 'ISSUES_DETECTED'
        }
    };
    
    try {
        fs.writeFileSync(resultsPath, JSON.stringify(report, null, 2));
        console.log(`\n📄 Diagnostic report saved to: ${resultsPath}`);
    } catch (error) {
        console.log(`\n❌ Failed to save report: ${error.message}`);
    }
}

async function main() {
    try {
        await checkEnvironmentVariables();
        await checkGHLAuthentication();
        await checkNetworking();
        await checkDatabase();
        await checkGHLService();
        await checkSyncProcess();
        generateRecommendations();
        await saveResults();
        
        console.log('\n🎯 Diagnostic Complete!');
        console.log('='.repeat(50));
        
    } catch (error) {
        console.error('❌ Diagnostic failed:', error);
        process.exit(1);
    }
}

// Run the diagnostic
main().catch(console.error); 