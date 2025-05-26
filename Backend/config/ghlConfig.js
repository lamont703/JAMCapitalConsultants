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
            const accessToken = await this.tokenService.getValidAccessToken();
            
            this.client = axios.create({
                baseURL: this.baseUrl,
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'Version': '2021-07-28'
                },
                timeout: 30000
            });

            return this.client;
        } catch (error) {
            console.error('Failed to initialize GHL client:', error);
            throw error;
        }
    }

    async testConnection() {
        try {
            if (!this.client) {
                await this.initializeClient();
            }

            const response = await this.client.get(`/locations/${this.locationId}`);
            console.log('GoHighLevel connection test successful');
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
            await this.initializeClient();
        }
        return this.client;
    }

    getLocationId() {
        return this.locationId;
    }
} 