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
import credentialRoutes from './routes/credentialRoutes.js';
import subscriptionRoutes from './routes/subscriptionRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';
import disputeRoutes from './routes/disputeRoutes.js';
// Import routes
import chatRoutesModule from './routes/chatRoutes.js';  // Changed to default import
import adminRoutes from './routes/adminRoutes.js';
import AzureBlobService from './services/azureBlobService.js';

// Import Azure middleware
import {
    initializeApplicationInsights,
    securityMiddleware,
    compressionMiddleware,
    rateLimitMiddleware,
    slowDownMiddleware,
    azureLoggingMiddleware,
    healthCheckMiddleware,
    azureErrorHandler,
    memoryMonitoringMiddleware
} from './middleware/azureMiddleware.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Application Insights first (before any other middleware)
const appInsightsClient = initializeApplicationInsights();

// Trust proxy for Azure App Service
app.set('trust proxy', 1);

// Create directories only in development (Azure uses Blob Storage)
if (process.env.NODE_ENV !== 'production') {
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
}

// Azure-optimized middleware stack
app.use(healthCheckMiddleware()); // Health check first
app.use(compressionMiddleware()); // Compression for performance
app.use(securityMiddleware()); // Security headers
app.use(azureLoggingMiddleware()); // Azure-specific logging
app.use(memoryMonitoringMiddleware()); // Memory monitoring

// Rate limiting (more restrictive in production)
if (process.env.NODE_ENV === 'production') {
    app.use(rateLimitMiddleware());
    app.use(slowDownMiddleware());
}

// CORS configuration for Azure
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        const allowedOrigins = process.env.CORS_ORIGIN 
            ? process.env.CORS_ORIGIN.split(',')
            : ['http://localhost:3000', 'http://localhost:8080'];

        if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-User-Email', 'X-User-ID']
};

app.use(cors(corsOptions));

// Body parsing middleware with size limits
app.use(express.json({ 
    limit: process.env.MAX_FILE_SIZE || '10mb',
    verify: (req, res, buf) => {
        // Store raw body for webhook verification if needed
        req.rawBody = buf;
    }
}));
app.use(express.urlencoded({ 
    extended: true, 
    limit: process.env.MAX_FILE_SIZE || '10mb' 
}));

// Static file serving (only in development)
if (process.env.NODE_ENV !== 'production') {
    app.use(express.static(path.join(__dirname, '../Frontend')));
}

// API Routes
app.use('/api/chat', chatRoutesModule);
app.use('/api/chatGptService', chatRoutesModule);
app.use('/api/auth', authRoutes);
app.use('/api/ghl', ghlRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);
app.use('/api/credentials', credentialRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/dispute', disputeRoutes);

// Additional health check endpoints
app.get('/api/health/detailed', (req, res) => {
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: `${Math.floor(uptime / 60)} minutes`,
        environment: process.env.NODE_ENV,
        version: process.env.npm_package_version || '1.0.0',
        memory: {
            rss: `${Math.round(memUsage.rss / 1024 / 1024)} MB`,
            heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`,
            heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)} MB`,
            external: `${Math.round(memUsage.external / 1024 / 1024)} MB`
        },
        azure: {
            region: process.env.REGION_NAME || 'unknown',
            instance: process.env.WEBSITE_INSTANCE_ID || 'local',
            siteName: process.env.WEBSITE_SITE_NAME || 'local'
        },
        services: {
            cosmos: cosmosService ? 'connected' : 'disconnected',
            ghl: ghlService ? 'connected' : 'disconnected',
            azureBlob: azureBlobService ? 'connected' : 'disconnected',
            applicationInsights: appInsightsClient ? 'connected' : 'disconnected'
        }
    });
});

// Liveness probe for Azure
app.get('/api/health/live', (req, res) => {
    res.status(200).send('OK');
});

// Readiness probe for Azure
app.get('/api/health/ready', async (req, res) => {
    try {
        // Check if critical services are ready
        if (cosmosService && await cosmosService.initialize()) {
            res.status(200).json({ status: 'ready' });
        } else {
            res.status(503).json({ status: 'not ready', reason: 'Database not available' });
        }
    } catch (error) {
        res.status(503).json({ status: 'not ready', reason: error.message });
    }
});

// Serve frontend only in development
if (process.env.NODE_ENV !== 'production') {
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../Development Files'));
    });
}

// Global variables for services
let cosmosService;
let ghlService;
let azureBlobService;

