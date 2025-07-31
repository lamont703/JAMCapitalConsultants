#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoHighLevelService } from '../services/ghlService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 GHL Token Deployment Script');
console.log('='.repeat(40));

async function deployTokens() {
    const tokensPath = path.join(__dirname, '../config/ghl-tokens.json');
    
    try {
        // Check if tokens file exists
        if (!fs.existsSync(tokensPath)) {
            console.log('❌ GHL tokens file not found at:', tokensPath);
            console.log('💡 Solution: Ensure ghl-tokens.json is in Backend/config/');
            process.exit(1);
        }
        
        // Read and validate tokens
        const tokensData = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
        
        console.log('📋 Token File Status:');
        console.log(`  ✅ File exists: ${tokensPath}`);
        console.log(`  ✅ Access token: ${tokensData.access_token ? 'Present' : 'Missing'}`);
        console.log(`  ✅ Refresh token: ${tokensData.refresh_token ? 'Present' : 'Missing'}`);
        console.log(`  ✅ Expires at: ${tokensData.expires_at || 'Not set'}`);
        
        // Check token expiration
        if (tokensData.expires_at) {
            const expiresAt = new Date(tokensData.expires_at);
            const now = new Date();
            const minutesUntilExpiry = Math.floor((expiresAt - now) / 1000 / 60);
            
            console.log(`  ⏰ Expires in: ${minutesUntilExpiry} minutes`);
            
            if (minutesUntilExpiry < 0) {
                console.log('  ⚠️ Token is EXPIRED');
            } else if (minutesUntilExpiry < 60) {
                console.log('  ⚠️ Token expires soon (< 1 hour)');
            }
        }
        
        // Test token validity
        console.log('\n🔍 Testing Token Validity:');
        const ghlService = new GoHighLevelService();
        
        try {
            const tokenInfo = await ghlService.getTokenInfo();
            console.log('  ✅ Token service accessible');
            
            if (tokenInfo.isExpired) {
                console.log('  ⚠️ Token is expired - attempting refresh...');
                
                try {
                    const initialized = await ghlService.initialize();
                    if (initialized) {
                        console.log('  ✅ Token refreshed successfully');
                    } else {
                        console.log('  ❌ Token refresh failed');
                    }
                } catch (refreshError) {
                    console.log('  ❌ Token refresh failed:', refreshError.message);
                }
            } else {
                console.log('  ✅ Token is valid');
            }
            
            // Test connection
            const connectionTest = await ghlService.testConnection();
            if (connectionTest.success) {
                console.log('  ✅ GHL connection test passed');
            } else {
                console.log('  ❌ GHL connection test failed:', connectionTest.error);
            }
            
        } catch (error) {
            console.log('  ❌ Token validation failed:', error.message);
        }
        
        // Production deployment instructions
        console.log('\n📦 Production Deployment Instructions:');
        console.log('1. Ensure this tokens file is included in your deployment package');
        console.log('2. Verify file permissions allow read access');
        console.log('3. Check that environment variables are set:');
        console.log('   - GHL_LOCATION_ID');
        console.log('   - JWT_SECRET');
        console.log('   - COSMOS_DB_CONNECTION_STRING');
        console.log('4. Monitor server logs for GHL initialization messages');
        
        console.log('\n✅ Token deployment check complete!');
        
    } catch (error) {
        console.error('❌ Token deployment check failed:', error.message);
        process.exit(1);
    }
}

// Run deployment check
deployTokens().catch(console.error); 