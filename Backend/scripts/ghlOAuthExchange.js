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
            scope: 'contacts.write contacts.read locations.read locations.write users.read users.write opportunities.read opportunities.write calendars.read calendars.write'
        });
        
        const fullUrl = `${baseUrl}?${params.toString()}`;
        console.log('Authorization URL:', fullUrl);
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

    async refreshAccessToken(refreshToken) {
        try {
            const response = await axios.post(this.tokenEndpoint, {
                client_id: this.clientId,
                client_secret: this.clientSecret,
                grant_type: 'refresh_token',
                refresh_token: refreshToken
            }, {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            const tokens = {
                access_token: response.data.access_token,
                refresh_token: response.data.refresh_token || refreshToken,
                expires_in: response.data.expires_in,
                expires_at: new Date(Date.now() + (response.data.expires_in * 1000)).toISOString(),
                token_type: response.data.token_type,
                scope: response.data.scope
            };

            await this.saveTokens(tokens);
            await this.updateEnvFile(tokens.access_token);
            
            return tokens;
        } catch (error) {
            console.error('Token refresh failed:', error.response?.data || error.message);
            throw error;
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
        if (fs.existsSync(tokensPath)) {
            return JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
        }
        return null;
    }

    async updateEnvFile(accessToken) {
        const envPath = path.join(__dirname, '../../.env');
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
if (import.meta.url === `file://${process.argv[1]}`) {
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
                    return oauth.refreshAccessToken(savedTokens.refresh_token);
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