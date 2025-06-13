import express from 'express';
import multer from 'multer';
import { disputeUpdateUpload } from '../middleware/disputeUpdateUploadMiddleware.js';
import { SubscriptionService } from '../services/subscriptionService.js';
import { CosmosService } from '../services/cosmosService.js';
import { User } from '../models/User.js';

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
const subscriptionService = new SubscriptionService();

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

// Bulk delete notifications
router.delete('/bulk-delete-notifications', 
    authMiddleware?.authenticateToken || ((req, res, next) => { console.error('❌ Missing authMiddleware.authenticateToken'); next(); }), 
    adminController.bulkDeleteNotifications
);

// Add this route to your existing adminRoutes.js file
router.post('/upload-document', upload.single('file'), adminController.uploadDocument);

// Add this route to your existing adminRoutes.js file
router.delete('/delete-document', authMiddleware.authenticateToken, adminController.deleteDocument);

// Add this route to your existing adminRoutes.js file
router.get('/get-user-documents', authMiddleware.authenticateToken, adminController.getUserDocuments);

console.log('✅ Activity routes registered');

// NEW: Subscription Management Endpoints for Admin

/**
 * GET /api/admin/subscriptions/overview - Get subscription overview
 */
router.get('/subscriptions/overview', async (req, res) => {
    try {
        const analytics = await subscriptionService.getSubscriptionAnalytics();
        
        res.json({
            success: true,
            data: {
                summary: analytics.summary,
                totalUsers: analytics.userSubscriptions.length,
                recentActivity: analytics.creditUsageLogs.slice(0, 20) // Latest 20 activities
            }
        });
    } catch (error) {
        console.error('Error getting subscription overview:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to get subscription overview'
        });
    }
});

/**
 * GET /api/admin/subscriptions/users - Get all users with subscription details
 */
router.get('/subscriptions/users', async (req, res) => {
    try {
        const { tier, status, limit = 50, offset = 0 } = req.query;
        
        let query = 'SELECT * FROM c WHERE c.type = @type';
        const parameters = [{ name: '@type', value: 'user' }];
        
        if (tier) {
            query += ' AND c.subscription.tier = @tier';
            parameters.push({ name: '@tier', value: tier });
        }
        
        if (status) {
            query += ' AND c.subscription.status = @status';
            parameters.push({ name: '@status', value: status });
        }
        
        query += ' ORDER BY c.createdAt DESC';
        
        // Note: CosmosDB doesn't support OFFSET/LIMIT in the same way as SQL
        // For production, you'd implement pagination differently
        const cosmosService = new CosmosService();
        await cosmosService.initialize();
        const users = await cosmosService.queryDocuments(query, parameters);
        
        // Manual pagination for now
        const startIndex = parseInt(offset);
        const limitNum = parseInt(limit);
        const paginatedUsers = users.slice(startIndex, startIndex + limitNum);
        
        // Add subscription info to each user, handling legacy users without subscription data
        const usersWithSubInfo = paginatedUsers.map(user => {
            // Initialize subscription object if it doesn't exist (legacy users)
            const subscription = user.subscription || {
                tier: 'free',
                status: 'unknown',
                remainingCredits: 0,
                totalCreditsUsed: 0,
                creditsIncluded: 2,
                subscriptionStartDate: user.createdAt || new Date().toISOString(),
                subscriptionEndDate: null,
                lastCreditResetDate: user.createdAt || new Date().toISOString(),
                hasTrialUsed: true,
                paymentProvider: null,
                externalSubscriptionId: null,
                planHistory: []
            };

            return {
                id: user.id,
                name: user.name,
                email: user.email,
                createdAt: user.createdAt,
                subscription: subscription,
                subscriptionInfo: {
                    tierName: getTierName(subscription.tier),
                    remainingCredits: subscription.remainingCredits || 0,
                    totalCreditsUsed: subscription.totalCreditsUsed || 0,
                    status: subscription.status || 'unknown'
                }
            };
        });
        
        res.json({
            success: true,
            data: {
                users: usersWithSubInfo,
                pagination: {
                    total: users.length,
                    offset: startIndex,
                    limit: limitNum,
                    hasMore: (startIndex + limitNum) < users.length
                }
            }
        });
    } catch (error) {
        console.error('Error getting subscription users:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to get subscription users'
        });
    }
});

/**
 * PUT /api/admin/subscriptions/user/:userId/tier - Update user's subscription tier (Admin)
 */
