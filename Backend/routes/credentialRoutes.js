import express from 'express';
import credentialController, { credentialRateLimit } from '../controllers/credentialController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import adminMiddleware from '../middleware/adminAuth.js';

const router = express.Router();

// Initialize credential controller with Cosmos service
router.use((req, res, next) => {
    if (req.app.locals.cosmosService && !credentialController.userCredentials) {
        console.log('🔧 Initializing credential controller with CosmosService...');
        credentialController.initialize(req.app.locals.cosmosService);
        console.log('✅ Credential controller initialized');
    } else if (!req.app.locals.cosmosService) {
        console.log('❌ CosmosService not available in app.locals');
    } else if (credentialController.userCredentials) {
        console.log('✅ Credential controller already initialized');
    }
    next();
});

// User routes for managing their own credentials
router.post('/store', 
    credentialRateLimit,
    authMiddleware.authenticateToken,
    credentialController.storeCredentials
);

router.get('/status', 
    authMiddleware.authenticateToken,
    credentialController.getCredentialStatus
);

router.put('/update', 
    credentialRateLimit,
    authMiddleware.authenticateToken,
    credentialController.updateCredentials
);

router.delete('/delete', 
    credentialRateLimit,
    authMiddleware.authenticateToken,
    credentialController.deleteCredentials
);

// Admin routes for accessing user credentials (with strict security)
router.post('/admin/retrieve', 
    credentialRateLimit,
    authMiddleware.authenticateToken,
    adminMiddleware.requireAdmin,
    credentialController.getCredentialsForAdmin
);

router.get('/admin/audit/:credentialId', 
    authMiddleware.authenticateToken,
    adminMiddleware.requireAdmin,
    credentialController.getCredentialAuditTrail
);

router.get('/admin/audit-log', 
    authMiddleware.authenticateToken,
    adminMiddleware.requireAdmin,
    credentialController.getAdminAuditLog
);

export default router; 