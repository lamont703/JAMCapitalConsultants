import dotenv from 'dotenv';
import { CosmosClient } from '@azure/cosmos';
import { GoHighLevelService } from './services/ghlService.js';

dotenv.config();

async function checkGHLUserSync() {
    try {
        console.log('🔍 Checking GoHighLevel User Sync Status...');
        console.log('=' .repeat(60));
        console.log('');

        // Initialize Cosmos client
        const cosmosClient = new CosmosClient({
            endpoint: process.env.COSMOS_ENDPOINT,
            key: process.env.COSMOS_KEY
        });

        const database = cosmosClient.database(process.env.COSMOS_DATABASE_NAME);
        const container = database.container('jamdbcontainer');

        // Get the last 5 users
        console.log('📊 Fetching last 5 users...');
        const { resources: allUsers } = await container.items
            .query({
                query: "SELECT * FROM c WHERE c.type = 'user' ORDER BY c.id DESC"
            })
            .fetchAll();

        const recentUsers = allUsers.slice(0, 5);
        console.log(`Found ${recentUsers.length} recent users`);
        console.log('');

        // Check GHL Service Configuration
        console.log('🔧 Checking GoHighLevel Service Configuration...');
        console.log('-'.repeat(50));
        
        const ghlConfigStatus = checkGHLConfig();
        console.log('');

        // Initialize GHL Service if possible
        let ghlService = null;
        let ghlServiceStatus = 'unavailable';
        
        try {
            if (ghlConfigStatus.hasRequiredConfig) {
                ghlService = new GoHighLevelService();
                await ghlService.ensureInitialized();
                ghlServiceStatus = 'initialized';
                console.log('✅ GHL Service initialized successfully');
            } else {
                console.log('❌ GHL Service cannot be initialized - missing configuration');
            }
        } catch (error) {
            console.log(`❌ GHL Service initialization failed: ${error.message}`);
        }
        console.log('');

        // Check each user's sync status
        console.log('👥 CHECKING USER SYNC STATUS:');
        console.log('=' .repeat(60));

        const syncResults = [];

        for (let i = 0; i < recentUsers.length; i++) {
            const user = recentUsers[i];
            console.log(`\n${i + 1}. ${user.email}`);
            console.log(`   Name: ${user.name}`);
            console.log(`   Created: ${new Date(user.createdAt).toLocaleString()}`);
            console.log(`   User ID: ${user.id}`);

            // Check if user should have been synced
            const shouldSync = checkIfUserShouldSync(user);
            console.log(`   Should Sync: ${shouldSync.should ? 'Yes' : 'No'} (${shouldSync.reason})`);

            let syncStatus = 'unknown';
            let ghlContactId = null;
            let syncError = null;

            if (ghlService && shouldSync.should) {
                try {
                    // Check if user exists in GHL
                    console.log(`   🔍 Checking GHL for ${user.email}...`);
                    const ghlContact = await ghlService.findContactByEmail(user.email);
                    
                    if (ghlContact) {
                        syncStatus = 'synced';
                        ghlContactId = ghlContact.id;
                        console.log(`   ✅ SYNCED - GHL Contact ID: ${ghlContactId}`);
                    } else {
                        syncStatus = 'not_synced';
                        console.log(`   ❌ NOT SYNCED - User not found in GHL`);
                    }
                } catch (error) {
                    syncStatus = 'error';
                    syncError = error.message;
                    console.log(`   ⚠️ ERROR checking GHL: ${error.message}`);
                }
            } else if (!ghlService) {
                syncStatus = 'service_unavailable';
                console.log(`   ⚠️ Cannot check - GHL service unavailable`);
            } else {
                syncStatus = 'not_required';
                console.log(`   ℹ️ Sync not required`);
            }

            syncResults.push({
                email: user.email,
                name: user.name,
                userId: user.id,
                createdAt: user.createdAt,
                shouldSync: shouldSync.should,
                syncReason: shouldSync.reason,
                syncStatus: syncStatus,
                ghlContactId: ghlContactId,
                syncError: syncError
            });

            console.log('   ' + '-'.repeat(40));
        }

        // Generate Summary Report
        console.log('\n\n📊 SYNC STATUS SUMMARY:');
        console.log('=' .repeat(60));

        const summary = generateSyncSummary(syncResults, ghlConfigStatus, ghlServiceStatus);
        displaySummary(summary);

        // Provide Recommendations
        console.log('\n🔧 RECOMMENDATIONS:');
        console.log('=' .repeat(60));
        
        const recommendations = generateRecommendations(summary, ghlConfigStatus, ghlServiceStatus);
        recommendations.forEach(rec => console.log(`${rec.icon} ${rec.message}`));

        console.log('\n✅ GHL User Sync Check Complete!');

    } catch (error) {
        console.error('❌ Error checking GHL user sync:', error.message);
        
        if (error.code === 'ENOTFOUND') {
            console.error('💡 Check your internet connection and database configuration');
        } else {
            console.error('💡 Check your environment variables and service configuration');
        }
    }
}

