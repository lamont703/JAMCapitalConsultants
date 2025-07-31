#!/usr/bin/env node

import dotenv from 'dotenv';
import { GoHighLevelService } from './services/ghlService.js';
import { ghlSyncMiddleware } from './middleware/ghlSyncMiddleware.js';

// Load environment variables
dotenv.config();

console.log('⚡ Quick Production GHL Sync Check');
console.log('=' .repeat(40));

async function quickCheck() {
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'unknown'}`);
    console.log(`📍 Port: ${process.env.PORT || 'unknown'}`);
    
    // 1. Essential Environment Variables
    console.log('\n1️⃣ Essential Variables:');
    const essential = ['GHL_LOCATION_ID', 'JWT_SECRET', 'COSMOS_DB_CONNECTION_STRING'];
    essential.forEach(varName => {
        const exists = !!process.env[varName];
        console.log(`  ${exists ? '✅' : '❌'} ${varName}: ${exists ? 'SET' : 'MISSING'}`);
    });
    
    // 2. GHL Token Check
    console.log('\n2️⃣ GHL Authentication:');
    try {
        const ghlService = new GoHighLevelService();
        const tokenInfo = await ghlService.getTokenInfo();
        
        console.log(`  ${tokenInfo.hasAccessToken ? '✅' : '❌'} Access Token: ${tokenInfo.hasAccessToken ? 'Present' : 'Missing'}`);
        console.log(`  ${tokenInfo.hasRefreshToken ? '✅' : '❌'} Refresh Token: ${tokenInfo.hasRefreshToken ? 'Present' : 'Missing'}`);
        console.log(`  ${!tokenInfo.isExpired ? '✅' : '⚠️'} Token Status: ${tokenInfo.isExpired ? 'EXPIRED' : 'Valid'}`);
        
        if (tokenInfo.expiresAt) {
            const expiresIn = Math.floor((new Date(tokenInfo.expiresAt) - new Date()) / 1000 / 60);
            console.log(`  ⏰ Expires in: ${expiresIn} minutes`);
        }
        
        // Test initialization
        const initialized = await ghlService.initialize();
        console.log(`  ${initialized ? '✅' : '❌'} Initialization: ${initialized ? 'Success' : 'Failed'}`);
        
        if (initialized) {
            const connectionTest = await ghlService.testConnection();
            console.log(`  ${connectionTest.success ? '✅' : '❌'} Connection: ${connectionTest.success ? 'Success' : 'Failed'}`);
            
            if (!connectionTest.success) {
                console.log(`    Error: ${connectionTest.error}`);
            }
        }
        
    } catch (error) {
        console.log(`  ❌ GHL Error: ${error.message}`);
    }
    
    // 3. Quick Sync Test
    console.log('\n3️⃣ Quick Sync Test:');
    try {
        const testUser = {
            id: `quick_test_${Date.now()}`,
            name: 'Quick Test User',
            email: `quicktest_${Date.now()}@diagnostic.com`,
            phone: `+1555${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`,
            company: 'Test Company'
        };
        
        console.log(`  📧 Test Email: ${testUser.email}`);
        console.log(`  📱 Test Phone: ${testUser.phone}`);
        
        const syncResult = await ghlSyncMiddleware.syncNewUser(testUser);
        
        if (syncResult.success) {
            console.log(`  ✅ Sync Result: ${syncResult.action.toUpperCase()}`);
            console.log(`  🆔 Contact ID: ${syncResult.ghlContactId}`);
        } else {
            console.log(`  ❌ Sync Failed: ${syncResult.error}`);
            
            // Common error patterns
            if (syncResult.error.includes('duplicated contacts')) {
                console.log('  💡 Solution: Check for duplicate contacts in GHL');
            } else if (syncResult.error.includes('Invalid JWT') || syncResult.error.includes('401')) {
                console.log('  💡 Solution: Refresh GHL authentication tokens');
            } else if (syncResult.error.includes('timeout')) {
                console.log('  💡 Solution: Check network connectivity');
            }
        }
        
    } catch (error) {
        console.log(`  ❌ Sync Error: ${error.message}`);
    }
    
    // 4. Common Issues Check
    console.log('\n4️⃣ Common Production Issues:');
    
    // Check for Azure-specific issues
    if (process.env.NODE_ENV === 'production') {
        console.log('  🔍 Production Environment Detected');
        
        // Check if running on Azure
        if (process.env.WEBSITE_HOSTNAME) {
            console.log(`  🌐 Azure App Service: ${process.env.WEBSITE_HOSTNAME}`);
        }
        
        // Check for Azure-specific environment variables
        const azureVars = ['APPLICATIONINSIGHTS_CONNECTION_STRING', 'AZURE_STORAGE_CONNECTION_STRING'];
        azureVars.forEach(varName => {
            const exists = !!process.env[varName];
            console.log(`  ${exists ? '✅' : '⚠️'} ${varName}: ${exists ? 'SET' : 'NOT SET'}`);
        });
        
        // Check for common production issues
        if (!process.env.GHL_ACCESS_TOKEN && !process.env.GHL_REFRESH_TOKEN) {
            console.log('  ⚠️ No GHL tokens in environment - may need re-authentication');
        }
    }
    
    console.log('\n🎯 Quick Check Complete!');
}

// Run the quick check
quickCheck().catch(error => {
    console.error('❌ Quick check failed:', error);
    process.exit(1);
}); 