import dotenv from 'dotenv';
import { GHLTokenService } from '../services/ghlTokenService.js';
import axios from 'axios';

dotenv.config();

async function findAuthorizedLocation() {
    try {
        console.log('=== Finding Your Authorized GoHighLevel Location ===\n');
        
        const tokenService = new GHLTokenService();
        const accessToken = await tokenService.getValidAccessToken();
        
        console.log('Using OAuth token to find installed locations...\n');
        
        // First, let's try to get user info to find company/app details
        console.log('🔍 Step 1: Getting user information...');
        try {
            const userResponse = await axios.get('https://services.leadconnectorhq.com/users/me', {
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                    'Version': '2021-07-28'
                }
            });
            
            console.log('✅ User info retrieved:');
            console.log(JSON.stringify(userResponse.data, null, 2));
            
            // Extract company ID if available
            const companyId = userResponse.data.companyId || userResponse.data.company?.id;
            if (companyId) {
                console.log(`\n📍 Found Company ID: ${companyId}`);
                
                // Now try to get installed locations
                console.log('\n🔍 Step 2: Getting installed locations...');
                await getInstalledLocations(accessToken, companyId);
            }
            
        } catch (userError) {
            console.log(`❌ User info failed: ${userError.response?.status} - ${userError.response?.data?.message || userError.message}`);
        }
        
        // Try alternative approaches
        console.log('\n🔍 Step 3: Trying alternative location discovery...');
        await tryAlternativeEndpoints(accessToken);
        
    } catch (error) {
        console.error('Script error:', error.message);
    }
}

async function getInstalledLocations(accessToken, companyId) {
    try {
        // We need the app ID - let's try with the client ID from your OAuth
        const appId = process.env.GHL_CLIENT_ID;
        
        console.log(`Trying installed locations with:`);
        console.log(`- Company ID: ${companyId}`);
        console.log(`- App ID: ${appId}`);
        
        const response = await axios.get('https://services.leadconnectorhq.com/oauth/installedLocations', {
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'Version': '2021-07-28'
            },
            params: {
                companyId: companyId,
                appId: appId,
                isInstalled: true
            }
        });
        
        console.log('✅ Installed locations found:');
        console.log(JSON.stringify(response.data, null, 2));
        
        if (response.data.locations && response.data.locations.length > 0) {
            console.log('\n📍 YOUR AUTHORIZED LOCATIONS:');
            response.data.locations.forEach((location, index) => {
                console.log(`${index + 1}. Name: ${location.name}`);
                console.log(`   ID: ${location._id}`);
                console.log(`   Address: ${location.address || 'N/A'}`);
                console.log(`   Installed: ${location.isInstalled}`);
                console.log('   ---');
            });
            
            // Test the first location
            if (response.data.locations[0]) {
                const firstLocationId = response.data.locations[0]._id;
                console.log(`\n🧪 Testing access to first location: ${firstLocationId}`);
                await testLocationAccess(accessToken, firstLocationId);
            }
        }
        
    } catch (error) {
        console.log(`❌ Installed locations failed: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
        
        if (error.response?.data) {
            console.log('Full error response:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

async function tryAlternativeEndpoints(accessToken) {
    const endpoints = [
        '/contacts?limit=1',
        '/opportunities?limit=1',
        '/calendars',
        '/users',
        '/locations',
        '/companies/me'
    ];
    
    for (const endpoint of endpoints) {
        try {
            console.log(`Trying: ${endpoint}`);
            const response = await axios.get(`https://services.leadconnectorhq.com${endpoint}`, {
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                    'Version': '2021-07-28'
                }
            });
            
            console.log(`✅ SUCCESS with ${endpoint}`);
            
            // Look for location IDs in the response
            const responseStr = JSON.stringify(response.data);
            const locationMatches = responseStr.match(/[a-zA-Z0-9]{20,}/g);
            
            if (locationMatches) {
                console.log('Possible location IDs found:', [...new Set(locationMatches)].slice(0, 5));
            }
            
            console.log('Response preview:', JSON.stringify(response.data, null, 2).substring(0, 500) + '...');
            console.log('\n' + '='.repeat(50) + '\n');
            
        } catch (error) {
            console.log(`❌ Failed: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
        }
    }
}

async function testLocationAccess(accessToken, locationId) {
    try {
        const response = await axios.get(`https://services.leadconnectorhq.com/locations/${locationId}`, {
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'Version': '2021-07-28'
            }
        });
        
        console.log(`✅ SUCCESS! Location ${locationId} is accessible!`);
        console.log('Location details:');
        console.log(`   Name: ${response.data.location?.name}`);
        console.log(`   ID: ${response.data.location?.id}`);
        console.log(`   Email: ${response.data.location?.email}`);
        
        console.log('\n🎯 UPDATE YOUR .ENV FILE:');
        console.log(`GHL_LOCATION_ID=${locationId}`);
        
        return true;
        
    } catch (error) {
        console.log(`❌ Location ${locationId} not accessible: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
        return false;
    }
}

findAuthorizedLocation(); 