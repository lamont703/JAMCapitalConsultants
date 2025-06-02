import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';

console.log('🔧 Loading userRoutes module...');
console.log('🔧 authenticateToken imported:', typeof authenticateToken);

// Import userController with debugging
import userController from '../controllers/userController.js';
console.log('🔧 userController imported:', typeof userController);
console.log('🔧 userController keys:', Object.keys(userController || {}));
console.log('🔧 userController.getNotifications:', typeof userController?.getNotifications);

const router = express.Router();

// Existing routes
router.get('/profile', authenticateToken, userController.getUserProfile);
router.put('/profile', authenticateToken, userController.updateUserProfile);

// Add debugging before setting up the route
console.log('🔧 About to set up /notifications route...');
console.log('🔧 authenticateToken is:', typeof authenticateToken);
console.log('🔧 userController.getNotifications is:', typeof userController.getNotifications);

// Test each parameter individually
console.log('🔧 Parameter 1 (path):', '/notifications');
console.log('🔧 Parameter 2 (middleware):', typeof authenticateToken);
console.log('🔧 Parameter 3 (handler):', typeof userController.getNotifications);

// Try to access the function directly
try {
    const getNotificationsFunc = userController.getNotifications;
    console.log('🔧 Direct function access:', typeof getNotificationsFunc);
    console.log('🔧 Function toString:', getNotificationsFunc.toString().substring(0, 100));
} catch (error) {
    console.error('❌ Error accessing getNotifications function:', error);
}

// Add these routes for notifications and dispute reports
console.log('🔧 Setting up /notifications route on line 16...');

// Instead of direct reference, wrap it in a function
router.get('/notifications', authenticateToken, (req, res) => {
    return userController.getNotifications(req, res);
});

router.get('/dispute-reports', authenticateToken, userController.getUserDisputeReports);

// Make sure to export as default for ES6 modules
export default router;
console.log('🔧 userRoutes exported successfully'); 