router.put('/subscriptions/user/:userId/tier', async (req, res) => {
    try {
        const { userId } = req.params;
        const { 
            tier, 
            status = 'active', 
            subscriptionStartDate, 
            subscriptionEndDate, 
            reason = 'admin_update', 
            resetCredits = true 
        } = req.body;
        
        if (!userId || !tier) {
            return res.status(400).json({
                success: false,
                message: 'User ID and tier are required'
            });
        }
        
        const validTiers = ['free', 'starter', 'professional', 'premium'];
        if (!validTiers.includes(tier)) {
            return res.status(400).json({
                success: false,
                message: `Invalid tier. Must be one of: ${validTiers.join(', ')}`
            });
        }
        
        const validStatuses = ['active', 'expired', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
            });
        }
        
        const options = { 
            reason, 
            resetCredits, 
            status, 
            subscriptionStartDate, 
            subscriptionEndDate 
        };
        
        const updatedSubscription = await subscriptionService.updateUserSubscriptionTier(userId, tier, options);
        
        res.json({
            success: true,
            message: `Successfully updated user subscription to ${tier} (${status})`,
            data: updatedSubscription
        });
    } catch (error) {
        console.error('Error updating user subscription tier:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to update subscription tier'
        });
    }
});

/**
 * POST /api/admin/subscriptions/user/:userId/credits/add - Add credits to user (Admin)
 */
router.post('/subscriptions/user/:userId/credits/add', async (req, res) => {
    try {
        const { userId } = req.params;
        const { creditsToAdd } = req.body;
        
        if (!userId || !creditsToAdd || creditsToAdd <= 0) {
            return res.status(400).json({
                success: false,
                message: 'User ID and positive credits amount are required'
            });
        }
        
        // Get current user to add credits to existing amount
        const currentUser = await User.findById(userId);
        if (!currentUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        const newCreditAmount = (currentUser.subscription?.remainingCredits || 0) + parseInt(creditsToAdd);
        
        const userInstance = new User(currentUser);
        userInstance.subscription.remainingCredits = newCreditAmount;
        userInstance.updatedAt = new Date().toISOString();
        await userInstance.save();
        
        res.json({
            success: true,
            message: `Successfully added ${creditsToAdd} credits to user`,
            data: {
                previousCredits: currentUser.subscription?.remainingCredits || 0,
                creditsAdded: parseInt(creditsToAdd),
                newCreditAmount: newCreditAmount
            }
        });
    } catch (error) {
        console.error('Error adding credits to user:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to add credits'
        });
    }
});

/**
 * GET /api/admin/subscriptions/analytics - Get detailed subscription analytics
 */
router.get('/subscriptions/analytics', async (req, res) => {
    try {
        const { startDate, endDate, userId } = req.query;
        
        let analytics = await subscriptionService.getSubscriptionAnalytics(userId);
        
        // Filter by date range if provided
        if (startDate || endDate) {
            const start = startDate ? new Date(startDate) : new Date('2000-01-01');
            const end = endDate ? new Date(endDate) : new Date();
            
            analytics.creditUsageLogs = analytics.creditUsageLogs.filter(log => {
                const logDate = new Date(log.timestamp);
                return logDate >= start && logDate <= end;
            });
        }
        
        res.json({
            success: true,
            data: analytics
        });
    } catch (error) {
        console.error('Error getting subscription analytics:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to get subscription analytics'
        });
    }
});

/**
 * POST /api/admin/subscriptions/process-expired - Process expired subscriptions
 */
router.post('/subscriptions/process-expired', async (req, res) => {
    try {
        const processedUsers = await subscriptionService.processExpiredSubscriptions();
        
        const successCount = processedUsers.filter(u => u.processed).length;
        const errorCount = processedUsers.filter(u => !u.processed).length;
        
        res.json({
            success: true,
            message: `Processed ${successCount} expired subscriptions (${errorCount} errors)`,
            data: {
                processedUsers,
                summary: {
                    total: processedUsers.length,
                    successful: successCount,
                    errors: errorCount
                }
            }
        });
    } catch (error) {
        console.error('Error processing expired subscriptions:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to process expired subscriptions'
        });
    }
});

// Helper function
function getTierName(tier) {
    const tierNames = {
        free: 'Free Trial',
        starter: 'DIY Starter',
        professional: 'DIY Professional',
        premium: 'DIY Premium',
        unknown: 'Legacy User'
    };
    return tierNames[tier] || 'Unknown';
}

console.log('✅ Activity routes registered');

