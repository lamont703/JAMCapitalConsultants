import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class GHLOAuthExchange {
    constructor() {
        console.log('Initializing GHLOAuthExchange...');
        
        this.clientId = process.env.GHL_CLIENT_ID;
        this.clientSecret = process.env.GHL_CLIENT_SECRET;
        this.redirectUri = process.env.GHL_REDIRECT_URI;
        this.tokenEndpoint = 'https://services.leadconnectorhq.com/oauth/token';
        
        console.log('Environment check:');
        console.log('- Client ID:', this.clientId ? 'SET' : 'MISSING');
        console.log('- Client Secret:', this.clientSecret ? 'SET' : 'MISSING');
        console.log('- Redirect URI:', this.redirectUri ? 'SET' : 'MISSING');
        
        if (!this.clientId || !this.clientSecret || !this.redirectUri) {
            throw new Error('Missing required OAuth credentials in .env file');
        }
    }

    async exchangeCodeForTokens(authorizationCode) {
        try {
            console.log('Exchanging authorization code for tokens...');
            
            const response = await axios.post(this.tokenEndpoint, {
                client_id: this.clientId,
                client_secret: this.clientSecret,
                grant_type: 'authorization_code',
                code: authorizationCode,
                redirect_uri: this.redirectUri
            }, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            const tokens = response.data;
            console.log('Token exchange successful!');
            
            // Add expiration timestamp
            const expirationTime = new Date(Date.now() + (tokens.expires_in * 1000));
            tokens.expires_at = expirationTime.toISOString();
            
            // Save tokens to file
            await this.saveTokens(tokens);
            
            return tokens;
            
        } catch (error) {
            console.error('Token exchange failed:', error.response?.data || error.message);
            throw error;
        }
    }

    async refreshAccessToken(refreshToken) {
        try {
            console.log('Refreshing access token...');
            
            const response = await axios.post(this.tokenEndpoint, {
                client_id: this.clientId,
                client_secret: this.clientSecret,
                grant_type: 'refresh_token',
                refresh_token: refreshToken
            }, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            const tokens = response.data;
            console.log('Token refresh successful!');
            
            // Add expiration timestamp
            const expirationTime = new Date(Date.now() + (tokens.expires_in * 1000));
            tokens.expires_at = expirationTime.toISOString();
            
            // Save updated tokens
            await this.saveTokens(tokens);
            
            return tokens;
            
        } catch (error) {
            console.error('Token refresh failed:', error.response?.data || error.message);
            throw error;
        }
    }

    async saveTokens(tokens) {
        const tokensPath = path.join(__dirname, '../config/ghl-tokens.json');
        
        const tokenData = {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_in: tokens.expires_in,
            expires_at: tokens.expires_at,
            token_type: tokens.token_type || 'Bearer',
            created_at: new Date().toISOString()
        };

        try {
            await fs.promises.writeFile(tokensPath, JSON.stringify(tokenData, null, 2));
            console.log(`Tokens saved to: ${tokensPath}`);
            
            // Also update .env file with access token
            await this.updateEnvFile(tokens.access_token);
            
        } catch (error) {
            console.error('Error saving tokens:', error);
            throw error;
        }
    }

    async updateEnvFile(accessToken) {
        const envPath = path.join(__dirname, '../.env');
        
        try {
            let envContent = await fs.promises.readFile(envPath, 'utf8');
            
            // Update or add GHL_API_KEY
            if (envContent.includes('GHL_API_KEY=')) {
                envContent = envContent.replace(/GHL_API_KEY=.*/, `GHL_API_KEY=${accessToken}`);
            } else {
                envContent += `\nGHL_API_KEY=${accessToken}`;
            }
            
            await fs.promises.writeFile(envPath, envContent);
            console.log('.env file updated with new access token');
            
        } catch (error) {
            console.error('Error updating .env file:', error);
        }
    }

    async loadSavedTokens() {
        const tokensPath = path.join(__dirname, '../config/ghl-tokens.json');
        
        try {
            const tokenData = await fs.promises.readFile(tokensPath, 'utf8');
            return JSON.parse(tokenData);
        } catch (error) {
            console.log('No saved tokens found');
            return null;
        }
    }

    isTokenExpired(tokens) {
        if (!tokens.expires_at) return true;
        return new Date() >= new Date(tokens.expires_at);
    }

    generateAuthUrl() {
        console.log('Generating authorization URL...');
        const baseUrl = 'https://marketplace.leadconnectorhq.com/oauth/chooselocation';
        const params = new URLSearchParams({
            response_type: 'code',
            redirect_uri: this.redirectUri,
            client_id: this.clientId,
            scope: 'contacts.write contacts.read locations.read locations.write users.read users.write opportunities.read opportunities.write calendars.read calendars.write'
        });
        
        const fullUrl = `${baseUrl}?${params.toString()}`;
        console.log('Generated URL:', fullUrl);
        return fullUrl;
    }
}

// CLI Interface
async function main() {
    console.log('Script started with args:', process.argv.slice(2));
    
    try {
        const oauth = new GHLOAuthExchange();
        const args = process.argv.slice(2);
        
        if (args.length === 0) {
            console.log('\n=== GoHighLevel OAuth Token Exchange ===\n');
            console.log('Usage:');
            console.log('  node ghlOAuthExchange.js auth-url          - Generate authorization URL');
            console.log('  node ghlOAuthExchange.js exchange <code>   - Exchange authorization code for tokens');
            console.log('  node ghlOAuthExchange.js refresh           - Refresh existing tokens');
            console.log('  node ghlOAuthExchange.js status            - Check token status');
            return;
        }

        const command = args[0];
        console.log('Executing command:', command);

        switch (command) {
            case 'auth-url':
                console.log('Processing auth-url command...');
                const authUrl = oauth.generateAuthUrl();
                console.log('\n=== Authorization URL ===');
                console.log('Visit this URL to authorize your application:');
                console.log(authUrl);
                console.log('\nAfter authorization, you\'ll be redirected with a code parameter.');
                console.log('Use that code with: node ghlOAuthExchange.js exchange <code>');
                break;

            case 'exchange':
                if (!args[1]) {
                    console.error('Error: Authorization code required');
                    console.log('Usage: node ghlOAuthExchange.js exchange <authorization_code>');
                    return;
                }
                
                const tokens = await oauth.exchangeCodeForTokens(args[1]);
                console.log('\n=== Tokens Retrieved ===');
                console.log('Access Token:', tokens.access_token.substring(0, 20) + '...');
                console.log('Expires At:', tokens.expires_at);
                console.log('Tokens saved and .env updated!');
                break;

            case 'refresh':
                const savedTokens = await oauth.loadSavedTokens();
                if (!savedTokens || !savedTokens.refresh_token) {
                    console.error('No refresh token found. Please run authorization flow first.');
                    return;
                }
                
                const refreshedTokens = await oauth.refreshAccessToken(savedTokens.refresh_token);
                console.log('\n=== Tokens Refreshed ===');
                console.log('New Access Token:', refreshedTokens.access_token.substring(0, 20) + '...');
                console.log('Expires At:', refreshedTokens.expires_at);
                break;

            case 'status':
                const currentTokens = await oauth.loadSavedTokens();
                if (!currentTokens) {
                    console.log('No tokens found. Run authorization flow first.');
                    return;
                }
                
                console.log('\n=== Token Status ===');
                console.log('Access Token:', currentTokens.access_token.substring(0, 20) + '...');
                console.log('Created At:', currentTokens.created_at);
                console.log('Expires At:', currentTokens.expires_at);
                console.log('Is Expired:', oauth.isTokenExpired(currentTokens));
                
                if (oauth.isTokenExpired(currentTokens)) {
                    console.log('\n⚠️  Token is expired. Run: node ghlOAuthExchange.js refresh');
                } else {
                    console.log('\n✅ Token is valid');
                }
                break;

            default:
                console.error('Unknown command:', command);
        }

    } catch (error) {
        console.error('Script error:', error.message);
        console.error('Full error:', error);
        process.exit(1);
    }
}

// Run if called directly
console.log('Checking if script should run...');
console.log('import.meta.url:', import.meta.url);
console.log('process.argv[1]:', process.argv[1]);

// Fix the URL comparison by decoding the URL
const scriptPath = decodeURIComponent(import.meta.url);
const argvPath = `file://${process.argv[1]}`;

console.log('Decoded script path:', scriptPath);
console.log('Argv file path:', argvPath);

if (scriptPath === argvPath) {
    console.log('Running main function...');
    main();
} else {
    console.log('Script imported, not running main');
}

export { GHLOAuthExchange }; 