import dotenv from 'dotenv';
import { GHLTokenService } from '../services/ghlTokenService.js';
import axios from 'axios';

dotenv.config();

async function testLocationEndpoint() {
    try {
        console.log('=== GoHighLevel Location API Test ===\n');
        
        const tokenService = new GHLTokenService();
        const accessToken = await tokenService.getValidAccessToken();
        const locationId = process.env.GHL_LOCATION_ID;
        
        console.log(`Testing location endpoint with:`);
        console.log(`- Location ID: ${locationId}`);
        console.log(`- Access Token: ${accessToken.substring(0, 20)}...`);
        console.log(`- Endpoint: https://services.leadconnectorhq.com/locations/${locationId}\n`);
        
        // Make the API request exactly as documented
        const response = await axios.get(`https://services.leadconnectorhq.com/locations/${locationId}`, {
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'Version': '2021-07-28'
            },
            timeout: 30000
        });
        
        console.log('✅ SUCCESS! Location details retrieved:\n');
        
        // Parse and display the location data nicely
        const location = response.data.location;
        
        console.log('📍 LOCATION INFORMATION:');
        console.log(`   ID: ${location.id}`);
        console.log(`   Name: ${location.name}`);
        console.log(`   Company ID: ${location.companyId}`);
        console.log(`   Domain: ${location.domain}`);
        console.log(`   Email: ${location.email}`);
        console.log(`   Phone: ${location.phone}`);
        console.log(`   Timezone: ${location.timezone}`);
        
        if (location.address) {
            console.log('\n🏢 ADDRESS:');
            console.log(`   Address: ${location.address}`);
            console.log(`   City: ${location.city}`);
            console.log(`   State: ${location.state}`);
            console.log(`   Country: ${location.country}`);
            console.log(`   Postal Code: ${location.postalCode}`);
        }
        
        if (location.business) {
            console.log('\n🏪 BUSINESS INFO:');
            console.log(`   Business Name: ${location.business.name}`);
            console.log(`   Website: ${location.business.website}`);
        }
        
        if (location.settings) {
            console.log('\n⚙️ SETTINGS:');
            console.log(`   Allow Duplicate Contacts: ${location.settings.allowDuplicateContact}`);
            console.log(`   Allow Duplicate Opportunities: ${location.settings.allowDuplicateOpportunity}`);
            console.log(`   Disable Contact Timezone: ${location.settings.disableContactTimezone}`);
        }
        
        console.log('\n📋 FULL RESPONSE:');
        console.log(JSON.stringify(response.data, null, 2));
        
        // Test if we can also access contacts endpoint for this location
        console.log('\n🔍 Testing contacts access...');
        try {
            const contactsResponse = await axios.get(`https://services.leadconnectorhq.com/contacts/`, {
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                    'Version': '2021-07-28'
                },
                params: {
                    locationId: locationId,
                    limit: 1
                }
            });
            
            console.log('✅ Contacts endpoint accessible!');
            console.log(`   Found ${contactsResponse.data.meta?.total || 'unknown'} total contacts`);
            
        } catch (contactError) {
            console.log('❌ Contacts endpoint failed:');
            console.log(`   Status: ${contactError.response?.status}`);
            console.log(`   Error: ${contactError.response?.data?.message || contactError.message}`);
        }
        
    } catch (error) {
        console.error('❌ LOCATION API TEST FAILED:\n');
        console.error(`Status Code: ${error.response?.status}`);
        console.error(`Status Text: ${error.response?.statusText}`);
        
        if (error.response?.data) {
            console.error('Error Response:');
            console.error(JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Error Message:', error.message);
        }
        
        // Provide helpful debugging info
        console.log('\n🔧 DEBUGGING INFO:');
        console.log(`Request URL: https://services.leadconnectorhq.com/locations/${process.env.GHL_LOCATION_ID}`);
        console.log(`Request Headers:`);
        console.log(`   Accept: application/json`);
        console.log(`   Authorization: Bearer ${accessToken?.substring(0, 20)}...`);
        console.log(`   Version: 2021-07-28`);
        
        if (error.response?.status === 401) {
            console.log('\n💡 POSSIBLE SOLUTIONS:');
            console.log('   1. Token may not be authorized for this location');
            console.log('   2. Location ID might be incorrect');
            console.log('   3. Token may have expired');
            console.log('   4. Insufficient permissions/scopes');
        }
        
        if (error.response?.status === 404) {
            console.log('\n💡 POSSIBLE SOLUTIONS:');
            console.log('   1. Location ID does not exist');
            console.log('   2. Check if the location ID is correct in .env file');
        }
    }
}

// Also create a function to test with a different location ID
async function testWithCustomLocationId(customLocationId) {
    console.log(`\n=== Testing with custom location ID: ${customLocationId} ===`);
    
    const originalLocationId = process.env.GHL_LOCATION_ID;
    process.env.GHL_LOCATION_ID = customLocationId;
    
    await testLocationEndpoint();
    
    // Restore original
    process.env.GHL_LOCATION_ID = originalLocationId;
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length > 0 && args[0] !== 'default') {
        // Test with custom location ID
        await testWithCustomLocationId(args[0]);
    } else {
        // Test with .env location ID
        await testLocationEndpoint();
    }
}

console.log('Starting GoHighLevel Location API Test...\n');
main().catch(console.error); 