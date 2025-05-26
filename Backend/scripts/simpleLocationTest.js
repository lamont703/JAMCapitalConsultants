import dotenv from 'dotenv';
import { GHLTokenService } from '../services/ghlTokenService.js';
import axios from 'axios';

dotenv.config();

async function testCommonLocationIds() {
    try {
        console.log('=== Testing Common Location ID Patterns ===\n');
        
        const tokenService = new GHLTokenService();
        const accessToken = await tokenService.getValidAccessToken();
        
        // Try some common location ID patterns or variations
        const possibleLocationIds = [
            process.env.GHL_LOCATION_ID, // Current one
            process.env.GHL_CLIENT_ID,   // Sometimes client ID = location ID
            // Add any other IDs you might have seen in your GHL account
        ];
        
        for (const locationId of possibleLocationIds) {
            if (!locationId) continue;
            
            console.log(`Testing location ID: ${locationId}`);
            
            try {
                const response = await axios.get(`https://services.leadconnectorhq.com/locations/${locationId}`, {
                    headers: {
                        'Accept': 'application/json',
                        'Authorization': `Bearer ${accessToken}`,
                        'Version': '2021-07-28'
                    }
                });
                
                console.log(`✅ SUCCESS! Location ${locationId} is accessible!`);
                console.log('Location details:', JSON.stringify(response.data, null, 2));
                return;
                
            } catch (error) {
                console.log(`❌ Failed: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
            }
        }
        
        console.log('\n💡 None of the tested location IDs worked.');
        console.log('You need to re-run OAuth with broader scopes or check your GHL account for the correct location ID.');
        
    } catch (error) {
        console.error('Script error:', error.message);
    }
}

testCommonLocationIds(); 