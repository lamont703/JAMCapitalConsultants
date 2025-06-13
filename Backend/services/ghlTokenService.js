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
            // First, try to load saved tokens
            const savedTokens = await this.oauth.loadSavedTokens();
            
            // Check if saved tokens exist and are still valid
            if (savedTokens && !this.oauth.isTokenExpired(savedTokens)) {
                console.log('✅ Using valid saved GHL access token');
                return savedTokens.access_token;
            }

            // Only refresh if tokens are expired or don't exist
            if (savedTokens && savedTokens.refresh_token) {
                console.log('🔄 Refreshing expired GHL access token...');
                const tokenData = await this.oauth.refreshAccessToken();
                console.log('✅ GHL access token refreshed successfully');
                return tokenData.access_token;
            } else {
                throw new Error('No valid tokens found - authentication required');
            }
            
        } catch (error) {
            // Handle token refresh errors gracefully
            if (error.response?.status === 400 && error.response?.data?.error === 'invalid_grant') {
                console.log('❌ GHL token refresh failed: Refresh token expired - re-authentication required');
            } else {
                console.log(`❌ GHL token refresh failed: ${error.message}`);
            }
            
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