import NotificationSchema from '../models/Notifications.js';

// Add debugging to see if the module loads
console.log('🔧 Loading adminController module...');
console.log('🔧 NotificationSchema loaded:', !!NotificationSchema);

const adminController = {
    // Send notification to user
    async sendNotification(req, res) {
        try {
            console.log('📤 Admin notification request received:', req.body);
            
            const { userEmail, type, subject, message, timestamp } = req.body;
            const adminId = req.user.id;
            const cosmosService = req.app.locals.cosmosService;

            // Validate required fields
            if (!userEmail || !type || !subject || !message) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: userEmail, type, subject, message'
                });
            }

            // Validate notification type
            if (!NotificationSchema.validateNotificationType(type)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid notification type'
                });
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(userEmail)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid email format'
                });
            }

            // Verify user exists directly using CosmosDB service
            console.log('🔍 Verifying user exists:', userEmail);
            const user = await cosmosService.getUserByEmail(userEmail);
            
            if (!user) {
                console.log(`❌ User not found: ${userEmail}`);
                return res.status(404).json({
                    success: false,
                    message: 'User not found in the system',
                    userFound: false
                });
            }

            console.log(`✅ User found: ${user.name || user.firstName} (${user.email})`);

            // Create notification document using schema
            const notificationData = NotificationSchema.createNotificationDocument({
                userId: user.id,
                userEmail: user.email,
                userName: user.name || user.firstName,
                notificationType: type,
                subject: subject,
                message: message,
                adminId: adminId,
                status: 'sent'
            });

            // Save notification to CosmosDB
            await cosmosService.createDocument(notificationData);
            console.log('💾 Notification saved to database:', notificationData.id);

            // Update user's notification count
            try {
                await cosmosService.updateDocument(user.id, 'user', {
                    notificationCount: (user.notificationCount || 0) + 1,
                    lastNotificationAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
            } catch (updateError) {
                console.error('⚠️ Failed to update user notification count:', updateError);
            }

            console.log(`📊 Admin ${adminId} sent ${type} notification to ${user.email}`);

            res.status(200).json({
                success: true,
                message: 'Notification sent successfully',
                userFound: true,
                notificationId: notificationData.id,
                recipient: {
                    name: user.name || user.firstName,
                    email: user.email
                }
            });

        } catch (error) {
            console.error('❌ Error sending notification:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error while sending notification',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    // Send dispute update
    async sendDisputeUpdate(req, res) {
        try {
            console.log('⚖️ Admin dispute update request received:', req.body);
            
            const { userEmail, status, response } = req.body;
            const adminId = req.user.id;
            const cosmosService = req.app.locals.cosmosService;

            // Verify user exists
            console.log('🔍 Verifying user exists:', userEmail);
            const user = await cosmosService.getUserByEmail(userEmail);
            
            if (!user) {
                console.log(`❌ User not found: ${userEmail}`);
                return res.status(404).json({
                    success: false,
                    message: 'User not found in the system',
                    userFound: false
                });
            }

            console.log(`✅ User found: ${user.name || user.firstName} (${user.email})`);

            // Create dispute update notification using schema
            const disputeNotification = NotificationSchema.createDisputeNotificationDocument({
                userId: user.id,
                userEmail: user.email,
                userName: user.name || user.firstName,
                disputeStatus: status,
                response: response,
                adminId: adminId
            });

            await cosmosService.createDocument(disputeNotification);
            console.log('💾 Dispute notification saved to database:', disputeNotification.id);

            res.status(200).json({
                success: true,
                message: 'Dispute update sent successfully',
                userFound: true,
                notificationId: disputeNotification.id
            });

        } catch (error) {
            console.error('❌ Error sending dispute update:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error while sending dispute update'
            });
        }
    },

    // Upload report for user
    async uploadReport(req, res) {
        try {
            console.log('📄 Admin report upload request received');
            
            res.status(200).json({
                success: true,
                message: 'Report uploaded successfully'
            });

        } catch (error) {
            console.error('❌ Error uploading report:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error while uploading report'
            });
        }
    }
};

// Add debugging before export
console.log('🔧 adminController object created:', Object.keys(adminController));
console.log('🔧 sendNotification function exists:', typeof adminController.sendNotification);

export default adminController;