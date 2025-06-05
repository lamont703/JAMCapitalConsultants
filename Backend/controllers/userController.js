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
        try {
            const { userId } = req.params; // Get userId from route parameters
            const cosmosService = req.app.locals.cosmosService;

            console.log('📋 Fetching dispute reports for user:', userId);

            if (!userId) {
                return res.status(400).json({
                    success: false,
                    message: 'User ID is required'
                });
            }

            if (!cosmosService) {
                console.error('❌ CosmosDB service not available');
                return res.status(500).json({
                    success: false,
                    message: 'Database service unavailable'
                });
            }

            try {
                // Query for user's dispute reports
                const disputeQuery = `
                    SELECT * FROM c 
                    WHERE c.type = 'dispute-report' 
                    AND c.userId = @userId 
                    ORDER BY c.submittedAt DESC
                `;
                
                const disputeParams = [{ name: "@userId", value: userId }];
                const disputeReports = await cosmosService.queryDocuments(disputeQuery, disputeParams);

                console.log(`📋 Found ${disputeReports?.length || 0} dispute reports for user`);

                // Format the response to match expected structure
                const formattedReports = (disputeReports || []).map(report => ({
                    id: report.id,
                    userId: report.userId,
                    reportType: report.reportType || 'Credit Report Dispute',
                    status: report.status || 'submitted',
                    disputeSummary: report.disputeSummary || report.summary || 'No summary available',
                    submittedAt: report.submittedAt || report.createdAt || new Date().toISOString(),
                    reportDate: report.reportDate || report.submittedAt || new Date().toISOString(),
                    creditScores: report.creditScores || null,
                    fileInfo: report.fileInfo || null,
                    metadata: report.metadata || {}
                }));

                res.status(200).json({
                    success: true,
                    disputeReports: formattedReports,
                    count: formattedReports.length
                });

            } catch (queryError) {
                console.error('❌ Error querying dispute reports:', queryError);
                
                // If it's a "container not found" error, return empty array
                if (queryError.code === 404 || queryError.message?.includes('NotFound')) {
                    console.log('📋 DisputeReports collection not found, returning empty array');
                    return res.status(200).json({
                        success: true,
                        disputeReports: [],
                        count: 0
                    });
                }

                throw queryError; // Re-throw other errors
            }

        } catch (error) {
            console.error('❌ Error in getUserDisputeReports:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch dispute reports',
                error: error.message
            });
        }
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