// Enhanced initialization with better error handling
async function initializeApp() {
    try {
        console.log('🚀 Starting JAM Capital server initialization...\n');
        console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
        console.log(`📍 Region: ${process.env.REGION_NAME || 'local'}`);
        console.log(`🏷️  Instance: ${process.env.WEBSITE_INSTANCE_ID || 'local'}\n`);

        // Initialize core services with timeout and retry logic
        console.log('📦 Initializing core services...');
        
        // Azure Blob Storage (critical for file uploads)
        try {
            console.log('🔄 Initializing Azure Blob Storage...');
            azureBlobService = new AzureBlobService();
            await azureBlobService.initialize();
            console.log('✅ Azure Blob Storage initialized');
            
            // Make it available globally
            app.locals.azureBlobService = azureBlobService;
        } catch (error) {
            console.error(`❌ Azure Blob Storage failed: ${error.message}`);
            if (process.env.NODE_ENV === 'production') {
                throw error; // This is critical in production
            }
            console.log('⚠️  Continuing without Azure Blob Storage in development mode');
        }

        // CosmosDB (CRITICAL)
        try {
            console.log('🔄 Initializing CosmosDB...');
            cosmosService = new CosmosService();
            await cosmosService.initialize();
            
            // Make it available to all routes
            app.locals.cosmosService = cosmosService;
            
            console.log('✅ CosmosDB service initialized');
        } catch (error) {
            console.error(`❌ CosmosDB failed: ${error.message}`);
            if (process.env.NODE_ENV === 'production') {
                throw error; // This is critical in production
            }
            console.log('⚠️  Continuing without CosmosDB in development mode');
        }

        // GoHighLevel (non-critical)
        try {
            console.log('🔄 Initializing GoHighLevel service...');
            ghlService = new GoHighLevelService();
            const ghlInitialized = await ghlService.initialize();
            if (ghlInitialized) {
                console.log('✅ GoHighLevel service initialized');
                app.locals.ghlService = ghlService;
            } else {
                console.log('ℹ️  GoHighLevel service not configured');
            }
        } catch (error) {
            console.log('ℹ️  Server will run without GHL integration:', error.message);
        }

        // Track successful initialization
        if (appInsightsClient) {
            appInsightsClient.trackEvent({
                name: 'ServerInitialized',
                properties: {
                    environment: process.env.NODE_ENV,
                    region: process.env.REGION_NAME,
                    version: process.env.npm_package_version || '1.0.0'
                }
            });
        }

        console.log('\n✅ Server initialization completed successfully');
        
    } catch (error) {
        console.error('❌ Critical server initialization failed:', error.message);
        
        // Track initialization failure
        if (appInsightsClient) {
            appInsightsClient.trackException({
                exception: error,
                properties: {
                    phase: 'initialization',
                    environment: process.env.NODE_ENV
                }
            });
        }
        
        // In production, exit the process to trigger a restart
        if (process.env.NODE_ENV === 'production') {
            console.error('🔥 Exiting process due to critical initialization failure');
            process.exit(1);
        }
        
        throw error;
    }
}

// Enhanced error handling middleware (must be after routes)
app.use(azureErrorHandler());

// Graceful shutdown handling
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully');
    
    if (appInsightsClient) {
        appInsightsClient.trackEvent({
            name: 'ServerShutdown',
            properties: {
                reason: 'SIGTERM',
                uptime: process.uptime()
            }
        });
        
        // Flush Application Insights before exit
        appInsightsClient.flush();
    }
    
    // Close server gracefully
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully');
    
    if (appInsightsClient) {
        appInsightsClient.trackEvent({
            name: 'ServerShutdown',
            properties: {
                reason: 'SIGINT',
                uptime: process.uptime()
            }
        });
        
        appInsightsClient.flush();
    }
    
    process.exit(0);
});

// Unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Promise Rejection:', reason);
    
    if (appInsightsClient) {
        appInsightsClient.trackException({
            exception: new Error('Unhandled Promise Rejection'),
            properties: {
                reason: reason.toString(),
                promise: promise.toString()
            }
        });
    }
});

// Start server with enhanced logging
app.listen(PORT, async () => {
    console.log(`🚀 JAM Capital Backend Server started on port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
    console.log(`📍 Health check available at: http://localhost:${PORT}/api/health`);
    
    if (process.env.NODE_ENV === 'production') {
        console.log(`🌐 Azure App Service URL: https://${process.env.WEBSITE_SITE_NAME}.azurewebsites.net`);
    }
    
    // Initialize application services
    try {
        await initializeApp();
        console.log('🎉 Server ready to accept requests');
    } catch (error) {
        console.error('❌ Server initialization failed:', error.message);
        if (process.env.NODE_ENV === 'production') {
            process.exit(1);
        }
    }
});