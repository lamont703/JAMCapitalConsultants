import dotenv from 'dotenv';
import { CosmosService } from '../services/cosmosService.js';
import { GoHighLevelService } from '../services/ghlService.js';
import { ghlSyncMiddleware } from '../middleware/ghlSyncMiddleware.js';

dotenv.config();

/**
 * Script to monitor and fix failed GoHighLevel syncs
 * Usage: node scripts/monitor-ghl-sync.js
 */

class GHLSyncMonitor {
    constructor() {
        this.cosmosService = new CosmosService();
        this.ghlService = new GoHighLevelService();
    }

    async initialize() {
        console.log('🔧 Initializing GHL Sync Monitor...');
        
        await this.cosmosService.initialize();
        console.log('✅ Cosmos DB service initialized');
        
        const ghlInitialized = await this.ghlService.initialize();
        if (ghlInitialized) {
            console.log('✅ GoHighLevel service initialized');
        } else {
            console.log('❌ GoHighLevel service initialization failed');
            throw new Error('Cannot proceed without GHL service');
        }
    }

    async findFailedSyncs() {
        console.log('\n🔍 Finding users with failed GHL syncs...');
        
        const query = `
            SELECT * FROM c 
            WHERE c.type = 'user' 
            AND c.ghlSyncStatus = 'failed' 
            AND c.isActive = true
            ORDER BY c.createdAt DESC
        `;
        
        const users = await this.cosmosService.queryDocuments(query);
        console.log(`Found ${users.length} users with failed GHL syncs`);
        
        return users;
    }

    async findJWTFailures() {
        console.log('\n🔍 Finding JWT authentication failures...');
        
        const query = `
            SELECT * FROM c 
            WHERE c.type = 'user' 
            AND c.ghlSyncStatus = 'failed' 
            AND c.isActive = true
            AND (
                CONTAINS(c.ghlSyncError.message, 'Invalid JWT') OR 
                CONTAINS(c.ghlSyncError.message, '401') OR 
                CONTAINS(c.ghlSyncError.message, 'unauthorized') OR
                CONTAINS(c.ghlSyncError.message, 'invalid_grant')
            )
            ORDER BY c.createdAt DESC
        `;
        
        const users = await this.cosmosService.queryDocuments(query);
        console.log(`Found ${users.length} users with JWT authentication failures`);
        
        return users;
    }

    async retryFailedSync(user) {
        console.log(`\n🔄 Retrying sync for: ${user.email} (${user.id})`);
        
        try {
            // Check if contact already exists in GHL
            const existingContact = await this.ghlService.findContactByEmail(user.email);
            
            if (existingContact) {
                console.log(`✅ Contact already exists in GHL: ${existingContact.id}`);
                
                // Update database with existing contact ID
                await this.cosmosService.updateDocument(user.id, 'user', {
                    ghlContactId: existingContact.id,
                    ghlSyncStatus: 'synced',
                    ghlSyncError: null,
                    updatedAt: new Date().toISOString()
                });
                
                return {
                    success: true,
                    action: 'existing_contact_linked',
                    ghlContactId: existingContact.id
                };
            }
            
            // Attempt to create new contact
            const syncResult = await ghlSyncMiddleware.syncNewUser({
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                company: user.company || ''
            }, this.ghlService);
            
            if (syncResult.success) {
                console.log(`✅ Sync successful: ${user.email} -> ${syncResult.ghlContactId}`);
                
                // Update database with success
                await this.cosmosService.updateDocument(user.id, 'user', {
                    ghlContactId: syncResult.ghlContactId,
                    ghlSyncStatus: 'synced',
                    ghlSyncError: null,
                    updatedAt: new Date().toISOString()
                });
                
                return {
                    success: true,
                    action: 'new_contact_created',
                    ghlContactId: syncResult.ghlContactId
                };
            } else {
                console.log(`❌ Sync failed: ${user.email} - ${syncResult.error}`);
                
                // Update database with new error
                await this.cosmosService.updateDocument(user.id, 'user', {
                    ghlSyncStatus: 'failed',
                    ghlSyncError: {
                        message: syncResult.error,
                        timestamp: new Date().toISOString(),
                        retryAttempt: true
                    },
                    updatedAt: new Date().toISOString()
                });
                
                return {
                    success: false,
                    error: syncResult.error
                };
            }
            
        } catch (error) {
            console.error(`❌ Exception during retry: ${error.message}`);
            
            // Update database with exception
            await this.cosmosService.updateDocument(user.id, 'user', {
                ghlSyncStatus: 'failed',
                ghlSyncError: {
                    message: `Retry exception: ${error.message}`,
                    timestamp: new Date().toISOString(),
                    retryAttempt: true
                },
                updatedAt: new Date().toISOString()
            });
            
            return {
                success: false,
                error: error.message
            };
        }
    }

