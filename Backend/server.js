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
import credentialsRoutes from './routes/credentialsRoutes.js';
import subscriptionRoutes from './routes/subscriptionRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';
import disputeRoutes from './routes/disputeRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
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
        console.log('🔍 CORS: Request from origin:', origin);
        
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) {
            console.log('✅ CORS: Allowing request with no origin');
            return callback(null, true);
        }

        const allowedOrigins = process.env.CORS_ORIGIN 
            ? process.env.CORS_ORIGIN.split(',').map(url => url.trim())
            : [
                'http://localhost:3000', 
                'http://localhost:8080',
                'https://jamcapitalconsultants.com',
                'https://www.jamcapitalconsultants.com',
                'https://jam-capital-backend.azurewebsites.net'
            ];

        console.log('🔍 CORS: Allowed origins:', allowedOrigins);
        console.log('🔍 CORS: Checking if origin allowed:', allowedOrigins.includes(origin));

        if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
            console.log('✅ CORS: Origin allowed');
            callback(null, true);
        } else {
            console.log('❌ CORS: Origin blocked');
            callback(new Error(`Not allowed by CORS: ${origin}`));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH'],
    allowedHeaders: [
        'Accept',
        'Accept-Language',
        'Authorization', 
        'Content-Type', 
        'Content-Language',
        'X-Requested-With', 
        'X-User-Email', 
        'X-User-ID',
        'Origin',
        'Access-Control-Request-Method',
        'Access-Control-Request-Headers'
    ],
    exposedHeaders: [
        'Access-Control-Allow-Origin',
        'Access-Control-Allow-Credentials'
    ],
    preflightContinue: false
};

app.use(cors(corsOptions));

// Comprehensive preflight handling for ALL credential endpoints
app.options('/api/credentials/*', (req, res) => {
    console.log('🔍 CORS Preflight for credentials:', req.method, req.url, 'Origin:', req.headers.origin);
    
    // Set all necessary CORS headers for preflight
    res.header('Access-Control-Allow-Origin', req.headers.origin || 'https://jamcapitalconsultants.com');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Access-Control-Request-Method, Access-Control-Request-Headers');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400'); // 24 hours
    
    // Send successful preflight response
    res.status(200).end();
});

// Specific middleware for credential monitoring endpoints
app.use('/api/credentials/monitoring', (req, res, next) => {
    console.log('🔍 CORS Middleware for monitoring:', req.method, req.url, 'Origin:', req.headers.origin);
    
    // Ensure CORS headers are always set for credential monitoring endpoints
    const origin = req.headers.origin;
    const allowedOrigin = ['https://jamcapitalconsultants.com', 'https://www.jamcapitalconsultants.com', 'http://localhost:3000'].includes(origin) ? origin : 'https://jamcapitalconsultants.com';
    
    res.header('Access-Control-Allow-Origin', allowedOrigin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Access-Control-Request-Method, Access-Control-Request-Headers');
    
    next();
});

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

// Serve the system health monitoring dashboard
app.get('/system-health', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'system-health-check.html'));
});

// API Routes - IMPORTANT: More specific routes must come before general routes
app.use('/api/chat', chatRoutesModule);
app.use('/api/chatGptService', chatRoutesModule);
app.use('/api/auth', authRoutes);
app.use('/api/ghl', ghlRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);
// Mount credential monitoring routes BEFORE general credential routes
app.use('/api/credentials/monitoring', credentialsRoutes);
app.use('/api/credentials', credentialRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/dispute', disputeRoutes);
app.use('/api/health', healthRoutes);

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

// GHL Service Diagnostic Endpoint
app.get('/api/debug/ghl-status', (req, res) => {
    res.json({
        timestamp: new Date().toISOString(),
        ghlServiceStatus: {
            globalVariable: {
                exists: !!global.ghlService,
                type: typeof global.ghlService,
                hasInitialize: global.ghlService && typeof global.ghlService.initialize === 'function',
                hasCreateContact: global.ghlService && typeof global.ghlService.createContact === 'function'
            },
            appLocals: {
                exists: !!req.app.locals.ghlService,
                type: typeof req.app.locals.ghlService,
                hasInitialize: req.app.locals.ghlService && typeof req.app.locals.ghlService.initialize === 'function',
                hasCreateContact: req.app.locals.ghlService && typeof req.app.locals.ghlService.createContact === 'function'
            },
            appLocalsKeys: Object.keys(req.app.locals),
            comparison: {
                sameInstance: global.ghlService === req.app.locals.ghlService,
                bothExist: !!global.ghlService && !!req.app.locals.ghlService,
                neitherExists: !global.ghlService && !req.app.locals.ghlService
            }
        }
    });
});

// Specific User Lookup Test Endpoint
app.get('/api/debug/user-lookup/:email', async (req, res) => {
    try {
        const email = req.params.email;
        const cosmosService = req.app.locals.cosmosService;
        
        if (!cosmosService) {
            return res.json({
                status: 'error',
                message: 'CosmosService not available in app.locals',
                timestamp: new Date().toISOString()
            });
        }

        console.log('🔍 [DEBUG] User lookup test for:', email);
        
        // Test basic connection
        await cosmosService.initialize();
        console.log('✅ [DEBUG] CosmosService initialized');
        
        // Test user query with detailed logging (same as getSecurityQuestion)
        console.log('🔍 [DEBUG] Calling getUserByEmail with lowercase trim...');
        const emailParam = email.toLowerCase().trim();
        console.log('🔍 [DEBUG] Email parameter:', emailParam);
        const testUser = await cosmosService.getUserByEmail(emailParam);
        console.log('🔍 [DEBUG] getUserByEmail result:', !!testUser);
        
        // Also test the direct queryDocuments method
        console.log('🔍 [DEBUG] Testing direct queryDocuments...');
        const directResults = await cosmosService.queryDocuments(
            "SELECT * FROM c WHERE c.email = @email AND c.type = @type",
            [
                { name: '@email', value: emailParam },
                { name: '@type', value: 'user' }
            ]
        );
        console.log('🔍 [DEBUG] Direct queryDocuments result:', directResults.length, 'users found');
        
        if (testUser) {
            console.log('✅ [DEBUG] User found:', testUser.email, 'securityQuestion:', testUser.securityQuestion);
        } else {
            console.log('❌ [DEBUG] User not found via getUserByEmail');
            
            // Try direct query as backup
            console.log('🔍 [DEBUG] Trying direct container query...');
            const directQuery = await cosmosService.queryDocuments(
                "SELECT * FROM c WHERE c.email = @email AND c.type = @type",
                [
                    { name: '@email', value: email.toLowerCase().trim() },
                    { name: '@type', value: 'user' }
                ]
            );
            console.log('🔍 [DEBUG] Direct query result:', directQuery.length, 'users found');
        }
        
        res.json({
            status: 'success',
            timestamp: new Date().toISOString(),
            email: email,
            userFound: !!testUser,
            userHasSecurityQuestion: !!(testUser && testUser.securityQuestion),
            securityQuestion: testUser?.securityQuestion || null,
            cosmosServiceInitialized: cosmosService.isInitialized
        });
        
    } catch (error) {
        console.error('❌ [DEBUG] User lookup error:', error);
        res.status(500).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            error: error.message,
            stack: error.stack?.split('\n').slice(0, 5)
        });
    }
});

