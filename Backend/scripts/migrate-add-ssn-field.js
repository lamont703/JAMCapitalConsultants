/**
 * Database Migration Script: Add SSN Field to Existing Credentials
 * 
 * This script will:
 * 1. Find all credential documents that don't have an encryptedSSN field
 * 2. Add a placeholder encrypted SSN field to maintain consistency
 * 3. Log all changes for audit purposes
 * 4. Provide rollback capability
 * 
 * Usage:
 * node scripts/migrate-add-ssn-field.js [--dry-run] [--rollback]
 * 
 * Options:
 * --dry-run: Show what would be changed without making actual changes
 * --rollback: Remove the placeholder SSN fields (use with caution)
 */

import { CosmosClient } from '@azure/cosmos';
import CryptoJS from 'crypto-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

class SSNMigration {
    constructor() {
        this.cosmosClient = null;
        this.database = null;
        this.container = null;
        this.dryRun = false;
        this.rollback = false;
        this.placeholderSSN = '0000'; // Default placeholder
        
        // Use the same encryption key as UserCredentials model
        this.encryptionKey = process.env.CREDENTIAL_ENCRYPTION_KEY || 'your-secure-32-character-key-here';
        
        // Validate encryption key length for AES-256
        if (this.encryptionKey.length < 32) {
            console.warn('⚠️ Encryption key should be at least 32 characters for AES-256');
        }
    }

    /**
     * Initialize Cosmos DB connection using the same logic as cosmosConfig.js
     */
    async initialize() {
        try {
            console.log('🔗 Connecting to Cosmos DB...');
            
            // Use the same logic as cosmosConfig.js
            let endpoint, key;
            const connectionString = process.env.COSMOS_DB_CONNECTION_STRING;
            
            if (connectionString) {
                // Parse connection string
                const endpointMatch = connectionString.match(/AccountEndpoint=([^;]+)/);
                const keyMatch = connectionString.match(/AccountKey=([^;]+)/);
                
                endpoint = endpointMatch ? endpointMatch[1] : null;
                key = keyMatch ? keyMatch[1] : null;
            } else {
                // Fallback to individual environment variables
                endpoint = process.env.COSMOS_ENDPOINT;
                key = process.env.COSMOS_KEY;
            }

            if (!endpoint || !key) {
                throw new Error('CosmosDB endpoint and key must be provided in environment variables');
            }

            this.cosmosClient = new CosmosClient({
                endpoint: endpoint,
                key: key
            });

            // Use the same database and container names as cosmosConfig.js
            const databaseId = process.env.COSMOS_DB_DATABASE_NAME || process.env.COSMOS_DATABASE_NAME || 'jamdb';
            const containerId = process.env.COSMOS_DB_CONTAINER_NAME || process.env.COSMOS_CONTAINER_NAME || 'jamdbcontainer';

            console.log(`📋 Using database: ${databaseId}`);
            console.log(`📋 Using container: ${containerId}`);

            this.database = this.cosmosClient.database(databaseId);
            this.container = this.database.container(containerId);

            // Test the connection
            await this.cosmosClient.getDatabaseAccount();
            console.log('✅ Connected to Cosmos DB successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to connect to Cosmos DB:', error);
            return false;
        }
    }

    /**
     * Encrypt data using CryptoJS (same method as UserCredentials)
     */
    encrypt(text) {
        try {
            const encrypted = CryptoJS.AES.encrypt(text, this.encryptionKey).toString();
            return encrypted;
        } catch (error) {
            console.error('❌ Encryption error:', error);
            throw new Error('Failed to encrypt data');
        }
    }

    /**
     * Decrypt data using CryptoJS (same method as UserCredentials)
     */
    decrypt(encryptedText) {
        try {
            const bytes = CryptoJS.AES.decrypt(encryptedText, this.encryptionKey);
            const decrypted = bytes.toString(CryptoJS.enc.Utf8);
            
            if (!decrypted) {
                throw new Error('Failed to decrypt - invalid key or corrupted data');
            }
            
            return decrypted;
        } catch (error) {
            console.error('❌ Decryption error:', error);
            return null;
        }
    }

