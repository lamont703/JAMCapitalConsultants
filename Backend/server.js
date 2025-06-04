// server.js
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { CosmosService } from './services/cosmosService.js';
import authRoutes from './routes/authRoutes.js';
import { GoHighLevelService } from './services/ghlService.js';
import ghlRoutes from './routes/ghlRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import userRoutes from './routes/userRoutes.js';
// Import routes
import chatRoutesModule from './routes/chatRoutes.js';  // Changed to default import
import adminRoutes from './routes/adminRoutes.js';
import AzureBlobService from './services/azureBlobService.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Create chunks directory if it doesn't exist
const chunksDir = path.join(__dirname, 'chunks');
if (!fs.existsSync(chunksDir)) {
  fs.mkdirSync(chunksDir, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../Frontend')));

// Use routes
app.use('/api/chat', chatRoutesModule);
app.use('/api/chatGptService', chatRoutesModule);
app.use('/api/auth', authRoutes);
app.use('/api/ghl', ghlRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);

// Serve the frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../Development Files'));
});

let cosmosService;
let ghlService;
let azureBlobService;

// Initialize CosmosDB on startup
async function initializeApp() {
    try {
        console.log('🚀 Starting JAM Capital server initialization...\n');

        // Initialize core services first
        console.log('📦 Initializing core services...');
        
        // Azure Blob Storage
        try {
            azureBlobService = new AzureBlobService();
            await azureBlobService.initialize();
            console.log('✅ Azure Blob Storage initialized');
        } catch (error) {
            console.log(`❌ Azure Blob Storage failed: ${error.message}`);
            throw error; // This is critical, so we should fail
        }

        // GoHighLevel (non-critical)
        try {
            ghlService = new GoHighLevelService();
            const ghlInitialized = await ghlService.initialize();
            if (!ghlInitialized) {
                console.log('ℹ️  Server will run without GHL integration');
            }
        } catch (error) {
            console.log('ℹ️  Server will run without GHL integration');
        }

        // CosmosDB (CRITICAL - currently missing!)
        try {
            cosmosService = new CosmosService();
            await cosmosService.initialize();
            
            // Make it available to all routes
            app.locals.cosmosService = cosmosService;
            
            console.log('✅ CosmosDB service initialized');
        } catch (error) {
            console.log(`❌ CosmosDB failed: ${error.message}`);
            throw error; // This is critical, so we should fail
        }

        console.log('\n✅ Server initialization completed');
        
    } catch (error) {
        console.error('❌ Critical server initialization failed:', error.message);
        throw error;
    }
}

// Start server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await initializeApp();
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Global error handler:', error);
    res.status(500).json({
        success: false,
        message: 'Internal server error'
    });
});