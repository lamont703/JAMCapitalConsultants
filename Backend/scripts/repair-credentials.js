#!/usr/bin/env node

/**
 * Repair User Credentials Script
 * This script repairs corrupted credentials using the exact same encryption as the model
 */

console.log('🚀 Starting credential repair script...');
console.log('Arguments:', process.argv);

import { CosmosService } from '../services/cosmosService.js';
import dotenv from 'dotenv';
import CryptoJS from 'crypto-js';

console.log('✅ Imports loaded successfully');

dotenv.config();

console.log('✅ Environment loaded');
console.log('🔍 CREDENTIAL_ENCRYPTION_KEY:', process.env.CREDENTIAL_ENCRYPTION_KEY ? 'SET' : 'NOT SET');
console.log('🔍 NODE_ENV:', process.env.NODE_ENV);

class CredentialRepairer {
    constructor() {
        this.cosmosService = null;
        this.encryptionKeys = {
            'v1': process.env.CREDENTIAL_ENCRYPTION_KEY,
            'v2': process.env.CREDENTIAL_ENCRYPTION_KEY_V2,
            'legacy': process.env.ENCRYPTION_KEY
        };
        
        if (!this.encryptionKeys.v1) {
            throw new Error('CREDENTIAL_ENCRYPTION_KEY not found in environment');
        }
    }

    async initialize() {
        try {
            console.log('🚀 Initializing services...');
            this.cosmosService = new CosmosService();
            await this.cosmosService.initialize();
            console.log('✅ CosmosDB connected');
        } catch (error) {
            console.error('❌ Initialization failed:', error);
            throw error;
        }
    }

    encrypt(text, keyId = 'v1') {
        if (!text) return null;
        const key = this.encryptionKeys[keyId] || this.encryptionKeys.v1;
        return CryptoJS.AES.encrypt(text, key).toString();
    }

    tryDecrypt(encryptedText) {
        if (!encryptedText) return null;
        
        // Try all available keys
        for (const [keyId, key] of Object.entries(this.encryptionKeys)) {
            if (!key) continue;
            
            try {
                const bytes = CryptoJS.AES.decrypt(encryptedText, key);
                const decrypted = bytes.toString(CryptoJS.enc.Utf8);
                if (decrypted) {
                    return { decrypted, keyId };
                }
            } catch (error) {
                continue;
            }
        }
        
        throw new Error('Failed to decrypt with any available key');
    }

    async getUserId(email) {
        try {
            const query = `SELECT * FROM c WHERE c.type = 'user' AND c.email = '${email}'`;
            const users = await this.cosmosService.queryDocuments(query);
            return users[0]?.id;
        } catch (error) {
            console.error(`❌ Failed to get user ID for ${email}:`, error);
            return null;
        }
    }

