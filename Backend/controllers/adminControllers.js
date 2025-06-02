import { NotificationSchema } from '../models/Notifications.js';
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
    },

    // Get notifications for a specific user
    async getUserNotifications(req, res) {
        try {
            console.log('📨 Getting notifications for user:', req.params.userId);
            
            const cosmosService = req.app.locals.cosmosService;
            if (!cosmosService) {
                throw new Error('CosmosDB service not available');
            }

            // Use the same format as the working admin activity query
            const querySpec = "SELECT * FROM c WHERE c.type = 'notification' AND c.userId = @userId ORDER BY c.timestamp DESC";
            const parameters = [
                { name: "@userId", value: req.params.userId }
            ];
            
            console.log('🔍 Executing query:', querySpec);
            console.log('🔍 With parameters:', parameters);
            
            // Use the same method call format as the working admin activity query
            const notifications = await cosmosService.queryDocuments(querySpec, parameters);
            console.log('✅ Notifications loaded from database:', notifications.length);
            
            // Transform notifications to match MessagesModule format
            const messages = notifications.map(notification => ({
                id: notification.id,
                sender: notification.senderName || 'JAM Credit Solutions',
                avatar: notification.senderName ? notification.senderName.charAt(0).toUpperCase() : 'J',
                subject: notification.subject,
                body: notification.message,
                time: new Date(notification.timestamp),
                read: notification.read || false,
                type: notification.notificationType || 'general'
            }));

            res.json({
                success: true,
                messages: messages
            });

        } catch (error) {
            console.error('❌ Error getting user notifications:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get notifications',
                error: error.message
            });
        }
    },

    // Delete notification
    async deleteNotification(req, res) {
        try {
            const { notificationId, userId } = req.body;
            console.log('🗑️ Deleting notification:', notificationId, 'for user:', userId);
            
            const cosmosService = req.app.locals.cosmosService;
            if (!cosmosService) {
                throw new Error('CosmosDB service not available');
            }

            // First, let's get the exact notification document to see its structure
            const querySpec = "SELECT * FROM c WHERE c.id = @notificationId AND c.userId = @userId AND c.type = 'notification'";
            const parameters = [
                { name: "@notificationId", value: notificationId },
                { name: "@userId", value: userId }
            ];
            
            console.log('🔍 Searching for notification with query:', querySpec);
            console.log('🔍 Parameters:', parameters);
            
            const notifications = await cosmosService.queryDocuments(querySpec, parameters);
            
            if (notifications.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Notification not found or does not belong to user'
                });
            }

            console.log('✅ Notification found:', JSON.stringify(notifications[0], null, 2));
            const notification = notifications[0];

            // The key fix: Use the document's ID as the partition key
            // Based on your CosmosDB setup, it appears the partition key is the document ID itself
            console.log('🔑 Using document ID as partition key:', notificationId);
            console.log('🗑️ Attempting to delete document with ID:', notificationId);

            try {
                // Use the document ID as both the ID and partition key
                const deleteResult = await cosmosService.deleteDocument(notificationId, notificationId);
                console.log('✅ Delete result:', deleteResult);
                
            } catch (deleteError) {
                console.error('❌ Delete failed with document ID as partition key:', deleteError.message);
                
                // Try with no partition key (for containers without partition key)
                try {
                    console.log('🔄 Trying delete without partition key...');
                    const deleteResult2 = await cosmosService.deleteDocument(notificationId);
                    console.log('✅ Delete successful without partition key');
                    
                } catch (secondError) {
                    console.error('❌ Second delete attempt failed:', secondError.message);
                    
                    // Try with type as partition key
                    try {
                        console.log('🔄 Trying with type as partition key...');
                        const deleteResult3 = await cosmosService.deleteDocument(notificationId, 'notification');
                        console.log('✅ Delete successful with type as partition key');
                        
                    } catch (thirdError) {
                        console.error('❌ All delete attempts failed');
                        throw deleteError; // Throw the original error
                    }
                }
            }
            
            console.log('✅ Notification deleted successfully');
            
            res.json({
                success: true,
                message: 'Notification deleted successfully'
            });

        } catch (error) {
            console.error('❌ Error deleting notification:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete notification',
                error: error.message
            });
        }
    },

    // Upload document (credit reports, ID verification, additional documents)
    async uploadDocument(req, res) {
        try {
            console.log('📄 Document upload request received');
            console.log('📄 Request body:', req.body);
            console.log('📄 File info:', req.file ? {
                originalname: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size
            } : 'No file');

            const { userId, documentType, fileName, bureau } = req.body;

            // Validate required fields
            if (!userId || !documentType || !req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: userId, documentType, and file are required'
                });
            }

            // For credit reports, bureau is required
            if (documentType === 'credit-report' && !bureau) {
                return res.status(400).json({
                    success: false,
                    message: 'Bureau selection is required for credit reports'
                });
            }

            const cosmosService = req.app.locals.cosmosService;
            
            // Initialize Azure Blob Service (same as uploadReport function)
            const blobService = new AzureBlobService();
            await blobService.initialize();

            if (!cosmosService) {
                throw new Error('CosmosDB service not available');
            }

            // Verify user exists
            const userQuery = "SELECT * FROM c WHERE c.id = @userId AND c.type = 'user'";
            const userParams = [{ name: "@userId", value: userId }];
            const users = await cosmosService.queryDocuments(userQuery, userParams);

            if (users.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            const user = users[0];

            // **NEW: Check for existing credit report for this bureau**
            if (documentType === 'credit-report') {
                const existingReportQuery = "SELECT * FROM c WHERE c.userId = @userId AND c.type = 'document' AND c.documentType = 'credit-report' AND c.bureau = @bureau";
                const existingReportParams = [
                    { name: "@userId", value: userId },
                    { name: "@bureau", value: bureau }
                ];
                
                const existingReports = await cosmosService.queryDocuments(existingReportQuery, existingReportParams);
                
                if (existingReports.length > 0) {
                    console.log(`❌ User already has a ${bureau} credit report:`, existingReports[0].fileName);
                    return res.status(409).json({
                        success: false,
                        message: `You already have a ${bureau} credit report uploaded. Please delete the existing report before uploading a new one.`,
                        existingReport: {
                            id: existingReports[0].id,
                            fileName: existingReports[0].fileName,
                            bureau: existingReports[0].bureau
                        }
                    });
                }
            }

            // Add this check after the credit report validation in your uploadDocument function
            if (documentType === 'id-verification') {
                const { idType } = req.body;
                
                if (!idType) {
                    return res.status(400).json({
                        success: false,
                        message: 'ID type selection is required for ID verification documents'
                    });
                }

                // Check for existing document of this ID type
                const existingIdDocQuery = "SELECT * FROM c WHERE c.userId = @userId AND c.type = 'document' AND c.documentType = 'id-verification' AND c.idType = @idType";
                const existingIdDocParams = [
                    { name: "@userId", value: userId },
                    { name: "@idType", value: idType }
                ];
                
                const existingIdDocs = await cosmosService.queryDocuments(existingIdDocQuery, existingIdDocParams);
                
                if (existingIdDocs.length > 0) {
                    console.log(`❌ User already has a ${idType} document:`, existingIdDocs[0].fileName);
                    const idTypeDisplay = idType === 'government-id' ? 'Government ID' : 'Utility Bill';
                    return res.status(409).json({
                        success: false,
                        message: `You already have a ${idTypeDisplay} uploaded. Please delete the existing document before uploading a new one.`,
                        existingDocument: {
                            id: existingIdDocs[0].id,
                            fileName: existingIdDocs[0].fileName,
                            idType: existingIdDocs[0].idType
                        }
                    });
                }
            }

            // Continue with the rest of your existing upload logic...
            // Create unique filename with timestamp and random string
            const timestamp = Date.now();
            const randomString = Math.random().toString(36).substr(2, 9);
            const fileExtension = req.file.originalname.split('.').pop();
            
            // Create organized filename based on document type and bureau
            let storedFileName;
            if (documentType === 'credit-report') {
                storedFileName = `credit-reports/${bureau}/${userId}_${bureau}_${timestamp}_${randomString}.${fileExtension}`;
            } else if (documentType === 'id-verification') {
                storedFileName = `id-verification/${userId}_id_${timestamp}_${randomString}.${fileExtension}`;
            } else if (documentType === 'additional-documents') {
                storedFileName = `additional-documents/${userId}_additional_${timestamp}_${randomString}.${fileExtension}`;
            } else {
                storedFileName = `documents/${userId}_${documentType}_${timestamp}_${randomString}.${fileExtension}`;
            }

            console.log('📁 Uploading file to blob storage:', storedFileName);

            // Upload file to blob storage
            const uploadResult = await blobService.uploadFile(req.file, storedFileName, {
                userEmail: user.email,
                documentType: documentType,
                bureau: bureau || null,
                uploadedBy: 'user',
                uploadDate: new Date().toISOString()
            });
            console.log('✅ File uploaded to blob storage:', uploadResult.url);

            // Create document record in database
            const documentRecord = {
                id: `doc_${timestamp}_${randomString}`,
                type: 'document',
                userId: userId,
                userEmail: user.email,
                userName: user.name || user.firstName,
                documentType: documentType,
                fileName: req.file.originalname,
                storedFileName: storedFileName,
                fileUrl: uploadResult.url,
                fileSize: req.file.size,
                mimeType: req.file.mimetype,
                bureau: bureau || null,
                uploadedBy: 'user'
            };

            // Add idType for ID verification documents
            if (documentType === 'id-verification' && req.body.idType) {
                documentRecord.idType = req.body.idType;
            }

            await cosmosService.createDocument(documentRecord);
            console.log('💾 Document record saved to database:', documentRecord.id);

            // Create notification for user about successful upload
            const documentNotification = NotificationSchema.createNotificationDocument({
                userId: userId,
                userEmail: user.email,
                userName: user.name || user.firstName,
                notificationType: 'document-upload',
                subject: 'Document Uploaded Successfully',
                message: `Your ${documentType.replace('-', ' ')} "${req.file.originalname}" has been successfully uploaded and saved.${bureau ? ` Bureau: ${bureau.charAt(0).toUpperCase() + bureau.slice(1)}` : ''}${req.body.idType ? ` Type: ${req.body.idType === 'government-id' ? 'Government ID' : 'Utility Bill'}` : ''}`,
                adminId: 'system',
                status: 'sent',
                metadata: {
                    documentId: documentRecord.id,
                    documentType: documentType,
                    fileName: req.file.originalname,
                    bureau: bureau || null,
                    idType: req.body.idType || null
                }
            });

            await cosmosService.createDocument(documentNotification);
            console.log('💾 Document notification saved to database:', documentNotification.id);

            // Return success response
            res.json({
                success: true,
                message: 'Document uploaded successfully',
                documentId: documentRecord.id,
                fileName: req.file.originalname,
                fileUrl: uploadResult.url,
                fileSize: req.file.size,
                documentType: documentType,
                bureau: bureau || null,
                timestamp: documentRecord.timestamp
            });

        } catch (error) {
            console.error('❌ Error uploading document:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to upload document',
                error: error.message
            });
        }
    },

    // Delete document (credit reports, ID verification, additional documents)
    async deleteDocument(req, res) {
        try {
            console.log('🗑️ Document deletion request received');
            const { documentId, userId } = req.body;

            if (!documentId || !userId) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: documentId and userId are required'
                });
            }

            const cosmosService = req.app.locals.cosmosService;
            if (!cosmosService) {
                throw new Error('CosmosDB service not available');
            }

            // Verify the document exists and belongs to the user
            const documentQuery = "SELECT * FROM c WHERE c.id = @documentId AND c.userId = @userId AND c.type = 'document'";
            const documentParams = [
                { name: "@documentId", value: documentId },
                { name: "@userId", value: userId }
            ];
            
            const documents = await cosmosService.queryDocuments(documentQuery, documentParams);
            
            if (documents.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Document not found or does not belong to user'
                });
            }

            const document = documents[0];
            console.log('✅ Document found for deletion:', document.fileName);

            // Delete the document from CosmosDB
            await cosmosService.deleteDocument(documentId, document.type || 'document');
            console.log('💾 Document deleted from database:', documentId);

            // Create notification for user about document deletion
            const deleteNotification = NotificationSchema.createNotificationDocument({
                userId: userId,
                userEmail: document.userEmail,
                userName: document.userName,
                notificationType: 'document-delete',
                subject: 'Document Deleted',
                message: `Your document "${document.fileName}" has been successfully deleted from your account.`,
                adminId: 'system',
                status: 'sent',
                metadata: {
                    deletedDocumentId: documentId,
                    documentType: document.documentType,
                    fileName: document.fileName,
                    bureau: document.bureau || null
                }
            });

            await cosmosService.createDocument(deleteNotification);
            console.log('💾 Document deletion notification saved:', deleteNotification.id);

            res.json({
                success: true,
                message: 'Document deleted successfully',
                documentId: documentId,
                fileName: document.fileName
            });

        } catch (error) {
            console.error('❌ Error deleting document:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete document',
                error: error.message
            });
        }
    },

    // Get user documents
    async getUserDocuments(req, res) {
        try {
            console.log('📥 Get user documents request received');
            const { userId } = req.query;

            if (!userId) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required field: userId'
                });
            }

            const cosmosService = req.app.locals.cosmosService;
            if (!cosmosService) {
                throw new Error('CosmosDB service not available');
            }

            // Query for user's documents
            const documentsQuery = "SELECT * FROM c WHERE c.userId = @userId AND c.type = 'document' ORDER BY c.createdAt DESC";
            const documentsParams = [{ name: "@userId", value: userId }];
            
            const documents = await cosmosService.queryDocuments(documentsQuery, documentsParams);
            console.log(`✅ Found ${documents.length} documents for user:`, userId);

            res.json({
                success: true,
                documents: documents,
                count: documents.length
            });

        } catch (error) {
            console.error('❌ Error fetching user documents:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch user documents',
                error: error.message
            });
        }
    }
};

// Add debugging before export
console.log('🔧 adminController object created:', Object.keys(adminController));
console.log('🔧 sendNotification function exists:', typeof adminController.sendNotification);

export default adminController;