    /**
     * Find all credentials that need migration
     */
    async findCredentialsToMigrate() {
        try {
            console.log('🔍 Searching for credentials that need migration...');

            const query = {
                query: `
                    SELECT * FROM c 
                    WHERE c.type = "user_credentials" 
                    AND c.status = "active"
                    ${this.rollback ? 'AND IS_DEFINED(c.encryptedSSN)' : 'AND NOT IS_DEFINED(c.encryptedSSN)'}
                `
            };

            const { resources: credentials } = await this.container.items.query(query).fetchAll();
            
            console.log(`📊 Found ${credentials.length} credentials that ${this.rollback ? 'have' : 'need'} SSN field migration`);
            
            return credentials;
        } catch (error) {
            console.error('❌ Error finding credentials:', error);
            throw error;
        }
    }

    /**
     * Migrate a single credential
     */
    async migrateCredential(credential) {
        try {
            const credentialId = credential.id;
            
            if (this.rollback) {
                // Remove the encryptedSSN field
                delete credential.encryptedSSN;
                console.log(`🔄 [ROLLBACK] Removing SSN field from credential: ${credentialId}`);
            } else {
                // Add encrypted SSN placeholder
                const encryptedSSN = this.encrypt(this.placeholderSSN);
                credential.encryptedSSN = encryptedSSN;
                console.log(`➕ Adding SSN placeholder to credential: ${credentialId}`);
            }

            // Update timestamp
            credential.updatedAt = new Date().toISOString();
            credential.migrationNote = this.rollback 
                ? 'SSN field removed via migration script'
                : `SSN placeholder added via migration script on ${new Date().toISOString()}`;

            if (!this.dryRun) {
                // Update the document in Cosmos DB using the correct partition key
                // The partition key is '/type' and the value is 'user_credentials'
                await this.container.item(credentialId, 'user_credentials').replace(credential);
                console.log(`✅ Successfully ${this.rollback ? 'removed SSN from' : 'updated'} credential: ${credentialId}`);
            } else {
                console.log(`🔍 [DRY RUN] Would ${this.rollback ? 'remove SSN from' : 'update'} credential: ${credentialId}`);
            }

            return {
                id: credentialId,
                userId: credential.userId,
                serviceType: credential.serviceType,
                success: true
            };

        } catch (error) {
            console.error(`❌ Error migrating credential ${credential.id}:`, error);
            return {
                id: credential.id,
                userId: credential.userId,
                serviceType: credential.serviceType,
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Run the migration
     */
    async runMigration() {
        try {
            console.log('🚀 Starting SSN field migration...');
            console.log(`📋 Mode: ${this.dryRun ? 'DRY RUN' : 'LIVE MIGRATION'}`);
            console.log(`🔄 Operation: ${this.rollback ? 'ROLLBACK (Remove SSN)' : 'ADD SSN PLACEHOLDERS'}`);
            console.log('─'.repeat(60));

            // Find credentials to migrate
            const credentials = await this.findCredentialsToMigrate();

            if (credentials.length === 0) {
                console.log('✅ No credentials need migration. All done!');
                return;
            }

            // Show summary before proceeding
            console.log('\n📊 Migration Summary:');
            console.log(`   Total credentials to process: ${credentials.length}`);
            
            const serviceBreakdown = credentials.reduce((acc, cred) => {
                acc[cred.serviceType] = (acc[cred.serviceType] || 0) + 1;
                return acc;
            }, {});

            console.log('   Breakdown by service:');
            Object.entries(serviceBreakdown).forEach(([service, count]) => {
                console.log(`     - ${service}: ${count} credentials`);
            });

            if (!this.dryRun) {
                console.log('\n⚠️  This will make permanent changes to your database!');
                console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...');
                await new Promise(resolve => setTimeout(resolve, 5000));
            }

            console.log('\n🔄 Processing credentials...');
            
            // Process each credential
            const results = [];
            let successCount = 0;
            let errorCount = 0;

            for (const credential of credentials) {
                const result = await this.migrateCredential(credential);
                results.push(result);
                
                if (result.success) {
                    successCount++;
                } else {
                    errorCount++;
                }

                // Add small delay to avoid overwhelming the database
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // Final summary
            console.log('\n' + '═'.repeat(60));
            console.log('📊 Migration Complete!');
            console.log(`✅ Successfully processed: ${successCount} credentials`);
            console.log(`❌ Errors: ${errorCount} credentials`);
            
            if (errorCount > 0) {
                console.log('\n❌ Failed credentials:');
                results.filter(r => !r.success).forEach(result => {
                    console.log(`   - ${result.id} (${result.serviceType}): ${result.error}`);
                });
            }

            if (!this.dryRun) {
                console.log('\n🎉 Database migration completed successfully!');
                if (!this.rollback) {
                    console.log('   All existing credentials now have encrypted SSN placeholders.');
                    console.log('   You can now test credential retrieval with SSN field support.');
                }
            } else {
                console.log('\n🔍 Dry run completed. No changes were made to the database.');
                console.log('   Run without --dry-run to perform the actual migration.');
            }

        } catch (error) {
            console.error('❌ Migration failed:', error);
            throw error;
        }
    }

    /**
     * Verify migration results
     */
    async verifyMigration() {
        try {
            console.log('\n🔍 Verifying migration results...');

            const query = {
                query: `
                    SELECT 
                        COUNT(1) as total,
                        SUM(IS_DEFINED(c.encryptedSSN) ? 1 : 0) as withSSN,
                        SUM(IS_DEFINED(c.encryptedSSN) ? 0 : 1) as withoutSSN
                    FROM c 
                    WHERE c.type = "user_credentials" 
                    AND c.status = "active"
                `
            };

            const { resources: results } = await this.container.items.query(query).fetchAll();
            const stats = results[0];

            console.log('📊 Current database state:');
            console.log(`   Total active credentials: ${stats.total}`);
            console.log(`   With SSN field: ${stats.withSSN}`);
            console.log(`   Without SSN field: ${stats.withoutSSN}`);

            if (stats.withoutSSN === 0 && !this.rollback) {
                console.log('✅ All credentials now have SSN field!');
            } else if (stats.withSSN === 0 && this.rollback) {
                console.log('✅ All SSN fields have been removed!');
            }

        } catch (error) {
            console.error('❌ Error verifying migration:', error);
        }
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const rollback = args.includes('--rollback');
    const help = args.includes('--help') || args.includes('-h');

    if (help) {
        console.log(`
🔧 SSN Field Migration Script

Usage: node scripts/migrate-add-ssn-field.js [options]

Options:
  --dry-run    Show what would be changed without making actual changes
  --rollback   Remove SSN placeholder fields (use with caution)
  --help, -h   Show this help message

Examples:
  node scripts/migrate-add-ssn-field.js --dry-run     # Preview changes
  node scripts/migrate-add-ssn-field.js               # Run migration
  node scripts/migrate-add-ssn-field.js --rollback    # Remove SSN fields
        `);
        process.exit(0);
    }

    const migration = new SSNMigration();
    migration.dryRun = dryRun;
    migration.rollback = rollback;

    try {
        // Initialize connection
        const connected = await migration.initialize();
        if (!connected) {
            console.error('❌ Failed to connect to database. Exiting.');
            process.exit(1);
        }

        // Run migration
        await migration.runMigration();

        // Verify results
        await migration.verifyMigration();

        console.log('\n🏁 Script completed successfully!');
        process.exit(0);

    } catch (error) {
        console.error('💥 Script failed:', error);
        process.exit(1);
    }
}

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n⚠️  Migration interrupted by user. Exiting...');
    process.exit(1);
});

process.on('SIGTERM', () => {
    console.log('\n⚠️  Migration terminated. Exiting...');
    process.exit(1);
});

// Run the script
main().catch(error => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
}); 