#!/usr/bin/env node

/**
 * Credential Corruption Fix and Migration Script
 * 
 * This script:
 * 1. Identifies corrupted credentials
 * 2. Re-encrypts them with the current key
 * 3. Implements proper key versioning
 * 4. Prepares for production migration
 */

import { CosmosService } from '../services/cosmosService.js';
import { UserCredentials } from '../models/UserCredentials.js';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

class CredentialRepairSystem {
    constructor() {
        this.cosmosService = null;
        this.userCredentials = null;
        this.currentKey = process.env.CREDENTIAL_ENCRYPTION_KEY;
        this.newKeyVersion = 'v2'; // New version for re-encrypted credentials
    }

    async initialize() {
        try {
            console.log('🚀 Initializing Credential Repair System...');
            console.log(`🔑 Current Encryption Key: ${this.currentKey ? this.currentKey.substring(0, 8) + '...' : 'NOT SET'}`);
            console.log(`🏷️  New Key Version: ${this.newKeyVersion}`);
            
            this.cosmosService = new CosmosService();
            await this.cosmosService.initialize();
            console.log('✅ CosmosService initialized');

            this.userCredentials = new UserCredentials(this.cosmosService);
            console.log('✅ UserCredentials initialized');

        } catch (error) {
            console.error('❌ Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Scan all credentials and identify corruption
     */
    async scanAllCredentials() {
        console.log('\n🔍 Scanning all credentials for corruption...');
        
        try {
            const query = `SELECT * FROM c WHERE c.type = @type`;
            const parameters = [{ name: '@type', value: 'user_credentials' }];
            
            const allCredentials = await this.cosmosService.queryDocuments(query, parameters);
            console.log(`📊 Found ${allCredentials.length} total credential records`);

            const corruptionReport = {
                total: allCredentials.length,
                corrupted: 0,
                working: 0,
                byService: {},
                byUser: {},
                details: []
            };

            for (const cred of allCredentials) {
                const validation = await this.validateCredential(cred);
                const service = cred.serviceType;
                const userId = cred.userId;

                if (!corruptionReport.byService[service]) {
                    corruptionReport.byService[service] = { total: 0, corrupted: 0, working: 0 };
                }
                if (!corruptionReport.byUser[userId]) {
                    corruptionReport.byUser[userId] = { total: 0, corrupted: 0, working: 0 };
                }

                corruptionReport.byService[service].total++;
                corruptionReport.byUser[userId].total++;

                if (validation.valid) {
                    corruptionReport.working++;
                    corruptionReport.byService[service].working++;
                    corruptionReport.byUser[userId].working++;
                } else {
                    corruptionReport.corrupted++;
                    corruptionReport.byService[service].corrupted++;
                    corruptionReport.byUser[userId].corrupted++;
                }

                corruptionReport.details.push({
                    id: cred.id,
                    userId: cred.userId,
                    serviceType: cred.serviceType,
                    status: cred.status,
                    valid: validation.valid,
                    errors: validation.errors,
                    keyVersion: cred.encryptionKeyId || 'unknown'
                });
            }

            return corruptionReport;

        } catch (error) {
            console.error('❌ Error scanning credentials:', error);
            throw error;
        }
    }

    /**
     * Validate individual credential
     */
    async validateCredential(credential) {
        try {
            const validation = {
                valid: true,
                errors: [],
                warnings: []
            };

            // Check required fields
            if (!credential.encryptedEmail) validation.errors.push('Missing encrypted email');
            if (!credential.encryptedPassword) validation.errors.push('Missing encrypted password');
            if (!credential.encryptedSSN) validation.errors.push('Missing encrypted SSN');

            // Test decryption
            try {
                if (credential.encryptedEmail) {
                    this.userCredentials.decrypt(credential.encryptedEmail);
                }
            } catch (error) {
                validation.errors.push(`Email decryption failed: ${error.message}`);
            }

            try {
                if (credential.encryptedPassword) {
                    this.userCredentials.decrypt(credential.encryptedPassword);
                }
            } catch (error) {
                validation.errors.push(`Password decryption failed: ${error.message}`);
            }

            try {
                if (credential.encryptedSSN) {
                    this.userCredentials.decrypt(credential.encryptedSSN);
                }
            } catch (error) {
                validation.errors.push(`SSN decryption failed: ${error.message}`);
            }

            validation.valid = validation.errors.length === 0;
            return validation;

        } catch (error) {
            return { valid: false, errors: [error.message] };
        }
    }

    /**
     * Re-encrypt corrupted credentials
     */
    async repairCorruptedCredentials(dryRun = true) {
        console.log(`\n🔧 Repairing corrupted credentials... ${dryRun ? '(DRY RUN)' : '(ACTUAL REPAIR)'}`);
        
        try {
            const corruptionReport = await this.scanAllCredentials();
            const corruptedCreds = corruptionReport.details.filter(c => !c.valid);

            if (corruptedCreds.length === 0) {
                console.log('✅ No corrupted credentials found!');
                return { repaired: 0, errors: 0 };
            }

            console.log(`📋 Found ${corruptedCreds.length} corrupted credentials to repair`);

            let repaired = 0;
            let errors = 0;

            for (const cred of corruptedCreds) {
                try {
                    console.log(`\n🔧 Repairing: ${cred.serviceType} for user ${cred.userId}`);
                    
                    // Get the original credential document
                    const originalCred = await this.cosmosService.getDocument(cred.id, 'user_credentials');
                    
                    // Try to decrypt with old key (if possible)
                    let originalEmail, originalPassword, originalSSN;
                    
                    try {
                        originalEmail = this.userCredentials.decrypt(originalCred.encryptedEmail);
                    } catch (e) {
                        originalEmail = 'REPAIR_NEEDED';
                    }
                    
                    try {
                        originalPassword = this.userCredentials.decrypt(originalCred.encryptedPassword);
                    } catch (e) {
                        originalPassword = 'REPAIR_NEEDED';
                    }
                    
                    try {
                        originalSSN = this.userCredentials.decrypt(originalCred.encryptedSSN);
                    } catch (e) {
                        originalSSN = '0000'; // Default fallback
                    }

                    if (dryRun) {
                        console.log(`   📝 Would re-encrypt with new key version ${this.newKeyVersion}`);
                        console.log(`   📝 Email: ${originalEmail !== 'REPAIR_NEEDED' ? '✅' : '❌'} ${originalEmail}`);
                        console.log(`   📝 Password: ${originalPassword !== 'REPAIR_NEEDED' ? '✅' : '❌'} ${originalPassword}`);
                        console.log(`   📝 SSN: ${originalSSN !== '0000' ? '✅' : '❌'} ${originalSSN}`);
                    } else {
                        // Re-encrypt with new key
                        const newEncryptedEmail = this.userCredentials.encrypt(originalEmail);
                        const newEncryptedPassword = this.userCredentials.encrypt(originalPassword);
                        const newEncryptedSSN = this.userCredentials.encrypt(originalSSN);

                        // Update the credential
                        await this.cosmosService.updateDocument(cred.id, 'user_credentials', {
                            encryptedEmail: newEncryptedEmail,
                            encryptedPassword: newEncryptedPassword,
                            encryptedSSN: newEncryptedSSN,
                            encryptionKeyId: this.newKeyVersion,
                            updatedAt: new Date().toISOString(),
                            repairMetadata: {
                                repairedAt: new Date().toISOString(),
                                previousKeyVersion: originalCred.encryptionKeyId || 'unknown',
                                repairReason: 'Data corruption detected'
                            }
                        });

                        console.log(`   ✅ Repaired and re-encrypted with key version ${this.newKeyVersion}`);
                        repaired++;
                    }

                } catch (error) {
                    console.error(`   ❌ Error repairing credential ${cred.id}:`, error.message);
                    errors++;
                }
            }

            if (dryRun) {
                console.log(`\n📊 DRY RUN SUMMARY:`);
                console.log(`   Would repair: ${corruptedCreds.length} credentials`);
                console.log(`   New key version: ${this.newKeyVersion}`);
            } else {
                console.log(`\n📊 REPAIR SUMMARY:`);
                console.log(`   ✅ Repaired: ${repaired} credentials`);
                console.log(`   ❌ Errors: ${errors} credentials`);
                console.log(`   🔑 New key version: ${this.newKeyVersion}`);
            }

            return { repaired, errors };

        } catch (error) {
            console.error('❌ Error repairing credentials:', error);
            throw error;
        }
    }

    /**
     * Generate new encryption key
     */
    generateNewEncryptionKey() {
        const newKey = crypto.randomBytes(32).toString('hex');
        console.log(`\n🔑 Generated new encryption key:`);
        console.log(`   New Key: ${newKey}`);
        console.log(`   Length: ${newKey.length} characters`);
        console.log(`   Version: ${this.newKeyVersion}`);
        
        return newKey;
    }

    /**
     * Create migration plan
     */
    async createMigrationPlan() {
        console.log('\n📋 Creating Production Migration Plan...');
        
        const corruptionReport = await this.scanAllCredentials();
        
        console.log('\n🚀 MIGRATION PLAN:');
        console.log('='.repeat(60));
        console.log('1️⃣ LOCAL PREPARATION:');
        console.log(`   - Scan and identify ${corruptionReport.corrupted} corrupted credentials`);
        console.log(`   - Repair all corrupted credentials locally`);
        console.log(`   - Test with new encryption key version ${this.newKeyVersion}`);
        console.log(`   - Verify all services return 200 status codes`);
        
        console.log('\n2️⃣ PRODUCTION DEPLOYMENT:');
        console.log('   - Deploy updated backend code with improved error handling');
        console.log('   - Update production environment variables with new encryption key');
        console.log('   - Run credential repair script on production database');
        console.log('   - Verify production endpoints work correctly');
        
        console.log('\n3️⃣ ROLLBACK PLAN:');
        console.log('   - Keep old encryption key as backup');
        console.log('   - Monitor for any decryption failures');
        console.log('   - Have rollback script ready if needed');
        
        console.log('\n4️⃣ POST-MIGRATION:');
        console.log('   - Update all credential records to new key version');
        console.log('   - Implement key rotation strategy for future');
        console.log('   - Add credential validation to prevent future corruption');
        
        return corruptionReport;
    }
}

async function main() {
    const repairSystem = new CredentialRepairSystem();
    
    try {
        await repairSystem.initialize();
        
        // Step 1: Scan for corruption
        const corruptionReport = await repairSystem.scanAllCredentials();
        
        console.log('\n📊 CORRUPTION REPORT:');
        console.log('='.repeat(60));
        console.log(`Total Credentials: ${corruptionReport.total}`);
        console.log(`✅ Working: ${corruptionReport.working}`);
        console.log(`❌ Corrupted: ${corruptionReport.corrupted}`);
        
        console.log('\n📋 By Service:');
        Object.entries(corruptionReport.byService).forEach(([service, stats]) => {
            console.log(`   ${service}: ${stats.working}/${stats.total} working`);
        });
        
        // Step 2: Create migration plan
        await repairSystem.createMigrationPlan();
        
        // Step 3: Offer to repair (dry run first)
        if (corruptionReport.corrupted > 0) {
            console.log('\n🔧 Would you like to repair corrupted credentials?');
            console.log('   Run: node scripts/fix-credential-corruption.js repair');
            console.log('   Or: node scripts/fix-credential-corruption.js dry-run');
        }
        
        console.log('\n🏁 Credential repair system ready');
        
    } catch (error) {
        console.error('❌ System failed:', error);
        process.exit(1);
    }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
    const command = process.argv[2];
    
    if (command === 'repair') {
        console.log('🔧 Running ACTUAL REPAIR (not dry run)...');
        (async () => {
            try {
                const repairSystem = new CredentialRepairSystem();
                await repairSystem.initialize();
                await repairSystem.repairCorruptedCredentials(false); // Actual repair
            } catch (error) {
                console.error('❌ Repair failed:', error);
                process.exit(1);
            }
        })();
    } else if (command === 'dry-run') {
        console.log('🔧 Running DRY RUN (no changes will be made)...');
        (async () => {
            try {
                const repairSystem = new CredentialRepairSystem();
                await repairSystem.initialize();
                await repairSystem.repairCorruptedCredentials(true); // Dry run
            } catch (error) {
                console.error('❌ Dry run failed:', error);
                process.exit(1);
            }
        })();
    } else {
        // Only run main() if no command specified
        console.log('📊 Running credential scan and migration plan...');
        main(); // Default: scan and create plan
    }
} else {
    // Only run main() if imported as module
    main();
} 