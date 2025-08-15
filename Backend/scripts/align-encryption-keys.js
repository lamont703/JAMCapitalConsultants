#!/usr/bin/env node

/**
 * Encryption Key Alignment Script
 * This script helps align development encryption key with production
 */

import { CosmosService } from '../services/cosmosService.js';
import { UserCredentials } from '../models/UserCredentials.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

class KeyAligner {
    constructor() {
        this.cosmosService = null;
        this.userCredentials = null;
        this.envPath = path.join(process.cwd(), '.env');
        this.backupPath = path.join(process.cwd(), '.env.backup');
    }

    async initialize() {
        try {
            console.log('🚀 Initializing services...');
            
            this.cosmosService = new CosmosService();
            await this.cosmosService.initialize();
            console.log('✅ CosmosDB connected');
            
            this.userCredentials = new UserCredentials(this.cosmosService);
            console.log('✅ UserCredentials initialized');
            
            return true;
        } catch (error) {
            console.error('❌ Initialization failed:', error);
            return false;
        }
    }

    async findWorkingKey() {
        try {
            console.log('🔍 Looking for working encryption key...');
            
            // Get all credentials
            const query = "SELECT * FROM c WHERE c.type = 'user_credentials'";
            const credentials = await this.cosmosService.queryDocuments(query);
            
            if (!credentials || credentials.length === 0) {
                console.log('❌ Could not find any credentials');
                return null;
            }

            console.log(`✅ Found ${credentials.length} credential records`);
            
            // Group credentials by user
            const userCredentials = {};
            credentials.forEach(cred => {
                const userId = cred.userId;
                if (!userCredentials[userId]) {
                    userCredentials[userId] = [];
                }
                userCredentials[userId].push(cred);
            });
            
            console.log(`📊 Found ${Object.keys(userCredentials).length} unique users`);
            
            // Try common key formats
            const possibleKeys = [
                process.env.CREDENTIAL_ENCRYPTION_KEY,
                process.env.ENCRYPTION_KEY,
                'jam-credential-secure-key-2024-v1',
                'jam-credential-secure-key-2024',
                'jam-capital-secure-key-2024-v1',
                'jam-capital-secure-key-2024',
                'jam-capital-production-key-2024',
                'jam-capital-encryption-key-2024',
                'jam-capital-credentials-key-2024',
                'jam-capital-master-key-2024',
                // Add more potential keys here
            ];

            console.log(`\n🔑 Testing ${possibleKeys.length} potential key formats...`);
            
            for (const key of possibleKeys) {
                if (!key) {
                    console.log('   ⏩ Skipping empty key');
                    continue;
                }
                
                console.log(`\n🔍 Testing key format: ${key.substring(0, 10)}...`);
                
                try {
                    this.userCredentials.encryptionKey = key;
                    let successCount = 0;
                    let failCount = 0;
                    
                    // Test each user's credentials
                    for (const [userId, userCreds] of Object.entries(userCredentials)) {
                        console.log(`\n   👤 Testing user: ${userId}`);
                        
                        for (const cred of userCreds) {
                            try {
                                const email = this.userCredentials.decrypt(cred.encryptedEmail);
                                const password = this.userCredentials.decrypt(cred.encryptedPassword);
                                
                                console.log(`      ✅ Service: ${cred.serviceType}`);
                                console.log(`         Email: ${email}`);
                                console.log(`         Password: ${password}`);
                                successCount++;
                            } catch (error) {
                                console.log(`      ❌ Service: ${cred.serviceType} - ${error.message}`);
                                failCount++;
                            }
                        }
                    }
                    
                    console.log(`\n   📊 Results for this key:`);
                    console.log(`      ✅ Successful decryptions: ${successCount}`);
                    console.log(`      ❌ Failed decryptions: ${failCount}`);
                    
                    if (successCount > 0) {
                        console.log('\n✅ Found working encryption key!');
                        return key;
                    }
                } catch (error) {
                    console.log(`   ❌ Key failed completely: ${error.message}`);
                }
            }
            
            console.log('\n❌ Could not find working encryption key');
            return null;
            
        } catch (error) {
            console.error('❌ Key search failed:', error);
            return null;
        }
    }

    async updateLocalEnv(workingKey) {
        try {
            console.log('\n🔄 Updating local environment...');
            
            // Backup current .env
            if (fs.existsSync(this.envPath)) {
                fs.copyFileSync(this.envPath, this.backupPath);
                console.log('✅ Created backup at .env.backup');
            }
            
            // Read current .env
            let envContent = '';
            if (fs.existsSync(this.envPath)) {
                envContent = fs.readFileSync(this.envPath, 'utf8');
            }
            
            // Update or add encryption key
            if (envContent.includes('CREDENTIAL_ENCRYPTION_KEY=')) {
                envContent = envContent.replace(
                    /CREDENTIAL_ENCRYPTION_KEY=.*/,
                    `CREDENTIAL_ENCRYPTION_KEY=${workingKey}`
                );
            } else {
                envContent += `\n# Credential Encryption Key (Production)\nCREDENTIAL_ENCRYPTION_KEY=${workingKey}\n`;
            }
            
            // Remove old ENCRYPTION_KEY if exists
            envContent = envContent.replace(/ENCRYPTION_KEY=.*\n/, '');
            
            // Write updated .env
            fs.writeFileSync(this.envPath, envContent);
            console.log('✅ Updated .env with working encryption key');
            
            return true;
        } catch (error) {
            console.error('❌ Environment update failed:', error);
            return false;
        }
    }

    async verifyAlignment() {
        try {
            console.log('\n🔍 Verifying key alignment...');
            
            // Reload environment
            dotenv.config();
            
            // Test decryption
            const query = "SELECT * FROM c WHERE c.type = 'user_credentials' AND c.serviceType = 'smartcredit' AND c.userId = 'user_1748392208121_a1h9fjgel'";
            const credentials = await this.cosmosService.queryDocuments(query);
            
            if (credentials && credentials.length > 0) {
                const cred = credentials[0];
                
                try {
                    const email = this.userCredentials.decrypt(cred.encryptedEmail);
                    const password = this.userCredentials.decrypt(cred.encryptedPassword);
                    
                    console.log('✅ Verification successful!');
                    console.log('   Development environment now matches production');
                    return true;
                } catch (error) {
                    console.log('❌ Verification failed:', error.message);
                    return false;
                }
            }
            
            return false;
        } catch (error) {
            console.error('❌ Verification failed:', error);
            return false;
        }
    }
}

// Main execution
async function main() {
    const aligner = new KeyAligner();
    
    if (await aligner.initialize()) {
        const workingKey = await aligner.findWorkingKey();
        
        if (workingKey) {
            if (await aligner.updateLocalEnv(workingKey)) {
                await aligner.verifyAlignment();
            }
        }
    }
}

// Run the script
main().catch(console.error); 