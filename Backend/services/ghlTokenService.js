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
            const tokens = await this.oauth.loadSavedTokens();
            
            if (!tokens) {
                throw new Error('No tokens found. Please run OAuth flow first.');
            }

            // Check if token is expired
            if (this.oauth.isTokenExpired(tokens)) {
                console.log('Access token expired, refreshing...');
                const refreshedTokens = await this.oauth.refreshAccessToken(tokens.refresh_token);
                return refreshedTokens.access_token;
            }

            return tokens.access_token;
            
        } catch (error) {
            console.error('Error getting valid access token:', error);
            throw error;
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