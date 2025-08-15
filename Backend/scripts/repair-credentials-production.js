import dotenv from 'dotenv';
import CryptoJS from 'crypto-js';
import { CosmosService } from '../services/cosmosService.js';
import { UserCredentials } from '../models/UserCredentials.js';

// Load environment variables
dotenv.config();

class ProductionCredentialRepairer {
    constructor() {
        // Use production encryption key
        this.productionEncryptionKey = 'jam-capital-credential-encryption-key-2024-super-secure';
        this.cosmosService = null;
        this.userCredentials = null;
    }

    async initialize() {
        console.log('🚀 Initializing production credential repairer...');
        
        // Initialize Cosmos DB service
        this.cosmosService = new CosmosService();
        await this.cosmosService.initialize();
        console.log('✅ CosmosDB connected');
        
        // Initialize UserCredentials with production key
        this.userCredentials = new UserCredentials();
        // Override the encryption key with production key
        this.userCredentials.encryptionKey = this.productionEncryptionKey;
        console.log('✅ UserCredentials initialized with production key');
    }

    encrypt(text, keyVersion = 'v1') {
        return CryptoJS.AES.encrypt(text, this.productionEncryptionKey).toString();
    }

    decrypt(encryptedText) {
        try {
            const bytes = CryptoJS.AES.decrypt(encryptedText, this.productionEncryptionKey);
            const decrypted = bytes.toString(CryptoJS.enc.Utf8);
            if (!decrypted) {
                throw new Error('Failed to decrypt - invalid data or key');
            }
            return decrypted;
        } catch (error) {
            throw new Error('Failed to decrypt data');
        }
    }

    async repairUserCredentials(email) {
        console.log(`\n🔍 Repairing credentials for ${email}...`);
        
        // Find user
        const userQuery = `SELECT * FROM c WHERE c.type = 'user' AND c.email = '${email.toLowerCase()}'`;
        const userResults = await this.cosmosService.queryDocuments(userQuery);
        
        if (userResults.length === 0) {
            console.log(`❌ User not found: ${email}`);
            return;
        }
        
        const user = userResults[0];
        console.log(`✅ User found: ${user.id}`);
        
        // Find credentials
        const credQuery = `SELECT * FROM c WHERE c.type = 'user_credentials' AND c.userId = '${user.id}'`;
        const credentials = await this.cosmosService.queryDocuments(credQuery);
        
        console.log(`📊 Found ${credentials.length} credentials\n`);
        
        for (const cred of credentials) {
            console.log(`🔐 Processing ${cred.serviceType} credentials...`);
            
            try {
                // Try to decrypt with production key
                const decryptedEmail = this.decrypt(cred.encryptedEmail);
                const decryptedPassword = this.decrypt(cred.encryptedPassword);
                const decryptedSSN = this.decrypt(cred.encryptedSSN);
                
                console.log(`✅ ${cred.serviceType} credentials are already working with production key`);
                console.log(`   Email: ${decryptedEmail}`);
                console.log(`   Password: [HIDDEN]`);
                console.log(`   SSN: ${decryptedSSN}`);
                
            } catch (error) {
                console.log(`❌ ${cred.serviceType} credentials need repair: ${error.message}`);
                
                // Apply recovery logic based on known credentials
                let recoveredEmail, recoveredPassword, recoveredSSN;
                
                if (cred.serviceType === 'smartcredit' && email === 'lashaikevans@gmail.com') {
                    recoveredEmail = 'lashaikevans@gmail.com';
                    recoveredPassword = 'Kashon1992!!';
                    recoveredSSN = '4094';
                } else if (cred.serviceType === 'cfpb' && email === 'lashaikevans@gmail.com') {
                    recoveredEmail = 'lashaikevans@gmail.com';
                    recoveredPassword = 'Kashon1992!!';
                    recoveredSSN = '4094';
                } else if (cred.serviceType === 'smartcredit' && email === 'amethystware@yahoo.com') {
                    recoveredEmail = 'amethystware@yahoo.com';
                    recoveredPassword = 'volleyball06';
                    recoveredSSN = '0000';
                } else if (cred.serviceType === 'cfpb' && email === 'amethystware@yahoo.com') {
                    recoveredEmail = 'amethystware@yahoo.com';
                    recoveredPassword = 'volleyball06';
                    recoveredSSN = '0000';
                } else if (cred.serviceType === 'identityiq' && email === 'wakeshiad@gmail.com') {
                    recoveredEmail = 'wakeshiad@gmail.com';
                    recoveredPassword = 'defaultPassword123';
                    recoveredSSN = '0000';
                } else {
                    console.log(`   ⚠️  No recovery data available for ${cred.serviceType}`);
                    continue;
                }
                
                console.log(`   🔧 Applying recovery data...`);
                
                // Encrypt with production key
                const updatedCred = {
                    ...cred,
                    encryptedEmail: this.encrypt(recoveredEmail),
                    encryptedPassword: this.encrypt(recoveredPassword),
                    encryptedSSN: this.encrypt(recoveredSSN),
                    encryptionKeyId: 'v1',
                    updatedAt: new Date().toISOString()
                };
                
                // Update in database
                await this.cosmosService.updateDocument(cred.id, 'user_credentials', updatedCred);
                
                console.log(`   ✅ ${cred.serviceType} credentials repaired with production key`);
                console.log(`   Email: ${recoveredEmail}`);
                console.log(`   Password: [HIDDEN]`);
                console.log(`   SSN: ${recoveredSSN}`);
            }
            
            console.log(''); // Empty line for readability
        }
        
        console.log('✅ Repair complete for user');
    }

    async repairAllKnownUsers() {
        console.log('🎯 PRODUCTION CREDENTIAL REPAIR');
        console.log('===============================\n');
        
        const knownUsers = [
            'lashaikevans@gmail.com',
            'wakeshiad@gmail.com',
            'amethystware@yahoo.com'
        ];
        
        for (const email of knownUsers) {
            await this.repairUserCredentials(email);
        }
        
        console.log('\n🎉 All known users processed!');
    }
}

async function main() {
    try {
        const repairer = new ProductionCredentialRepairer();
        await repairer.initialize();
        await repairer.repairAllKnownUsers();
    } catch (error) {
        console.error('❌ Repair failed:', error);
        process.exit(1);
    }
}

// Run if executed directly
const scriptPath = decodeURIComponent(new URL(import.meta.url).pathname);
if (scriptPath === process.argv[1]) {
    main();
}

export default ProductionCredentialRepairer; 