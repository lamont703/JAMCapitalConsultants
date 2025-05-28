import express from 'express';
import { authController } from '../controllers/authController.js';

const router = express.Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/verify-security-answer', authController.verifySecurityAnswer);
router.post('/get-security-question', authController.getSecurityQuestion);
router.post('/reset-password-with-security', authController.resetPasswordWithSecurity);

export default router; 