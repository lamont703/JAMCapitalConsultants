import express from 'express';
import { authController } from '../controllers/authController.js';
import upload from '../middleware/disputeUpdateUploadMiddleware.js';
import authMiddleware from '../middleware/authMiddleware.js';
import adminMiddleware from '../middleware/adminAuth.js';
import adminController from '../controllers/adminControllers.js';

const router = express.Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/verify-security-answer', authController.verifySecurityAnswer);
router.post('/get-security-question', authController.getSecurityQuestion);
router.post('/reset-password-with-security', authController.resetPasswordWithSecurity);
router.post('/upload-report', 
    authMiddleware?.authenticateToken || ((req, res, next) => { console.error('❌ Missing authMiddleware.authenticateToken'); next(); }), 
    adminMiddleware?.requireAdmin || ((req, res, next) => { console.error('❌ Missing adminMiddleware.requireAdmin'); next(); }), 
    upload.single('file'),
    adminController.uploadReport
);

export default router; 