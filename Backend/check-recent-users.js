import dotenv from 'dotenv';
import { CosmosClient } from '@azure/cosmos';

dotenv.config();

async function getRecentUsers() {
    try {
        console.log('🔍 Searching for the last 5 users added to the database...');
        console.log('');

        // Initialize Cosmos client
        const cosmosClient = new CosmosClient({
            endpoint: process.env.COSMOS_ENDPOINT,
            key: process.env.COSMOS_KEY
        });

        const database = cosmosClient.database(process.env.COSMOS_DATABASE_NAME);
        const container = database.container('jamdbcontainer');

        // Query to get all users and sort by ID (which contains timestamp)
        console.log('📊 Querying user data...');
        const { resources: allUsers } = await container.items
            .query({
                query: "SELECT * FROM c WHERE c.type = 'user' ORDER BY c.id DESC"
            })
            .fetchAll();

        console.log(`📈 Total users found: ${allUsers.length}`);
        console.log('');

        // Get the last 5 users
        const recentUsers = allUsers.slice(0, 5);

        console.log('👥 LAST 5 USERS ADDED:');
        console.log('=' .repeat(80));

        recentUsers.forEach((user, index) => {
            console.log(`${index + 1}. USER DETAILS:`);
            console.log(`   📧 Email: ${user.email}`);
            console.log(`   👤 Name: ${user.name || 'Not provided'}`);
            console.log(`   🆔 ID: ${user.id}`);
            console.log(`   📱 Phone: ${user.phone || 'Not provided'}`);
            
            // Extract timestamp from ID if possible
            if (user.id && user.id.includes('_')) {
                const parts = user.id.split('_');
                if (parts.length > 1 && !isNaN(parts[1])) {
                    const timestamp = parseInt(parts[1]);
                    const date = new Date(timestamp);
                    console.log(`   ⏰ Created: ${date.toLocaleString()}`);
                }
            }
            
            // Check for creation timestamp field
            if (user.createdAt) {
                const createdDate = new Date(user.createdAt);
                console.log(`   📅 Created At: ${createdDate.toLocaleString()}`);
            }
            
            // Show verification status if available
            if (user.isVerified !== undefined) {
                console.log(`   ✅ Verified: ${user.isVerified ? 'Yes' : 'No'}`);
            }
            
            // Show security question if available
            if (user.securityQuestion) {
                console.log(`   🔐 Security Question: ${user.securityQuestion}`);
            }
            
            console.log(`   🔧 Document Type: ${user.type}`);
            console.log('   ' + '-'.repeat(50));
        });

        console.log('');
        console.log('📊 SUMMARY:');
        console.log(`   • Total users in database: ${allUsers.length}`);
        console.log(`   • Showing most recent: ${recentUsers.length}`);
        console.log(`   • Latest user email: ${recentUsers[0]?.email || 'N/A'}`);
        
        // Check if support user is in recent users
        const supportUserInRecent = recentUsers.find(user => 
            user.email === 'support@jamcapitalconsultants.com'
        );
        
        if (supportUserInRecent) {
            console.log('   • ✅ Support user is among recent users');
        } else {
            console.log('   • ℹ️ Support user not in the 5 most recent');
        }

        console.log('');
        console.log('✅ Recent users search completed!');

    } catch (error) {
        console.error('❌ Error searching for recent users:', error.message);
        
        if (error.code === 'ENOTFOUND') {
            console.error('💡 Check your internet connection and Cosmos DB endpoint');
        } else if (error.code === 401) {
            console.error('💡 Check your Cosmos DB access key');
        } else {
            console.error('💡 Check your environment variables and database configuration');
        }
    }
}

// Run the search
getRecentUsers(); 