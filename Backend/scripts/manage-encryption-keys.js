#!/usr/bin/env node

/**
 * Encryption Key Management Script
 * 
 * This script helps:
 * 1. Generate new encryption keys
 * 2. Validate key strength
 * 3. Create environment files
 * 4. Manage key rotation
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

class EncryptionKeyManager {
    constructor() {
        this.currentKey = process.env.CREDENTIAL_ENCRYPTION_KEY;
        this.envPath = path.join(process.cwd(), '.env');
        this.backupPath = path.join(process.cwd(), '.env.backup');
    }

    /**
     * Generate a new strong encryption key
     */
    generateNewKey() {
        const newKey = crypto.randomBytes(32).toString('hex');
        console.log('🔑 Generated new encryption key:');
        console.log(`   Key: ${newKey}`);
        console.log(`   Length: ${newKey.length} characters`);
        console.log(`   Strength: Strong (256-bit)`);
        
        return newKey;
    }

    /**
     * Validate encryption key strength
     */
    validateKey(key) {
        const validation = {
            valid: true,
            issues: [],
            strength: 'weak'
        };

        if (!key) {
            validation.valid = false;
            validation.issues.push('No key provided');
            return validation;
        }

        if (key.length < 32) {
            validation.valid = false;
            validation.issues.push(`Key too short: ${key.length} chars (need 32+)`);
        }

        if (key.length >= 32 && key.length < 64) {
            validation.strength = 'medium';
        } else if (key.length >= 64) {
            validation.strength = 'strong';
        }

        // Check for weak patterns
        if (key === key.toLowerCase()) {
            validation.issues.push('Key contains only lowercase (weak)');
        }

        if (key === key.toUpperCase()) {
            validation.issues.push('Key contains only uppercase (weak)');
        }

        if (!/\d/.test(key)) {
            validation.issues.push('Key contains no numbers (weak)');
        }

        if (!/[a-zA-Z]/.test(key)) {
            validation.issues.push('Key contains no letters (weak)');
        }

        return validation;
    }

    /**
     * Backup current environment file
     */
    backupEnvironment() {
        try {
            if (fs.existsSync(this.envPath)) {
                fs.copyFileSync(this.envPath, this.backupPath);
                console.log(`✅ Environment backed up to: ${this.backupPath}`);
                return true;
            } else {
                console.log('⚠️  No .env file found to backup');
                return false;
            }
        } catch (error) {
            console.error('❌ Backup failed:', error.message);
            return false;
        }
    }

    /**
     * Update environment file with new key
     */
    updateEnvironment(newKey, keyVersion = 'v2') {
        try {
            // Backup first
            this.backupEnvironment();

            // Read current .env file
            let envContent = '';
            if (fs.existsSync(this.envPath)) {
                envContent = fs.readFileSync(this.envPath, 'utf8');
            }

            // Check if CREDENTIAL_ENCRYPTION_KEY already exists
            if (envContent.includes('CREDENTIAL_ENCRYPTION_KEY=')) {
                // Replace existing key
                envContent = envContent.replace(
                    /CREDENTIAL_ENCRYPTION_KEY=.*/,
                    `CREDENTIAL_ENCRYPTION_KEY=${newKey}`
                );
            } else {
                // Add new key
                envContent += `\n# Credential Encryption Key (${keyVersion})\nCREDENTIAL_ENCRYPTION_KEY=${newKey}\n`;
            }

            // Write updated content
            fs.writeFileSync(this.envPath, envContent);
            console.log(`✅ Environment updated with new encryption key (${keyVersion})`);
            
            return true;
        } catch (error) {
            console.error('❌ Environment update failed:', error.message);
            return false;
        }
    }

    /**
     * Create production environment template
     */
    createProductionTemplate(newKey, keyVersion = 'v2') {
        const template = `# JAM Capital Backend - Production Environment
# Generated: ${new Date().toISOString()}
# Key Version: ${keyVersion}

# === CREDENTIAL ENCRYPTION ===
CREDENTIAL_ENCRYPTION_KEY=${newKey}

# === DATABASE CONFIGURATION ===
COSMOS_DB_CONNECTION_STRING=your-production-cosmos-connection-string
COSMOS_DB_DATABASE_NAME=jamdb
COSMOS_DB_CONTAINER_NAME=jamdbcontainer

# === AZURE STORAGE ===
AZURE_STORAGE_CONNECTION_STRING=your-production-storage-connection-string
AZURE_STORAGE_CONTAINER_NAME=jam-uploads

# === SECURITY SETTINGS ===
JWT_SECRET=your-production-jwt-secret-minimum-32-characters
NODE_ENV=production

# === CORS SETTINGS ===
CORS_ORIGIN=https://jamcapitalconsultants.com,https://www.jamcapitalconsultants.com

# === RATE LIMITING ===
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# === LOGGING ===
LOG_LEVEL=info
ENABLE_REQUEST_LOGGING=true

# === MONITORING ===
APPLICATIONINSIGHTS_CONNECTION_STRING=your-production-app-insights-connection-string
`;

        const templatePath = path.join(process.cwd(), '.env.production.template');
        fs.writeFileSync(templatePath, template);
        console.log(`✅ Production template created: ${templatePath}`);
        
        return templatePath;
    }

    /**
     * Show current key status
     */
    showCurrentStatus() {
        console.log('\n🔍 Current Encryption Key Status:');
        console.log('='.repeat(50));
        
        if (this.currentKey) {
            const validation = this.validateKey(this.currentKey);
            console.log(`🔑 Current Key: ${this.currentKey.substring(0, 8)}...${this.currentKey.substring(this.currentKey.length - 8)}`);
            console.log(`📏 Length: ${this.currentKey.length} characters`);
            console.log(`💪 Strength: ${validation.strength.toUpperCase()}`);
            
            if (validation.issues.length > 0) {
                console.log(`⚠️  Issues: ${validation.issues.join(', ')}`);
            } else {
                console.log(`✅ Key validation: PASSED`);
            }
        } else {
            console.log('❌ No encryption key found in environment');
        }
        
        console.log(`📁 Environment file: ${this.envPath}`);
        console.log(`💾 Backup file: ${this.backupPath}`);
    }

    /**
     * Create migration checklist
     */
    createMigrationChecklist() {
        console.log('\n📋 PRODUCTION MIGRATION CHECKLIST:');
        console.log('='.repeat(60));
        
        console.log('\n1️⃣ PRE-MIGRATION (Local):');
        console.log('   ✅ Run: node scripts/fix-credential-corruption.js');
        console.log('   ✅ Verify all credentials work locally');
        console.log('   ✅ Test all credential endpoints return 200');
        console.log('   ✅ Backup current encryption key');
        
        console.log('\n2️⃣ CODE DEPLOYMENT:');
        console.log('   ✅ Deploy updated backend to production');
        console.log('   ✅ Verify production server starts successfully');
        console.log('   ✅ Test production health endpoint');
        
        console.log('\n3️⃣ KEY MIGRATION:');
        console.log('   ✅ Update production environment variables');
        console.log('   ✅ Restart production server');
        console.log('   ✅ Run credential repair on production database');
        
        console.log('\n4️⃣ VERIFICATION:');
        console.log('   ✅ Test all credential endpoints in production');
        console.log('   ✅ Verify no 500 errors occur');
        console.log('   ✅ Check production logs for any issues');
        
        console.log('\n5️⃣ POST-MIGRATION:');
        console.log('   ✅ Monitor for 24-48 hours');
        console.log('   ✅ Verify all user credentials work');
        console.log('   ✅ Document the migration process');
        
        console.log('\n⚠️  ROLLBACK PLAN:');
        console.log('   - Keep old encryption key as backup');
        console.log('   - Have rollback script ready');
        console.log('   - Monitor for any decryption failures');
    }
}

