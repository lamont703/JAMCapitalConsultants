import dotenv from 'dotenv';
import { GHLTokenService } from '../services/ghlTokenService.js';
import axios from 'axios';

dotenv.config();

async function listLocations() {
    try {
        const tokenService = new GHLTokenService();
        const accessToken = await tokenService.getValidAccessToken();
        
        console.log('Fetching accessible locations...');
        
        const response = await axios.get('https://services.leadconnectorhq.com/locations/', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Version': '2021-07-28',
                'Content-Type': 'application/json'
            }
        });
        
        console.log('\n=== Your Accessible Locations ===');
        if (response.data.locations && response.data.locations.length > 0) {
            response.data.locations.forEach((location, index) => {
                console.log(`${index + 1}. Name: ${location.name}`);
                console.log(`   ID: ${location.id}`);
                console.log(`   Address: ${location.address || 'N/A'}`);
                console.log('   ---');
            });
        } else {
            console.log('No locations found or different response structure');
            console.log('Full response:', JSON.stringify(response.data, null, 2));
        }
        
    } catch (error) {
        console.error('Error fetching locations:', error.response?.data || error.message);
    }
}

listLocations(); 