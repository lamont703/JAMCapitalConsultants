import express from 'express';
import multer from 'multer';
import { disputeUpdateUpload } from '../middleware/disputeUpdateUploadMiddleware.js';

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Allow specific file types
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF, JPG, PNG, and Word documents are allowed.'), false);
        }
    }
});

// Add debugging for imports
console.log('🔧 Loading adminRoutes...');

let adminController, authMiddleware, adminMiddleware;

try {
    adminController = (await import('../controllers/adminControllers.js')).default;
    console.log('🔧 adminController imported:', !!adminController);
    console.log('🔧 adminController.sendNotification:', typeof adminController?.sendNotification);
} catch (error) {
    console.error('❌ Error importing adminController:', error);
}

try {
    authMiddleware = (await import('../middleware/authMiddleware.js')).default;
    console.log('🔧 authMiddleware imported:', !!authMiddleware);
    console.log('🔧 authMiddleware.authenticateToken:', typeof authMiddleware?.verifyToken);
} catch (error) {
    console.error('❌ Error importing authMiddleware:', error);
}

try {
    adminMiddleware = (await import('../middleware/adminAuth.js')).default;
    console.log('🔧 adminMiddleware imported:', !!adminMiddleware);
    console.log('🔧 adminMiddleware.requireAdmin:', typeof adminMiddleware?.requireAdmin);
} catch (error) {
    console.error('❌ Error importing adminMiddleware:', error);
}

const router = express.Router();

// Add debugging before route setup
console.log('🔧 Setting up admin routes...');

// Check if all middleware functions exist
if (!authMiddleware?.authenticateToken) {
    console.error('❌ authMiddleware.authenticateToken is undefined!');
}
if (!adminMiddleware?.requireAdmin) {
    console.error('❌ adminMiddleware.requireAdmin is undefined!');
}

// Admin notification routes
router.post('/send-notification', 
    authMiddleware?.authenticateToken || ((req, res, next) => { console.error('❌ Missing authMiddleware.authenticateToken'); next(); }), 
    adminMiddleware?.requireAdmin || ((req, res, next) => { console.error('❌ Missing adminMiddleware.requireAdmin'); next(); }), 
    adminController.sendNotification
);
console.log('✅ /send-notification route registered');

router.post('/send-dispute-update', 
    authMiddleware?.authenticateToken || ((req, res, next) => { console.error('❌ Missing authMiddleware.authenticateToken'); next(); }), 
    adminMiddleware?.requireAdmin || ((req, res, next) => { console.error('❌ Missing adminMiddleware.requireAdmin'); next(); }), 
    disputeUpdateUpload.single('file'),
    adminController.sendDisputeUpdate
);
console.log('✅ /send-dispute-update route registered');

router.post('/upload-report', 
    authMiddleware?.authenticateToken || ((req, res, next) => { console.error('❌ Missing authMiddleware.authenticateToken'); next(); }), 
    adminMiddleware?.requireAdmin || ((req, res, next) => { console.error('❌ Missing adminMiddleware.requireAdmin'); next(); }), 
    upload.single('file'),
    adminController.uploadReport
);
console.log('✅ /upload-report route registered');

// Save activity
router.post('/save-activity', 
    authMiddleware?.authenticateToken || ((req, res, next) => { console.error('❌ Missing authMiddleware.authenticateToken'); next(); }), 
    adminMiddleware?.requireAdmin || ((req, res, next) => { console.error('❌ Missing adminMiddleware.requireAdmin'); next(); }), 
    adminController.saveActivity
);

// Get activity
router.get('/get-activity', 
    authMiddleware?.authenticateToken || ((req, res, next) => { console.error('❌ Missing authMiddleware.authenticateToken'); next(); }), 
    adminMiddleware?.requireAdmin || ((req, res, next) => { console.error('❌ Missing adminMiddleware.requireAdmin'); next(); }), 
    adminController.getActivity
);

// Get notifications for a specific user
router.get('/get-user-notifications/:userId', 
    authMiddleware?.authenticateToken || ((req, res, next) => { console.error('❌ Missing authMiddleware.authenticateToken'); next(); }), 
    adminController.getUserNotifications
);

// Delete notification
router.delete('/delete-notification', 
    authMiddleware?.authenticateToken || ((req, res, next) => { console.error('❌ Missing authMiddleware.authenticateToken'); next(); }), 
    adminController.deleteNotification
);

// Add this route to your existing adminRoutes.js file
router.post('/upload-document', upload.single('file'), adminController.uploadDocument);

// Add this route to your existing adminRoutes.js file
router.delete('/delete-document', authMiddleware.authenticateToken, adminController.deleteDocument);

// Add this route to your existing adminRoutes.js file
router.get('/get-user-documents', authMiddleware.authenticateToken, adminController.getUserDocuments);

console.log('✅ Activity routes registered');

export default router; 