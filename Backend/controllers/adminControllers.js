import NotificationSchema from '../models/Notifications.js';
import AzureBlobService from '../services/azureBlobService.js';

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
            console.log('📄 File info:', req.file);
            console.log('📄 Report data:', req.body.reportData);

            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'No file uploaded'
                });
            }

            const reportData = JSON.parse(req.body.reportData);
            const { userEmail, reportType, userName } = reportData;
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

            // Initialize Azure Blob Service
            const blobService = new AzureBlobService();
            await blobService.initialize();

            // Generate unique filename
            const fileName = blobService.generateFileName(
                req.file.originalname,
                userEmail,
                reportType
            );

            // Upload file to Azure Blob Storage
            const uploadResult = await blobService.uploadFile(req.file, fileName, {
                userEmail: userEmail,
                reportType: reportType,
                uploadedBy: adminId,
                uploadDate: new Date().toISOString()
            });

            // Create report document for CosmosDB
            const reportDocument = {
                id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                type: 'report',
                userId: user.id,
                userEmail: user.email,
                userName: user.name || user.firstName,
                reportType: reportType,
                fileName: req.file.originalname,
                storedFileName: fileName,
                fileUrl: uploadResult.url,
                fileSize: req.file.size,
                adminId: adminId,
                status: 'uploaded',
                timestamp: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // Save report info to CosmosDB
            await cosmosService.createDocument(reportDocument);
            console.log('💾 Report document saved to database:', reportDocument.id);

            // Create notification for user about new report
            const reportNotification = NotificationSchema.createNotificationDocument({
                userId: user.id,
                userEmail: user.email,
                userName: user.name || user.firstName,
                notificationType: 'credit-report',
                subject: `New ${reportType} Report Available`,
                message: `A new ${reportType} report has been uploaded to your account. You can view it in your dashboard.`,
                adminId: adminId,
                status: 'sent',
                metadata: {
                    reportId: reportDocument.id,
                    reportType: reportType,
                    fileName: req.file.originalname
                }
            });

            await cosmosService.createDocument(reportNotification);
            console.log('💾 Report notification saved to database:', reportNotification.id);

            res.status(200).json({
                success: true,
                message: 'Report uploaded successfully',
                userFound: true,
                reportId: reportDocument.id,
                fileName: req.file.originalname,
                fileUrl: uploadResult.url,
                recipient: {
                    name: user.name || user.firstName,
                    email: user.email
                }
            });

        } catch (error) {
            console.error('❌ Error uploading report:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error while uploading report',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    // Save admin activity
    async saveActivity(req, res) {
        try {
            console.log('📊 Saving admin activity:', req.body);
            
            const activityData = req.body;
            const adminId = req.user.id;
            const cosmosService = req.app.locals.cosmosService;
            
            // Create activity document
            const activityDocument = {
                id: activityData.id || `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                type: 'admin-activity',
                activityType: activityData.type,
                title: activityData.title,
                description: activityData.description,
                adminId: adminId,
                timestamp: activityData.timestamp || new Date().toISOString(),
                createdAt: new Date().toISOString(),
                metadata: activityData.metadata || {}
            };
            
            console.log('💾 Saving activity document:', activityDocument);
            
            // Save to database
            await cosmosService.createDocument(activityDocument);
            console.log('✅ Activity saved to database:', activityDocument.id);
            
            res.status(200).json({
                success: true,
                message: 'Activity saved successfully',
                activityId: activityDocument.id
            });
            
        } catch (error) {
            console.error('❌ Error saving activity:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to save activity',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    // Get admin activity
    async getActivity(req, res) {
        try {
            console.log('📊 Loading admin activity');
            
            const adminId = req.user.id;
            const cosmosService = req.app.locals.cosmosService;
            
            // Fix: Use the correct query format for cosmosService
            const querySpec = "SELECT * FROM c WHERE c.type = 'admin-activity' AND c.adminId = @adminId ORDER BY c.timestamp DESC";
            const parameters = [
                { name: "@adminId", value: adminId }
            ];
            
            console.log('🔍 Executing query:', querySpec);
            console.log('🔍 With parameters:', parameters);
            
            // Use the correct method call format
            const activities = await cosmosService.queryDocuments(querySpec, parameters);
            console.log('✅ Activities loaded from database:', activities.length);
            
            // Transform for frontend
            const transformedActivities = activities.map(activity => ({
                id: activity.id,
                type: activity.activityType,
                title: activity.title,
                description: activity.description,
                timestamp: activity.timestamp,
                time: activity.timestamp // For backward compatibility
            }));
            
            res.status(200).json({
                success: true,
                activities: transformedActivities,
                count: transformedActivities.length
            });
            
        } catch (error) {
            console.error('❌ Error loading activity:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to load activity',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
};

// Add debugging before export
console.log('🔧 adminController object created:', Object.keys(adminController));
console.log('🔧 sendNotification function exists:', typeof adminController.sendNotification);

export default adminController;