// Add before the export statement
router.patch('/update-user-role', 
    authMiddleware?.authenticateToken || ((req, res, next) => { console.error('❌ Missing authMiddleware.authenticateToken'); next(); }),
    adminMiddleware?.requireAdmin || ((req, res, next) => { console.error('❌ Missing adminMiddleware.requireAdmin'); next(); }),
    async (req, res) => {
        try {
            const { email, role } = req.body;

            if (!email || !role) {
                return res.status(400).json({
                    success: false,
                    message: 'Email and role are required'
                });
            }

            const validRoles = ['user', 'admin', 'administrator', 'super_admin'];
            if (!validRoles.includes(role)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid role. Must be one of: ${validRoles.join(', ')}`
                });
            }

            const cosmosService = req.app.locals.cosmosService;
            
            // Find user by email
            const user = await cosmosService.getUserByEmail(email);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Update user role
            await cosmosService.updateDocument(user.id, 'user', {
                role: role,
                updatedAt: new Date().toISOString()
            });

            console.log(`✅ Admin ${req.user.email} updated role for ${email} to ${role}`);

            res.json({
                success: true,
                message: `User role updated to ${role}`,
                user: {
                    email: user.email,
                    name: user.name,
                    role: role
                }
            });

        } catch (error) {
            console.error('❌ Error updating user role:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update user role'
            });
        }
    }
);

// Add migration endpoint before the export statement
router.post('/migrate-roles', 
    authMiddleware?.authenticateToken || ((req, res, next) => { console.error('❌ Missing authMiddleware.authenticateToken'); next(); }),
    adminMiddleware?.requireAdmin || ((req, res, next) => { console.error('❌ Missing adminMiddleware.requireAdmin'); next(); }),
    async (req, res) => {
        try {
            console.log('🚀 Starting role migration via API...');
            const cosmosService = req.app.locals.cosmosService;
            
            // Get all users
            const query = 'SELECT * FROM c WHERE c.type = @type';
            const parameters = [{ name: '@type', value: 'user' }];
            const users = await cosmosService.queryDocuments(query, parameters);
            
            console.log(`📊 Found ${users.length} users to migrate`);

            let migratedCount = 0;
            let skippedCount = 0;
            let errorCount = 0;

            for (const user of users) {
                try {
                    if (user.role) {
                        console.log(`⏭️ Skipping ${user.email} - already has role: ${user.role}`);
                        skippedCount++;
                        continue;
                    }

                    // Add role field
                    const updateData = {
                        role: 'user',
                        updatedAt: new Date().toISOString()
                    };

                    await cosmosService.updateDocument(user.id, 'user', updateData);
                    console.log(`✅ Migrated ${user.email} - added role: user`);
                    migratedCount++;

                } catch (error) {
                    console.error(`❌ Error migrating user ${user.email}:`, error.message);
                    errorCount++;
                }
            }

            const summary = {
                total: users.length,
                migrated: migratedCount,
                skipped: skippedCount,
                errors: errorCount
            };

            console.log('📊 Migration Summary:', summary);

            res.json({
                success: true,
                message: 'Role migration completed',
                summary: summary
            });

        } catch (error) {
            console.error('❌ Migration failed:', error);
            res.status(500).json({
                success: false,
                message: 'Migration failed',
                error: error.message
            });
        }
    }
);

// Add temporary public migration endpoint (REMOVE AFTER INITIAL SETUP)
router.post('/initial-migration-setup', async (req, res) => {
    try {
        // Security check - only allow if no admin users exist yet
        const cosmosService = req.app.locals.cosmosService;
        const adminQuery = 'SELECT * FROM c WHERE c.type = @type AND c.role = @role';
        const adminParams = [
            { name: '@type', value: 'user' },
            { name: '@role', value: 'admin' }
        ];
        const existingAdmins = await cosmosService.queryDocuments(adminQuery, adminParams);
        
        if (existingAdmins.length > 0) {
            return res.status(403).json({
                success: false,
                message: 'Initial setup already completed. Use /migrate-roles endpoint with admin auth.'
            });
        }

        console.log('🚀 Starting initial role migration setup...');
        
        // Get all users
        const query = 'SELECT * FROM c WHERE c.type = @type';
        const parameters = [{ name: '@type', value: 'user' }];
        const users = await cosmosService.queryDocuments(query, parameters);
        
        console.log(`📊 Found ${users.length} users to migrate`);

        let migratedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const user of users) {
            try {
                if (user.role) {
                    console.log(`⏭️ Skipping ${user.email} - already has role: ${user.role}`);
                    skippedCount++;
                    continue;
                }

                // Add role field - make lamont703@gmail.com admin, others user
                const role = user.email === 'lamont703@gmail.com' ? 'admin' : 'user';
                const updateData = {
                    role: role,
                    updatedAt: new Date().toISOString()
                };

                await cosmosService.updateDocument(user.id, 'user', updateData);
                console.log(`✅ Migrated ${user.email} - added role: ${role}`);
                migratedCount++;

            } catch (error) {
                console.error(`❌ Error migrating user ${user.email}:`, error.message);
                errorCount++;
            }
        }

        const summary = {
            total: users.length,
            migrated: migratedCount,
            skipped: skippedCount,
            errors: errorCount
        };

        console.log('📊 Initial Migration Summary:', summary);

        res.json({
            success: true,
            message: 'Initial role migration setup completed',
            summary: summary,
            note: 'This endpoint is now disabled. Use /migrate-roles with admin auth for future migrations.'
        });

    } catch (error) {
        console.error('❌ Initial migration failed:', error);
        res.status(500).json({
            success: false,
            message: 'Initial migration failed',
            error: error.message
        });
    }
});

export default router; 