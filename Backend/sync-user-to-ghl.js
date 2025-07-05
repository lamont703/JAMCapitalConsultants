import dotenv from 'dotenv';
import { CosmosClient } from '@azure/cosmos';
import { GoHighLevelService } from './services/ghlService.js';
import { ghlSyncMiddleware } from './middleware/ghlSyncMiddleware.js';
import { CosmosService } from './services/cosmosService.js';

dotenv.config();

/**
 * Script to sync a specific user to GoHighLevel
 * Usage: node sync-user-to-ghl.js
 */

const USER_DATA = {
    "id": "user_1751598906824_rzjj3vfqn",
    "type": "user",
    "name": "LaDamien Sanders-Crawford",
    "email": "ladamiencrawford@gmail.com",
    "password": "$2b$12$eMRcTZDLLLOVbKyDX1srs..DAHbeTQt.x2s6CeMemxESDiCjpTuQi",
    "phone": "7133578921",
    "company": "",
    "ghlContactId": null,
    "ghlSyncStatus": "failed",
    "role": "user",
    "isActive": true,
    "securityQuestion": "mother_maiden_name",
    "securityAnswerHash": "a46c4b46d80ff756c1b9472bd7c68311209a5002e1cc781c4cbc57157b7154e4819c606139597f18b613885af5f9effdd0e6e50594f2db0d789a439e90232af1",
    "securitySalt": "dd057fa4f7fa3f3c7377c3ea429066c7",
    "createdAt": "2025-07-04T03:15:06.830Z",
    "updatedAt": "2025-07-04T03:15:07.462Z",
    "ghlSyncError": {
        "statusCode": 401,
        "message": "Invalid JWT"
    }
};

async function syncUserToGHL() {
    console.log('🚀 Starting GoHighLevel User Sync Process...');
    console.log('=' .repeat(60));
    console.log('');

    try {
        // Step 1: Initialize services
        console.log('🔧 Initializing services...');
        
        const cosmosService = new CosmosService();
        await cosmosService.initialize();
        console.log('✅ Cosmos DB service initialized');

        const ghlService = new GoHighLevelService();
        await ghlService.initialize();
        console.log('✅ GoHighLevel service initialized');

        // Step 2: Test GHL connection
        console.log('\n🔍 Testing GoHighLevel connection...');
        const connectionTest = await ghlService.testConnection();
        
        if (!connectionTest.success) {
            throw new Error(`GHL connection failed: ${connectionTest.error}`);
        }
        
        console.log('✅ GoHighLevel connection successful');
        console.log(`📍 Location ID: ${connectionTest.locationId}`);
        
        // Step 3: Check if user exists in database
        console.log('\n👤 Checking user in database...');
        const existingUser = await cosmosService.getDocument(USER_DATA.id, 'user');
        
        if (!existingUser) {
            throw new Error(`User ${USER_DATA.id} not found in database`);
        }
        
        console.log('✅ User found in database');
        console.log(`📧 Email: ${existingUser.email}`);
        console.log(`📱 Phone: ${existingUser.phone}`);
        console.log(`🏷️ Current GHL Status: ${existingUser.ghlSyncStatus}`);
        console.log(`🆔 Current GHL Contact ID: ${existingUser.ghlContactId || 'none'}`);
        
        // Step 4: Check if contact already exists in GHL
        console.log('\n🔍 Checking if contact exists in GoHighLevel...');
        const existingContact = await ghlService.findContactByEmail(existingUser.email);
        
        if (existingContact) {
            console.log('✅ Contact already exists in GoHighLevel');
            console.log(`🆔 Existing GHL Contact ID: ${existingContact.id}`);
            
            // Update database with existing contact ID
            await cosmosService.updateDocument(USER_DATA.id, 'user', {
                ghlContactId: existingContact.id,
                ghlSyncStatus: 'synced',
                ghlSyncError: null,
                updatedAt: new Date().toISOString()
            });
            
            console.log('✅ Database updated with existing GHL contact ID');
            console.log('🎉 User sync completed successfully!');
            return;
        }
        
        console.log('📝 No existing contact found - will create new one');
        
        // Step 5: Sync user to GoHighLevel
        console.log('\n🔄 Syncing user to GoHighLevel...');
        
        const syncResult = await ghlSyncMiddleware.syncNewUser({
            id: existingUser.id,
            name: existingUser.name,
            email: existingUser.email,
            phone: existingUser.phone,
            company: existingUser.company || ''
        }, ghlService);
        
        console.log('📊 Sync result:', JSON.stringify(syncResult, null, 2));
        
        // Step 6: Update database with sync results
        if (syncResult.success) {
            console.log('✅ GoHighLevel sync successful!');
            console.log(`🆔 New GHL Contact ID: ${syncResult.ghlContactId}`);
            
            // Update user in database
            await cosmosService.updateDocument(USER_DATA.id, 'user', {
                ghlContactId: syncResult.ghlContactId,
                ghlSyncStatus: 'synced',
                ghlSyncError: null,
                updatedAt: new Date().toISOString()
            });
            
            console.log('✅ Database updated with new GHL contact ID');
            console.log('🎉 User sync completed successfully!');
            
        } else {
            console.log('❌ GoHighLevel sync failed');
            console.log(`🚨 Error: ${syncResult.error}`);
            
            // Update database with failed status
            await cosmosService.updateDocument(USER_DATA.id, 'user', {
                ghlSyncStatus: 'failed',
                ghlSyncError: {
                    message: syncResult.error,
                    timestamp: new Date().toISOString()
                },
                updatedAt: new Date().toISOString()
            });
            
            console.log('📝 Database updated with failed status');
            throw new Error(`GoHighLevel sync failed: ${syncResult.error}`);
        }
        
    } catch (error) {
        console.error('\n❌ User sync failed:', error.message);
        console.error('🔍 Full error:', error);
        
        // If we have database access, update the error status
        try {
            const cosmosService = new CosmosService();
            await cosmosService.initialize();
            
            await cosmosService.updateDocument(USER_DATA.id, 'user', {
                ghlSyncStatus: 'failed',
                ghlSyncError: {
                    message: error.message,
                    timestamp: new Date().toISOString()
                },
                updatedAt: new Date().toISOString()
            });
            
            console.log('📝 Database updated with error status');
        } catch (dbError) {
            console.error('❌ Failed to update database with error status:', dbError.message);
        }
        
        process.exit(1);
    }
}