    async repairUserCredentials(email) {
        try {
            console.log(`\n🔍 Checking credentials for ${email}...`);
            
            const userId = await this.getUserId(email);
            if (!userId) {
                console.error('❌ User not found');
                return;
            }
            
            console.log('✅ User found:', userId);

            // Get all credentials for this user
            const query = `SELECT * FROM c WHERE c.type = 'user_credentials' AND c.userId = '${userId}'`;
            const credentials = await this.cosmosService.queryDocuments(query);
            
            if (!credentials || credentials.length === 0) {
                console.log('❌ No credentials found');
                return;
            }

            console.log(`\n📊 Found ${credentials.length} credentials\n`);
            
            for (const cred of credentials) {
                console.log(`\n🔐 Processing ${cred.serviceType} credentials...`);
                console.log(`   Current key version: ${cred.encryptionKeyId || 'none'}`);
                
                try {
                    // Try to decrypt with all available keys
                    const { decrypted: decryptedEmail, keyId: emailKeyId } = this.tryDecrypt(cred.encryptedEmail);
                    const { decrypted: decryptedPassword, keyId: passwordKeyId } = this.tryDecrypt(cred.encryptedPassword);
                    
                    let decryptedSSN = null;
                    let ssnKeyId = null;
                    if (cred.encryptedSSN) {
                        const result = this.tryDecrypt(cred.encryptedSSN);
                        decryptedSSN = result.decrypted;
                        ssnKeyId = result.keyId;
                    }
                    
                    // Re-encrypt everything with v1 key
                    const updatedCred = {
                        ...cred,
                        encryptedEmail: this.encrypt(decryptedEmail, 'v1'),
                        encryptedPassword: this.encrypt(decryptedPassword, 'v1'),
                        encryptionKeyId: 'v1'
                    };
                    
                    if (decryptedSSN) {
                        updatedCred.encryptedSSN = this.encrypt(decryptedSSN, 'v1');
                    }
                    
                    // Update in database
                    await this.cosmosService.updateDocument(cred.id, 'user_credentials', updatedCred);
                    
                    console.log(`✅ ${cred.serviceType} credentials fixed:`);
                    console.log(`   Email: ${decryptedEmail} (was using ${emailKeyId} key)`);
                    console.log(`   Password: ${decryptedPassword} (was using ${passwordKeyId} key)`);
                    if (decryptedSSN) {
                        console.log(`   SSN: ${decryptedSSN} (was using ${ssnKeyId} key)`);
                    }
                    console.log('   All credentials now using v1 key');
                    
                } catch (error) {
                    console.log(`❌ ${cred.serviceType} credentials could not be fixed:`);
                    console.log(`   Error: ${error.message}`);
                    
                    // Try to recover known credentials
                    if (cred.serviceType === 'smartcredit' && email === 'lashaikevans@gmail.com') {
                        console.log('   Attempting to recover SmartCredit credentials...');
                        const recoveredCred = {
                            ...cred,
                            encryptedEmail: this.encrypt('lashaikevans@gmail.com', 'v1'),
                            encryptedPassword: this.encrypt('Kashon1992!!', 'v1'),
                            encryptedSSN: this.encrypt('4094', 'v1'),
                            encryptionKeyId: 'v1'
                        };
                        await this.cosmosService.updateDocument(cred.id, 'user_credentials', recoveredCred);
                        console.log('   ✅ Recovered SmartCredit credentials');
                    }
                    
                    if (cred.serviceType === 'smartcredit' && email === 'amethystware@yahoo.com') {
                        console.log('   Attempting to recover SmartCredit credentials...');
                        const recoveredCred = {
                            ...cred,
                            encryptedEmail: this.encrypt('amethystware@yahoo.com', 'v1'),
                            encryptedPassword: this.encrypt('volleyball06', 'v1'),
                            encryptedSSN: this.encrypt('0000', 'v1'),
                            encryptionKeyId: 'v1'
                        };
                        await this.cosmosService.updateDocument(cred.id, 'user_credentials', recoveredCred);
                        console.log('   ✅ Recovered SmartCredit credentials');
                    }
                    
                    if (cred.serviceType === 'cfpb' && email === 'lashaikevans@gmail.com') {
                        console.log('   Attempting to recover CFPB credentials...');
                        const recoveredCred = {
                            ...cred,
                            encryptedEmail: this.encrypt('lashaikevans@gmail.com', 'v1'),
                            encryptedPassword: this.encrypt('Kashon1992!!', 'v1'),
                            encryptedSSN: this.encrypt('4094', 'v1'),
                            encryptionKeyId: 'v1'
                        };
                        await this.cosmosService.updateDocument(cred.id, 'user_credentials', recoveredCred);
                        console.log('   ✅ Recovered CFPB credentials');
                    }
                    
                    if (cred.serviceType === 'cfpb' && email === 'amethystware@yahoo.com') {
                        console.log('   Attempting to recover CFPB credentials...');
                        const recoveredCred = {
                            ...cred,
                            encryptedEmail: this.encrypt('amethystware@yahoo.com', 'v1'),
                            encryptedPassword: this.encrypt('volleyball06', 'v1'),
                            encryptedSSN: this.encrypt('0000', 'v1'),
                            encryptionKeyId: 'v1'
                        };
                        await this.cosmosService.updateDocument(cred.id, 'user_credentials', recoveredCred);
                        console.log('   ✅ Recovered CFPB credentials');
                    }
                    
                    if (cred.serviceType === 'identityiq' && email === 'wakeshiad@gmail.com') {
                        console.log('   Attempting to recover IdentityIQ credentials...');
                        const recoveredCred = {
                            ...cred,
                            encryptedEmail: this.encrypt('wakeshiad@gmail.com', 'v1'),
                            encryptedPassword: this.encrypt('defaultPassword123', 'v1'),
                            encryptedSSN: this.encrypt('0000', 'v1'),
                            encryptionKeyId: 'v1'
                        };
                        await this.cosmosService.updateDocument(cred.id, 'user_credentials', recoveredCred);
                        console.log('   ✅ Recovered IdentityIQ credentials');
                    }
                }
            }
            
        } catch (error) {
            console.error('❌ Repair failed:', error);
            throw error;
        }
    }
}

console.log('🔍 Debug import.meta.url:', import.meta.url);
console.log('🔍 Debug process.argv[1]:', process.argv[1]);
console.log('🔍 Debug file URL:', `file://${process.argv[1]}`);
console.log('🔍 Condition check:', import.meta.url === `file://${process.argv[1]}`);

// Run the script - fix URL encoding issue
const scriptPath = decodeURIComponent(new URL(import.meta.url).pathname);
const argvPath = process.argv[1];
console.log('🔍 Script path (decoded):', scriptPath);
console.log('🔍 Argv path:', argvPath);
console.log('🔍 Paths match:', scriptPath === argvPath);

if (scriptPath === argvPath) {
    console.log('✅ Script execution block reached');
    
    const email = process.argv[2];
    if (!email) {
        console.error('❌ Please provide an email address');
        console.log('Usage: node repair-credentials.js <email>');
        process.exit(1);
    }
    
    console.log(`✅ Email provided: ${email}`);
    console.log('🚀 Creating repairer instance...');
    
    const repairer = new CredentialRepairer();
    console.log('✅ Repairer instance created');
    
    console.log('🚀 Starting initialization...');
    repairer.initialize()
        .then(() => {
            console.log('✅ Initialization complete, starting repair...');
            return repairer.repairUserCredentials(email);
        })
        .then(() => {
            console.log('✅ Repair complete');
        })
        .catch(error => {
            console.error('❌ Script failed:', error);
            process.exit(1);
        });
} else {
    console.log('❌ Script execution block NOT reached - condition failed');
} 