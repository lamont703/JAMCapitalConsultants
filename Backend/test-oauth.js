import dotenv from 'dotenv';
dotenv.config();

console.log('=== Environment Variables Check ===');
console.log('GHL_CLIENT_ID:', process.env.GHL_CLIENT_ID || 'MISSING');
console.log('GHL_CLIENT_SECRET:', process.env.GHL_CLIENT_SECRET || 'MISSING');
console.log('GHL_REDIRECT_URI:', process.env.GHL_REDIRECT_URI || 'MISSING');

if (process.env.GHL_CLIENT_ID && process.env.GHL_CLIENT_SECRET && process.env.GHL_REDIRECT_URI) {
    const baseUrl = 'https://marketplace.leadconnectorhq.com/oauth/chooselocation';
    const params = new URLSearchParams({
        response_type: 'code',
        redirect_uri: process.env.GHL_REDIRECT_URI,
        client_id: process.env.GHL_CLIENT_ID,
        scope: 'contacts.write contacts.read locations.read'
    });
    
    console.log('\n=== Authorization URL ===');
    console.log(`${baseUrl}?${params.toString()}`);
} else {
    console.log('\n❌ Missing OAuth credentials in .env file');
} 