// Alternative function to sync via API endpoint
async function syncUserViaAPI() {
    console.log('🌐 Alternative: Syncing user via API endpoint...');
    console.log('=' .repeat(60));
    
    try {
        const API_BASE = process.env.API_BASE || 'https://jam-capital-backend.azurewebsites.net/api';
        
        const response = await fetch(`${API_BASE}/ghl/create-contact`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                firstName: USER_DATA.name.split(' ')[0],
                lastName: USER_DATA.name.split(' ').slice(1).join(' '),
                name: USER_DATA.name,
                email: USER_DATA.email,
                phone: USER_DATA.phone,
                source: 'Manual Sync Script',
                tags: ['Website Lead', 'Manual Sync', 'Retry Sync'],
                customFields: [
                    {
                        key: 'registration_date',
                        field_value: USER_DATA.createdAt
                    },
                    {
                        key: 'user_id',
                        field_value: USER_DATA.id
                    },
                    {
                        key: 'sync_method',
                        field_value: 'manual_script'
                    }
                ]
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ User synced via API successfully!');
            console.log(`🆔 GHL Contact ID: ${result.contactId}`);
            console.log('📝 Remember to update the user database record with this contact ID');
            
            // Print update query for manual execution
            console.log('\n📋 Database update query:');
            console.log(`UPDATE user SET ghlContactId = '${result.contactId}', ghlSyncStatus = 'synced', ghlSyncError = null WHERE id = '${USER_DATA.id}'`);
            
        } else {
            console.log('❌ API sync failed:', result.error);
        }
        
    } catch (error) {
        console.error('❌ API sync error:', error.message);
    }
}

// Print user information
function printUserInfo() {
    console.log('👤 User Information:');
    console.log('=' .repeat(40));
    console.log(`🆔 User ID: ${USER_DATA.id}`);
    console.log(`📧 Email: ${USER_DATA.email}`);
    console.log(`👤 Name: ${USER_DATA.name}`);
    console.log(`📱 Phone: ${USER_DATA.phone}`);
    console.log(`🏷️ Current GHL Status: ${USER_DATA.ghlSyncStatus}`);
    console.log(`🚨 Last Error: ${USER_DATA.ghlSyncError?.message || 'none'}`);
    console.log(`📅 Created: ${USER_DATA.createdAt}`);
    console.log(`📅 Updated: ${USER_DATA.updatedAt}`);
    console.log('');
}

// Main execution
async function main() {
    console.log('🔧 GoHighLevel User Sync Script');
    console.log('=' .repeat(60));
    console.log('');
    
    printUserInfo();
    
    // Check command line arguments
    const args = process.argv.slice(2);
    const useAPI = args.includes('--api');
    
    if (useAPI) {
        await syncUserViaAPI();
    } else {
        await syncUserToGHL();
    }
}

// Run the script
main().catch(console.error); 