    async runMonitoring() {
        console.log('🚀 Starting GHL Sync Monitoring...');
        console.log('=' .repeat(60));
        
        try {
            await this.initialize();
            
            // Find all failed syncs
            const failedUsers = await this.findFailedSyncs();
            
            if (failedUsers.length === 0) {
                console.log('✅ No failed syncs found - all users are synced!');
                return;
            }
            
            // Find JWT-specific failures
            const jwtFailures = await this.findJWTFailures();
            
            console.log(`\n📊 Summary:`);
            console.log(`   Total failed syncs: ${failedUsers.length}`);
            console.log(`   JWT authentication failures: ${jwtFailures.length}`);
            console.log(`   Other failures: ${failedUsers.length - jwtFailures.length}`);
            
            // Send alert if there are JWT failures
            if (jwtFailures.length > 0) {
                await this.sendJWTAlert(jwtFailures);
            }
            
            // Retry failed syncs
            console.log('\n🔄 Retrying failed syncs...');
            
            let successCount = 0;
            let failureCount = 0;
            
            for (const user of failedUsers) {
                const result = await this.retryFailedSync(user);
                
                if (result.success) {
                    successCount++;
                } else {
                    failureCount++;
                }
                
                // Small delay between retries
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            console.log(`\n🎉 Monitoring Complete!`);
            console.log(`   ✅ Successfully fixed: ${successCount}`);
            console.log(`   ❌ Still failing: ${failureCount}`);
            
            if (failureCount > 0) {
                console.log(`\n⚠️  ${failureCount} users still have sync issues - manual intervention may be required`);
            }
            
        } catch (error) {
            console.error('❌ Monitoring failed:', error);
            throw error;
        }
    }

    async sendJWTAlert(jwtFailures) {
        console.log(`\n📧 Sending JWT failure alert for ${jwtFailures.length} users...`);
        
        try {
            // Log the alert (in production, you'd send actual email)
            const alertData = {
                id: `jwt_alert_${Date.now()}`,
                type: 'jwt_failure_alert',
                timestamp: new Date().toISOString(),
                failureCount: jwtFailures.length,
                users: jwtFailures.map(user => ({
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    errorMessage: user.ghlSyncError?.message,
                    createdAt: user.createdAt
                }))
            };
            
            // Store alert in database for tracking
            await this.cosmosService.createDocument(alertData, 'jwt_failure_alert');
            
            console.log('📧 JWT failure alert logged - implement email notification in production');
            
        } catch (error) {
            console.error('❌ Failed to send JWT alert:', error);
        }
    }

    async checkTokenHealth() {
        console.log('\n🔍 Checking GoHighLevel token health...');
        
        try {
            const tokenInfo = await this.ghlService.getTokenInfo();
            
            console.log('📊 Token Status:');
            console.log(`   Has Access Token: ${tokenInfo.tokenInfo.hasAccessToken}`);
            console.log(`   Has Refresh Token: ${tokenInfo.tokenInfo.hasRefreshToken}`);
            console.log(`   Token Expired: ${tokenInfo.tokenInfo.isExpired}`);
            console.log(`   Expires At: ${tokenInfo.tokenInfo.expiresAt}`);
            
            if (tokenInfo.tokenInfo.isExpired) {
                console.log('⚠️  Token is expired - attempting refresh...');
                await this.ghlService.initialize();
                console.log('✅ Token refreshed successfully');
            } else {
                console.log('✅ Token is healthy');
            }
            
        } catch (error) {
            console.error('❌ Token health check failed:', error);
            throw error;
        }
    }
}

// Main execution
async function main() {
    const monitor = new GHLSyncMonitor();
    
    try {
        await monitor.checkTokenHealth();
        await monitor.runMonitoring();
        
    } catch (error) {
        console.error('❌ Monitor failed:', error);
        process.exit(1);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export { GHLSyncMonitor }; 