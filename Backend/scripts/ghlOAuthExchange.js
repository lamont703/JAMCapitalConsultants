import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class GHLOAuthExchange {
    constructor() {
        this.clientId = process.env.GHL_CLIENT_ID;
        this.clientSecret = process.env.GHL_CLIENT_SECRET;
        this.redirectUri = process.env.GHL_REDIRECT_URI;
        this.tokenEndpoint = 'https://services.leadconnectorhq.com/oauth/token';
        
        if (!this.clientId || !this.clientSecret || !this.redirectUri) {
            throw new Error('Missing required OAuth credentials in .env file');
        }
    }

    generateAuthUrl() {
        const baseUrl = 'https://marketplace.leadconnectorhq.com/oauth/chooselocation';
        const params = new URLSearchParams({
            response_type: 'code',
            redirect_uri: this.redirectUri,
            client_id: this.clientId,
            scope: 'contacts.write contacts.read locations.read locations.write users.read users.write opportunities.read opportunities.write calendars.read calendars.write payments.read payments.write subscriptions.read subscriptions.write'
        });
        
        const fullUrl = `${baseUrl}?${params.toString()}`;
        console.log('📋 Authorization URL for GoHighLevel:');
        console.log(fullUrl);
        console.log('\n📝 This URL includes payment and subscription scopes needed for cancellation features.');
        return fullUrl;
    }

    async exchangeCodeForTokens(authorizationCode) {
        try {
            const response = await axios.post(this.tokenEndpoint, {
                client_id: this.clientId,
                client_secret: this.clientSecret,
                grant_type: 'authorization_code',
                code: authorizationCode,
                redirect_uri: this.redirectUri
            }, {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            const tokens = {
                access_token: response.data.access_token,
                refresh_token: response.data.refresh_token,
                expires_in: response.data.expires_in,
                expires_at: new Date(Date.now() + (response.data.expires_in * 1000)).toISOString(),
                token_type: response.data.token_type,
                scope: response.data.scope
            };

            await this.saveTokens(tokens);
            await this.updateEnvFile(tokens.access_token);
            
            return tokens;
        } catch (error) {
            console.error('Token exchange failed:', error.response?.data || error.message);
            throw error;
        }
    }

    async refreshAccessToken() {
        try {
            console.log('🔄 Attempting to refresh GHL access token...');
            
            // Load saved tokens to get refresh token
            const savedTokens = await this.loadSavedTokens();
            if (!savedTokens?.refresh_token) {
                throw new Error('No refresh token found. Please re-authenticate.');
            }
            
            console.log('🔍 Using refresh token from saved tokens...');
            
            const response = await axios.post(this.tokenEndpoint, {
                client_id: this.clientId,
                client_secret: this.clientSecret,
                grant_type: 'refresh_token',
                refresh_token: savedTokens.refresh_token
            }, {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });
            
            // Update saved tokens with new access token
            const updatedTokens = {
                ...savedTokens,
                access_token: response.data.access_token,
                expires_in: response.data.expires_in,
                expires_at: new Date(Date.now() + (response.data.expires_in * 1000)).toISOString(),
                // Keep the same refresh token unless a new one is provided
                refresh_token: response.data.refresh_token || savedTokens.refresh_token
            };
            
            await this.saveTokens(updatedTokens);
            await this.updateEnvFile(updatedTokens.access_token);
            
            console.log('✅ Tokens refreshed and saved successfully');
            
            return response.data;
            
        } catch (error) {
            console.error('❌ Token refresh error details:', {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                message: error.message
            });
            
            // Clean, specific error handling
            if (error.response?.status === 400) {
                const errorData = error.response.data;
                if (errorData.error === 'invalid_grant') {
                    throw new Error('Refresh token expired - re-authentication required');
                } else {
                    throw new Error(`OAuth error: ${errorData.error_description || errorData.error}`);
                }
            } else if (error.response?.status === 401) {
                throw new Error('OAuth credentials invalid');
            } else if (error.response?.status === 422) {
                throw new Error(`Validation error: ${error.response?.data?.message || 'Invalid request format'}`);
            } else {
                throw new Error(`Network error during token refresh: ${error.message}`);
            }
        }
    }

    isTokenExpired(tokens) {
        if (!tokens.expires_at) return true;
        const expiresAt = new Date(tokens.expires_at);
        const now = new Date();
        // Add 5 minute buffer
        return (expiresAt.getTime() - now.getTime()) < (5 * 60 * 1000);
    }

    async saveTokens(tokens) {
        const tokensPath = path.join(__dirname, '../config/ghl-tokens.json');
        const configDir = path.dirname(tokensPath);
        
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        
        fs.writeFileSync(tokensPath, JSON.stringify(tokens, null, 2));
    }

    async loadSavedTokens() {
        const tokensPath = path.join(__dirname, '../config/ghl-tokens.json');
        
        // First try to load from file (for local development)
        if (fs.existsSync(tokensPath)) {
            return JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
        }
        
        // Fallback to environment variables (for production Azure)
        if (process.env.GHL_STORED_ACCESS_TOKEN && process.env.GHL_STORED_REFRESH_TOKEN) {
            console.log('🔄 Loading GHL tokens from environment variables (production)');
            return {
                access_token: process.env.GHL_STORED_ACCESS_TOKEN,
                refresh_token: process.env.GHL_STORED_REFRESH_TOKEN,
                expires_at: process.env.GHL_TOKEN_EXPIRES_AT,
                token_type: 'Bearer'
            };
        }
        
        return null;
    }

    async updateEnvFile(accessToken) {
        const envPath = path.join(__dirname, '../.env');
        let envContent = fs.readFileSync(envPath, 'utf8');
        
        if (envContent.includes('GHL_ACCESS_TOKEN=')) {
            envContent = envContent.replace(/GHL_ACCESS_TOKEN=.*/, `GHL_ACCESS_TOKEN=${accessToken}`);
        } else {
            envContent += `\nGHL_ACCESS_TOKEN=${accessToken}`;
        }
        
        fs.writeFileSync(envPath, envContent);
    }
}

// CLI interface - only run if this file is executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                    process.argv[1]?.endsWith('ghlOAuthExchange.js');

if (isMainModule) {
    const args = process.argv.slice(2);
    const command = args[0];

    if (!command) {
        console.log('Usage:');
        console.log('  node ghlOAuthExchange.js auth-url');
        console.log('  node ghlOAuthExchange.js exchange <authorization_code>');
        console.log('  node ghlOAuthExchange.js refresh');
        process.exit(1);
    }

    const oauth = new GHLOAuthExchange();

    switch (command) {
        case 'auth-url':
            oauth.generateAuthUrl();
            break;

        case 'exchange':
            if (!args[1]) {
                console.error('Authorization code required');
                process.exit(1);
            }
            
            oauth.exchangeCodeForTokens(args[1])
                .then(tokens => {
                    console.log('✅ Tokens retrieved and saved successfully!');
                    console.log('Access Token:', tokens.access_token.substring(0, 20) + '...');
                    console.log('Expires At:', tokens.expires_at);
                })
                .catch(console.error);
            break;

        case 'refresh':
            oauth.loadSavedTokens()
                .then(savedTokens => {
                    if (!savedTokens?.refresh_token) {
                        throw new Error('No refresh token found');
                    }
                    return oauth.refreshAccessToken();
                })
                .then(tokens => {
                    console.log('✅ Tokens refreshed successfully!');
                    console.log('New Access Token:', tokens.access_token.substring(0, 20) + '...');
                    console.log('Expires At:', tokens.expires_at);
                })
                .catch(console.error);
            break;

        default:
            console.error('Unknown command:', command);
            process.exit(1);
    }
} 