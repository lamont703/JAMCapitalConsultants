console.log('🔧 Loading userController module...');

const userController = {
    // Update the existing getNotifications function to also return dispute reports
    async getNotifications(req, res) {
        const userId = req.user.id;
        const cosmosService = req.app.locals.cosmosService;

        console.log('📬 Fetching notifications and dispute reports for user:', userId);

        // Query for notifications
        const notificationQuery = `
            SELECT * FROM c 
            WHERE c.type = 'notification' 
            AND c.userId = @userId 
            ORDER BY c.createdAt DESC
        `;
        
        // Query for dispute reports
        const disputeQuery = `
            SELECT * FROM c 
            WHERE c.type = 'dispute-report' 
            AND c.userId = @userId 
            ORDER BY c.submittedAt DESC
        `;
        
        const params = [{ name: "@userId", value: userId }];
        
        // Fetch both notifications and dispute reports
        const [notifications, disputeReports] = await Promise.all([
            cosmosService.queryDocuments(notificationQuery, params),
            cosmosService.queryDocuments(disputeQuery, params)
        ]);

        console.log(`📬 Found ${notifications.length} notifications and ${disputeReports.length} dispute reports`);

        res.status(200).json({
            success: true,
            notifications: notifications || [],
            disputeReports: disputeReports || [],
            counts: {
                notifications: notifications.length,
                disputeReports: disputeReports.length,
                unreadNotifications: notifications.filter(n => n.status === 'unread').length
            }
        });
    },

    // Add this new function to fetch user dispute reports
    async getUserDisputeReports(req, res) {
        const userId = req.user.id;
        const cosmosService = req.app.locals.cosmosService;

        console.log('📋 Fetching dispute reports for user:', userId);

        // Query for user's dispute reports
        const disputeQuery = `
            SELECT * FROM c 
            WHERE c.type = 'dispute-report' 
            AND c.userId = @userId 
            ORDER BY c.submittedAt DESC
        `;
        
        const disputeParams = [{ name: "@userId", value: userId }];
        const disputeReports = await cosmosService.queryDocuments(disputeQuery, disputeParams);

        console.log(`📋 Found ${disputeReports.length} dispute reports for user`);

        res.status(200).json({
            success: true,
            disputeReports: disputeReports || [],
            count: disputeReports.length
        });
    },

    // Get user profile/settings
    async getUserProfile(req, res) {
        const userId = req.user.id;
        const cosmosService = req.app.locals.cosmosService;

        console.log('👤 Fetching user profile for:', userId);

        const user = await cosmosService.getDocumentById(userId, 'user');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Remove sensitive information
        const { password, ...userProfile } = user;

        res.status(200).json({
            success: true,
            profile: userProfile
        });
    },

    // Update user profile
    async updateUserProfile(req, res) {
        const userId = req.user.id;
        const cosmosService = req.app.locals.cosmosService;
        const updateData = req.body;

        console.log('✏️ Updating user profile for:', userId);

        // Remove sensitive fields that shouldn't be updated via this endpoint
        const { password, id, type, createdAt, ...allowedUpdates } = updateData;

        // Add timestamp
        allowedUpdates.updatedAt = new Date().toISOString();

        await cosmosService.updateDocument(userId, 'user', allowedUpdates);

        console.log('✅ User profile updated successfully');

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully'
        });
    },

    // Mark notification as read
    async markNotificationRead(req, res) {
        const userId = req.user.id;
        const { notificationId } = req.params;
        const cosmosService = req.app.locals.cosmosService;

        console.log('📖 Marking notification as read:', notificationId);

        await cosmosService.updateDocument(notificationId, 'notification', {
            status: 'read',
            readAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        res.status(200).json({
            success: true,
            message: 'Notification marked as read'
        });
    }
};

console.log('🔧 userController object created:', Object.keys(userController));
console.log('🔧 getNotifications function exists:', typeof userController.getNotifications);
console.log('🔧 getUserDisputeReports function exists:', typeof userController.getUserDisputeReports);

export default userController;
console.log('🔧 userController exported successfully'); 