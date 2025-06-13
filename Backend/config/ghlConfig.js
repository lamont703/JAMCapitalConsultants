import axios from 'axios';
import dotenv from 'dotenv';
import { GHLTokenService } from '../services/ghlTokenService.js';

dotenv.config();

export class GoHighLevelConfig {
    constructor() {
        this.locationId = process.env.GHL_LOCATION_ID;
        this.baseUrl = process.env.GHL_BASE_URL || 'https://services.leadconnectorhq.com';
        this.tokenService = new GHLTokenService();
        
        if (!this.locationId) {
            throw new Error('GoHighLevel Location ID must be provided in environment variables');
        }

        this.client = null;
    }

    async initializeClient() {
        try {
            console.log('🔧 Initializing GHL client...');
            const accessToken = await this.tokenService.getValidAccessToken();
            
            this.client = axios.create({
                baseURL: 'https://services.leadconnectorhq.com',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'Version': '2021-07-28'
                }
            });
            
            console.log('✅ GHL client initialized successfully');
            return true;
            
        } catch (error) {
            // Clean error handling without verbose logging
            if (error.message === 'GHL authentication required') {
                console.log('⚠️  GHL client initialization skipped - authentication required');
            } else {
                console.log(`❌ GHL client initialization failed: ${error.message}`);
            }
            
            this.client = null;
            return false;
        }
    }

    async testConnection() {
        try {
            if (!this.client) {
                await this.initializeClient();
            }

            const response = await this.client.get(`/locations/${this.locationId}`);
            return {
                success: true,
                location: response.data
            };
        } catch (error) {
            console.error('GoHighLevel connection test failed:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data || error.message
            };
        }
    }

    async getClient() {
        if (!this.client) {
            const initialized = await this.initializeClient();
            if (!initialized) {
                throw new Error('GHL client not available - authentication required');
            }
        }
        return this.client;
    }

    getLocationId() {
        return this.locationId;
    }
} 