function checkGHLConfig() {
    console.log('Checking environment variables...');
    
    const requiredVars = [
        'GHL_CLIENT_ID',
        'GHL_CLIENT_SECRET', 
        'GHL_LOCATION_ID'
    ];

    const optionalVars = [
        'GHL_WEBHOOK_SECRET',
        'GHL_BASE_URL'
    ];

    const status = {
        hasRequiredConfig: true,
        missingRequired: [],
        missingOptional: [],
        configScore: 0
    };

    // Check required variables
    requiredVars.forEach(varName => {
        if (process.env[varName]) {
            console.log(`   ✅ ${varName}: Present`);
            status.configScore += 20;
        } else {
            console.log(`   ❌ ${varName}: Missing`);
            status.hasRequiredConfig = false;
            status.missingRequired.push(varName);
        }
    });

    // Check optional variables
    optionalVars.forEach(varName => {
        if (process.env[varName]) {
            console.log(`   ✅ ${varName}: Present`);
            status.configScore += 10;
        } else {
            console.log(`   ⚠️ ${varName}: Missing (optional)`);
            status.missingOptional.push(varName);
        }
    });

    console.log(`\n   📊 Configuration Score: ${status.configScore}/80`);
    
    return status;
}

function checkIfUserShouldSync(user) {
    // Check if user registration is recent enough to expect sync
    const userCreated = new Date(user.createdAt);
    const now = new Date();
    const hoursOld = (now - userCreated) / (1000 * 60 * 60);

    // Users should sync if they were created recently and have required fields
    if (!user.email) {
        return { should: false, reason: 'No email address' };
    }

    if (hoursOld > 24) {
        return { should: true, reason: 'Legacy user - sync expected' };
    }

    if (!user.name) {
        return { should: true, reason: 'Recent user - sync expected (minimal data)' };
    }

    return { should: true, reason: 'Recent user - sync expected' };
}

function generateSyncSummary(results, configStatus, serviceStatus) {
    const total = results.length;
    const synced = results.filter(r => r.syncStatus === 'synced').length;
    const notSynced = results.filter(r => r.syncStatus === 'not_synced').length;
    const errors = results.filter(r => r.syncStatus === 'error').length;
    const serviceUnavailable = results.filter(r => r.syncStatus === 'service_unavailable').length;
    const notRequired = results.filter(r => r.syncStatus === 'not_required').length;

    return {
        total,
        synced,
        notSynced,
        errors,
        serviceUnavailable,
        notRequired,
        configStatus,
        serviceStatus,
        syncRate: total > 0 ? Math.round((synced / total) * 100) : 0,
        results
    };
}

function displaySummary(summary) {
    console.log(`📈 Total Users Checked: ${summary.total}`);
    console.log(`✅ Successfully Synced: ${summary.synced}`);
    console.log(`❌ Not Synced: ${summary.notSynced}`);
    console.log(`⚠️ Sync Errors: ${summary.errors}`);
    console.log(`🔧 Service Unavailable: ${summary.serviceUnavailable}`);
    console.log(`ℹ️ Sync Not Required: ${summary.notRequired}`);
    console.log(`📊 Sync Success Rate: ${summary.syncRate}%`);
    console.log('');
    
    console.log('🔧 Service Status:');
    console.log(`   GHL Configuration: ${summary.configStatus.hasRequiredConfig ? '✅ Complete' : '❌ Incomplete'}`);
    console.log(`   GHL Service: ${summary.serviceStatus === 'initialized' ? '✅ Available' : '❌ Unavailable'}`);
}

function generateRecommendations(summary, configStatus, serviceStatus) {
    const recommendations = [];

    // Configuration issues
    if (!configStatus.hasRequiredConfig) {
        recommendations.push({
            icon: '🔧',
            message: `Missing required GHL config: ${configStatus.missingRequired.join(', ')}`
        });
    }

    // Service issues
    if (serviceStatus !== 'initialized') {
        recommendations.push({
            icon: '⚙️',
            message: 'GHL Service not available - check authentication and API connectivity'
        });
    }

    // Sync issues
    if (summary.notSynced > 0 && serviceStatus === 'initialized') {
        recommendations.push({
            icon: '🔄',
            message: `${summary.notSynced} users not synced - manual sync may be required`
        });
    }

    if (summary.errors > 0) {
        recommendations.push({
            icon: '⚠️',
            message: `${summary.errors} sync errors detected - check GHL API connectivity`
        });
    }

    // Positive feedback
    if (summary.synced === summary.total && summary.total > 0) {
        recommendations.push({
            icon: '🎉',
            message: 'All users successfully synced to GoHighLevel!'
        });
    }

    // Default recommendation if no issues
    if (recommendations.length === 0) {
        if (summary.total === 0) {
            recommendations.push({
                icon: 'ℹ️',
                message: 'No recent users to check'
            });
        } else {
            recommendations.push({
                icon: '✅',
                message: 'GHL sync appears to be working correctly'
            });
        }
    }

    return recommendations;
}

// Run the check
checkGHLUserSync(); 