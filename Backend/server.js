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

// Initialize CosmosDB on startup
async function initializeApp() {
    try {
        cosmosService = new CosmosService();
        await cosmosService.initialize();
        console.log('CosmosDB initialized successfully');
        
        // Make cosmosService available globally
        app.locals.cosmosService = cosmosService;
        
        // Try to initialize GoHighLevel service
        try {
            console.log('🔄 Initializing GHL Service...');
            const ghlService = new GoHighLevelService();
            await ghlService.initialize();
            console.log('GoHighLevel initialized successfully');
            
            // Make GHL service available both ways
            app.locals.ghlService = ghlService;
            global.ghlService = ghlService;
            
        } catch (ghlError) {
            console.warn('GoHighLevel initialization failed (continuing without GHL):', ghlError.message);
            app.locals.ghlService = null;
            global.ghlService = null;
        }
        
        // Initialize Azure Blob Storage
        const azureBlobService = new AzureBlobService();
        await azureBlobService.initialize();
        app.locals.azureBlobService = azureBlobService;
        console.log('✅ Azure Blob Storage service initialized');
        
    } catch (error) {
        console.error('Failed to initialize core services:', error);
        process.exit(1);
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