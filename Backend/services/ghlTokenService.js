import { GHLOAuthExchange } from '../scripts/ghlOAuthExchange.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class GHLTokenService {
    constructor() {
        this.oauth = new GHLOAuthExchange();
        this.tokensPath = path.join(__dirname, '../config/ghl-tokens.json');
    }

    async getValidAccessToken() {
        try {
            // Check if current token is still valid
            if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
                return this.accessToken;
            }

            // Try to refresh the token
            console.log('🔄 Refreshing GHL access token...');
            const tokenData = await this.oauth.refreshAccessToken();
            
            this.accessToken = tokenData.access_token;
            this.tokenExpiry = Date.now() + (tokenData.expires_in * 1000);
            
            console.log('✅ GHL access token refreshed successfully');
            return this.accessToken;
            
        } catch (error) {
            // Handle token refresh errors gracefully
            if (error.response?.status === 400 && error.response?.data?.error === 'invalid_grant') {
                console.log('⚠️  GHL refresh token has expired. Please re-authenticate.');
                console.log('   → Go to your GHL OAuth settings to generate new tokens');
            } else {
                console.log(`❌ GHL token refresh failed: ${error.message}`);
            }
            
            // Clear invalid tokens
            this.accessToken = null;
            this.tokenExpiry = null;
            
            throw new Error('GHL authentication required');
        }
    }

    async isTokenValid() {
        try {
            const tokens = await this.oauth.loadSavedTokens();
            return tokens && !this.oauth.isTokenExpired(tokens);
        } catch (error) {
            return false;
        }
    }
} 