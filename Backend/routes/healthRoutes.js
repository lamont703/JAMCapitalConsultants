import express from 'express';

const router = express.Router();

/**
 * Basic Health Check Endpoint
 * GET /api/health
 */
router.get('/', async (req, res) => {
    try {
        const startTime = Date.now();
        const responseTime = Date.now() - startTime;

        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: process.env.npm_package_version || '1.0.0',
            environment: process.env.NODE_ENV || 'development',
            uptime: process.uptime(),
            responseTime: responseTime,
            services: {
                api: 'healthy',
                server: 'running'
            },
            system: {
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch,
                memoryUsage: process.memoryUsage()
            }
        });

    } catch (error) {
        console.error('Health check error:', error);
        res.status(500).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

/**
 * System Metrics Endpoint
 * GET /api/health/metrics
 */
router.get('/metrics', async (req, res) => {
    try {
        const metrics = {
            timestamp: new Date().toISOString(),
            system: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                cpu: process.cpuUsage(),
                platform: {
                    node: process.version,
                    platform: process.platform,
                    arch: process.arch
                }
            },
            application: {
                environment: process.env.NODE_ENV || 'development',
                version: process.env.npm_package_version || '1.0.0',
                port: process.env.PORT || 3000
            }
        };

        res.json(metrics);

    } catch (error) {
        console.error('Metrics error:', error);
        res.status(500).json({
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GoHighLevel Integration Health Check
 * GET /api/health/ghl
 */
router.get('/ghl', async (req, res) => {
    try {
        const startTime = Date.now();
        
        // Check if GHL service is available
        const ghlService = req.app.locals.ghlService || global.ghlService;
        
        if (!ghlService) {
            return res.status(503).json({
                status: 'unavailable',
                message: 'GHL service not initialized',
                timestamp: new Date().toISOString(),
                responseTime: Date.now() - startTime
            });
        }

        // Check GHL environment variables
        const requiredEnvVars = ['GHL_ACCESS_TOKEN', 'GHL_LOCATION_ID'];
        const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
        
        if (missingVars.length > 0) {
            return res.status(503).json({
                status: 'misconfigured',
                message: `Missing environment variables: ${missingVars.join(', ')}`,
                timestamp: new Date().toISOString(),
                responseTime: Date.now() - startTime
            });
        }

        // If we get here, GHL should be properly configured
        res.json({
            status: 'healthy',
            message: 'GHL service is properly configured',
            timestamp: new Date().toISOString(),
            responseTime: Date.now() - startTime,
            details: {
                serviceInitialized: true,
                environmentConfigured: true,
                locationId: process.env.GHL_LOCATION_ID
            }
        });

    } catch (error) {
        console.error('GHL health check error:', error);
        res.status(500).json({
            status: 'error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

export default router; 