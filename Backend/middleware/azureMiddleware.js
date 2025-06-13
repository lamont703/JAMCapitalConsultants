import appInsights from 'applicationinsights';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';

// Initialize Application Insights
export function initializeApplicationInsights() {
    const instrumentationKey = process.env.APPINSIGHTS_INSTRUMENTATIONKEY;
    const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
    
    if (instrumentationKey || connectionString) {
        console.log('🔍 Initializing Azure Application Insights...');
        
        // Configure Application Insights
        appInsights.setup(connectionString || instrumentationKey)
            .setAutoDependencyCorrelation(true)
            .setAutoCollectRequests(true)
            .setAutoCollectPerformance(true, true)
            .setAutoCollectExceptions(true)
            .setAutoCollectDependencies(true)
            .setAutoCollectConsole(true)
            .setUseDiskRetryCaching(true)
            .setSendLiveMetrics(true)
            .setInternalLogging(false, true);

        // Set cloud role name for better tracking
        appInsights.defaultClient.context.tags[appInsights.defaultClient.context.keys.cloudRole] = 'jam-capital-backend';
        
        appInsights.start();
        console.log('✅ Application Insights initialized');
        return appInsights.defaultClient;
    } else {
        console.log('⚠️  Application Insights not configured - missing APPINSIGHTS_INSTRUMENTATIONKEY or APPLICATIONINSIGHTS_CONNECTION_STRING');
        return null;
    }
}

// Security middleware using Helmet
export function securityMiddleware() {
    return helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
                fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
                scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
                imgSrc: ["'self'", "data:", "https:", "blob:"],
                connectSrc: ["'self'", "https://api.openai.com", "wss:", "https:"],
                mediaSrc: ["'self'"],
                objectSrc: ["'none'"],
                baseUri: ["'self'"],
                formAction: ["'self'"],
                frameAncestors: ["'none'"],
                upgradeInsecureRequests: [],
            },
        },
        hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true
        },
        noSniff: true,
        xssFilter: true,
        referrerPolicy: { policy: "same-origin" }
    });
}

// Compression middleware for better performance
export function compressionMiddleware() {
    return compression({
        filter: (req, res) => {
            // Don't compress responses if this request has a 'x-no-compression' header
            if (req.headers['x-no-compression']) {
                return false;
            }
            
            // Use compression filter function
            return compression.filter(req, res);
        },
        level: 6, // Compression level (1-9)
        threshold: 1024, // Only compress responses larger than 1KB
    });
}

// Rate limiting middleware
export function rateLimitMiddleware() {
    return rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: process.env.NODE_ENV === 'production' ? 100 : 1000, // Limit each IP to 100 requests per windowMs in production
        message: {
            error: 'Too many requests from this IP, please try again later.',
            retryAfter: '15 minutes'
        },
        standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
        legacyHeaders: false, // Disable the `X-RateLimit-*` headers
        skip: (req) => {
            // Skip rate limiting for health checks
            return req.path === '/api/health' || req.path === '/health';
        }
    });
}

// Slow down middleware for additional protection
export function slowDownMiddleware() {
    return slowDown({
        windowMs: 15 * 60 * 1000, // 15 minutes
        delayAfter: 50, // Allow 50 requests per windowMs without delay
        delayMs: 500, // Add 500ms delay per request after delayAfter
        maxDelayMs: 20000, // Maximum delay of 20 seconds
        skip: (req) => {
            // Skip slow down for health checks
            return req.path === '/api/health' || req.path === '/health';
        }
    });
}

// Custom Azure logging middleware
export function azureLoggingMiddleware() {
    return (req, res, next) => {
        const start = Date.now();
        
        // Track request start
        if (appInsights.defaultClient) {
            appInsights.defaultClient.trackRequest({
                name: `${req.method} ${req.path}`,
                url: req.url,
                duration: 0, // Will be updated in response handler
                resultCode: 0, // Will be updated in response handler
                success: true, // Will be updated in response handler
                properties: {
                    userAgent: req.get('User-Agent'),
                    ip: req.ip,
                    method: req.method,
                    path: req.path,
                    query: JSON.stringify(req.query)
                }
            });
        }

        // Override res.end to capture response metrics
        const originalEnd = res.end;
        res.end = function(chunk, encoding) {
            const duration = Date.now() - start;
            
            // Track metrics with Application Insights
            if (appInsights.defaultClient) {
                appInsights.defaultClient.trackMetric({
                    name: 'HTTP Request Duration',
                    value: duration,
                    properties: {
                        method: req.method,
                        path: req.path,
                        statusCode: res.statusCode.toString()
                    }
                });

                appInsights.defaultClient.trackMetric({
                    name: 'HTTP Request Count',
                    value: 1,
                    properties: {
                        method: req.method,
                        path: req.path,
                        statusCode: res.statusCode.toString()
                    }
                });
            }

            // Log to console for debugging
            console.log(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
            
            originalEnd.call(this, chunk, encoding);
        };

        next();
    };
}

// Health check middleware
export function healthCheckMiddleware() {
    return (req, res, next) => {
        if (req.path === '/api/health' || req.path === '/health') {
            res.status(200).json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                environment: process.env.NODE_ENV,
                version: process.env.npm_package_version || '1.0.0',
                azure: {
                    region: process.env.REGION_NAME || 'unknown',
                    instance: process.env.WEBSITE_INSTANCE_ID || 'local'
                }
            });
        } else {
            next();
        }
    };
}

// Azure-specific error handling middleware
export function azureErrorHandler() {
    return (error, req, res, next) => {
        // Track errors with Application Insights
        if (appInsights.defaultClient) {
            appInsights.defaultClient.trackException({
                exception: error,
                properties: {
                    url: req.url,
                    method: req.method,
                    userAgent: req.get('User-Agent'),
                    ip: req.ip
                }
            });
        }

        // Log error details
        console.error('Azure Error Handler:', {
            error: error.message,
            stack: error.stack,
            url: req.url,
            method: req.method,
            timestamp: new Date().toISOString()
        });

        // Send appropriate response
        const status = error.status || error.statusCode || 500;
        const message = process.env.NODE_ENV === 'production' 
            ? 'Internal server error' 
            : error.message;

        res.status(status).json({
            success: false,
            message: message,
            timestamp: new Date().toISOString(),
            ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
        });
    };
}

// Memory usage monitoring
export function memoryMonitoringMiddleware() {
    return (req, res, next) => {
        // Track memory usage every 100 requests (to avoid overhead)
        if (Math.random() < 0.01 && appInsights.defaultClient) {
            const memUsage = process.memoryUsage();
            
            appInsights.defaultClient.trackMetric({
                name: 'Memory Usage RSS',
                value: memUsage.rss / 1024 / 1024 // Convert to MB
            });
            
            appInsights.defaultClient.trackMetric({
                name: 'Memory Usage Heap Used',
                value: memUsage.heapUsed / 1024 / 1024 // Convert to MB
            });
            
            appInsights.defaultClient.trackMetric({
                name: 'Memory Usage Heap Total',
                value: memUsage.heapTotal / 1024 / 1024 // Convert to MB
            });
        }
        
        next();
    };
}

export default {
    initializeApplicationInsights,
    securityMiddleware,
    compressionMiddleware,
    rateLimitMiddleware,
    slowDownMiddleware,
    azureLoggingMiddleware,
    healthCheckMiddleware,
    azureErrorHandler,
    memoryMonitoringMiddleware
}; 