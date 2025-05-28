import express from 'express';
import { settingsController } from '../controllers/settingsController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// All settings routes require authentication
router.use(authenticateToken);

// Get user settings
router.get('/profile', settingsController.getUserSettings);

// Update profile
router.put('/profile', settingsController.updateProfile);

// Change password
router.put('/password', settingsController.changePassword);

// Update security question
router.put('/security-question', settingsController.updateSecurityQuestion);

// Update notification preferences
router.put('/notifications', settingsController.updateNotifications);

// Delete account
router.delete('/account', settingsController.deleteAccount);

export default router; 