async function main() {
    const keyManager = new EncryptionKeyManager();
    
    try {
        const command = process.argv[2];
        
        switch (command) {
            case 'generate':
                console.log('🔑 Generating new encryption key...');
                const newKey = keyManager.generateNewKey();
                const validation = keyManager.validateKey(newKey);
                
                if (validation.valid) {
                    console.log('\n💡 To use this key:');
                    console.log('   node scripts/manage-encryption-keys.js update <key>');
                } else {
                    console.log('\n❌ Key validation failed:');
                    validation.issues.forEach(issue => console.log(`   - ${issue}`));
                }
                break;
                
            case 'update':
                const key = process.argv[3];
                if (!key) {
                    console.log('❌ Please provide a key: node scripts/manage-encryption-keys.js update <key>');
                    process.exit(1);
                }
                
                const keyValidation = keyManager.validateKey(key);
                if (keyValidation.valid) {
                    keyManager.updateEnvironment(key);
                } else {
                    console.log('❌ Key validation failed:');
                    keyValidation.issues.forEach(issue => console.log(`   - ${issue}`));
                }
                break;
                
            case 'backup':
                keyManager.backupEnvironment();
                break;
                
            case 'status':
                keyManager.showCurrentStatus();
                break;
                
            case 'template':
                const newKey = keyManager.generateNewKey();
                keyManager.createProductionTemplate(newKey);
                break;
                
            case 'checklist':
                keyManager.createMigrationChecklist();
                break;
                
            default:
                console.log('🔑 Encryption Key Management Tool');
                console.log('='.repeat(40));
                console.log('Available commands:');
                console.log('  generate    - Generate new encryption key');
                console.log('  update <key> - Update environment with new key');
                console.log('  backup      - Backup current environment');
                console.log('  status      - Show current key status');
                console.log('  template    - Create production environment template');
                console.log('  checklist   - Show migration checklist');
                console.log('\nExamples:');
                console.log('  node scripts/manage-encryption-keys.js generate');
                console.log('  node scripts/manage-encryption-keys.js update abc123...');
                console.log('  node scripts/manage-encryption-keys.js status');
                break;
        }
        
    } catch (error) {
        console.error('❌ Key management failed:', error);
        process.exit(1);
    }
}

main(); 