// Database Connection Test Endpoint
app.get('/api/debug/db-test', async (req, res) => {
    try {
        const cosmosService = req.app.locals.cosmosService;
        
        if (!cosmosService) {
            return res.json({
                status: 'error',
                message: 'CosmosService not available in app.locals',
                timestamp: new Date().toISOString()
            });
        }

        // Test basic connection
        await cosmosService.initialize();
        
        // Test user query
        const testUser = await cosmosService.getUserByEmail('lamont703@gmail.com');
        
        res.json({
            status: 'success',
            timestamp: new Date().toISOString(),
            cosmosService: {
                available: true,
                initialized: cosmosService.isInitialized
            },
            testQuery: {
                email: 'lamont703@gmail.com',
                found: !!testUser,
                userType: testUser?.type || 'N/A',
                userRole: testUser?.role || 'N/A'
            }
        });
        
    } catch (error) {
        res.status(500).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            error: error.message,
            stack: error.stack?.split('\n').slice(0, 5)
        });
    }
});

// Environment Variables Diagnostic Endpoint (Safe)
app.get('/api/debug/env-check', (req, res) => {
    const ghlEnvVars = {
        GHL_CLIENT_ID: {
            exists: !!process.env.GHL_CLIENT_ID,
            length: process.env.GHL_CLIENT_ID ? process.env.GHL_CLIENT_ID.length : 0,
            prefix: process.env.GHL_CLIENT_ID ? process.env.GHL_CLIENT_ID.substring(0, 8) + '...' : 'NOT SET'
        },
        GHL_CLIENT_SECRET: {
            exists: !!process.env.GHL_CLIENT_SECRET,
            length: process.env.GHL_CLIENT_SECRET ? process.env.GHL_CLIENT_SECRET.length : 0,
            prefix: process.env.GHL_CLIENT_SECRET ? process.env.GHL_CLIENT_SECRET.substring(0, 8) + '...' : 'NOT SET'
        },
        GHL_ACCESS_TOKEN: {
            exists: !!process.env.GHL_ACCESS_TOKEN,
            length: process.env.GHL_ACCESS_TOKEN ? process.env.GHL_ACCESS_TOKEN.length : 0,
            prefix: process.env.GHL_ACCESS_TOKEN ? process.env.GHL_ACCESS_TOKEN.substring(0, 20) + '...' : 'NOT SET'
        },
        GHL_REFRESH_TOKEN: {
            exists: !!process.env.GHL_REFRESH_TOKEN,
            length: process.env.GHL_REFRESH_TOKEN ? process.env.GHL_REFRESH_TOKEN.length : 0,
            prefix: process.env.GHL_REFRESH_TOKEN ? process.env.GHL_REFRESH_TOKEN.substring(0, 20) + '...' : 'NOT SET'
        },
        GHL_LOCATION_ID: {
            exists: !!process.env.GHL_LOCATION_ID,
            value: process.env.GHL_LOCATION_ID || 'NOT SET'
        }
    };

    res.json({
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        ghlEnvironmentVariables: ghlEnvVars,
        summary: {
            allGhlVarsPresent: Object.values(ghlEnvVars).every(v => v.exists),
            missingVars: Object.entries(ghlEnvVars).filter(([key, val]) => !val.exists).map(([key]) => key)
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
            console.log('🔍 GHL initialization result:', ghlInitialized);
            
            if (ghlInitialized) {
                console.log('✅ GoHighLevel service initialized successfully');
                app.locals.ghlService = ghlService;
                global.ghlService = ghlService; // Also make it available globally
                console.log('✅ GHL service set on app.locals and global');
            } else {
                console.log('❌ GoHighLevel service initialization returned false');
                console.log('🔍 This means GHL service is not configured properly');
                app.locals.ghlService = null;
                global.ghlService = null;
            }
        } catch (error) {
            console.error('❌ GHL service initialization threw exception:', error.message);
            console.error('❌ Full GHL error:', error);
            console.log('ℹ️  Server will run without GHL integration');
            app.locals.ghlService = null;
            global.ghlService = null;
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