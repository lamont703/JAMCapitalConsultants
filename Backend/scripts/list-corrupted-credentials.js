#!/usr/bin/env node

/**
 * List Corrupted Credentials Script
 * Shows which specific credentials need to be re-entered
 */

import { CosmosService } from '../services/cosmosService.js';
import { UserCredentials } from '../models/UserCredentials.js';
import dotenv from 'dotenv';

dotenv.config();

class CredentialChecker {
    constructor() {
        this.cosmosService = null;
        this.userCredentials = null;
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

    async checkCredentials() {
        try {
            console.log('🔍 Checking all credentials...\n');
            
            // Get all credentials
            const query = "SELECT * FROM c WHERE c.type = 'user_credentials'";
            const credentials = await this.cosmosService.queryDocuments(query);
            
            if (!credentials || credentials.length === 0) {
                console.log('❌ No credentials found');
                return null;
            }

            // Group credentials by user
            const userCredentials = {};
            credentials.forEach(cred => {
                const userId = cred.userId;
                if (!userCredentials[userId]) {
                    userCredentials[userId] = {
                        working: [],
                        corrupted: []
                    };
                }
            });

            // Check each credential
            for (const cred of credentials) {
                try {
                    const email = this.userCredentials.decrypt(cred.encryptedEmail);
                    const password = this.userCredentials.decrypt(cred.encryptedPassword);
                    
                    // If we got here, decryption worked
                    userCredentials[cred.userId].working.push({
                        service: cred.serviceType,
                        email,
                        lastAccessed: cred.lastAccessedAt || 'unknown'
                    });
                } catch (error) {
                    userCredentials[cred.userId].corrupted.push({
                        service: cred.serviceType,
                        error: error.message,
                        lastAccessed: cred.lastAccessedAt || 'unknown'
                    });
                }
            }

            // Print results
            console.log('📊 Credential Status by User:\n');
            
            let totalCorrupted = 0;
            let totalWorking = 0;
            
            for (const [userId, status] of Object.entries(userCredentials)) {
                if (status.corrupted.length > 0) {
                    console.log(`👤 User: ${userId}`);
                    
                    if (status.working.length > 0) {
                        console.log('   ✅ Working Credentials:');
                        status.working.forEach(cred => {
                            console.log(`      - ${cred.service}: ${cred.email}`);
                            console.log(`        Last accessed: ${new Date(cred.lastAccessed).toLocaleString()}`);
                        });
                        totalWorking += status.working.length;
                    }
                    
                    console.log('   ❌ Needs Re-entry:');
                    status.corrupted.forEach(cred => {
                        console.log(`      - ${cred.service}`);
                        console.log(`        Last accessed: ${new Date(cred.lastAccessed).toLocaleString()}`);
                        console.log(`        Reason: ${cred.error}`);
                    });
                    totalCorrupted += status.corrupted.length;
                    
                    console.log(''); // Empty line between users
                }
            }
            
            // Print summary
            console.log('📈 Summary:');
            console.log(`   Total Working Credentials: ${totalWorking}`);
            console.log(`   Total Needing Re-entry: ${totalCorrupted}`);
            
            return { totalWorking, totalCorrupted };
            
        } catch (error) {
            console.error('❌ Check failed:', error);
            return null;
        }
    }
}

// Run the check
async function main() {
    const checker = new CredentialChecker();
    if (await checker.initialize()) {
        await checker.checkCredentials();
    }
}

main().catch(console.error); 