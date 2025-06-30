import express from 'express';
import { credentialsController } from '../controllers/credentialsController.js';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Store or update credentials
router.post('/store', authenticateToken, credentialsController.storeCredentials);

// Check if credentials exist for a service
router.get('/check/:serviceType', authenticateToken, credentialsController.checkCredentials);

// Remove credentials for a service
router.delete('/remove/:serviceType', authenticateToken, credentialsController.removeCredentials);

// Get all credentials for a user (admin only)
router.get('/user/:userId', authenticateToken, requireAdmin, credentialsController.getUserCredentials);

// Admin retrieve credentials with decryption (admin only)
router.post('/admin/retrieve', authenticateToken, requireAdmin, credentialsController.adminRetrieveCredentials);

// Get audit log for credential access (admin only)
router.get('/admin/audit-log', authenticateToken, requireAdmin, credentialsController.getAuditLog);

export default router; 