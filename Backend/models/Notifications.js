// CosmosDB Notification Document Structure
// This file defines the structure for notification documents in CosmosDB

export const NotificationSchema = {
    // Document structure for CosmosDB notifications
    createNotificationDocument: ({
        userId,
        userEmail,
        userName,
        notificationType,
        subject,
        message,
        adminId,
        status = 'sent',
        metadata = {}
    }) => {
        return {
            id: `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'notification', // CosmosDB document type
            userId: userId,
            userEmail: userEmail,
            userName: userName,
            notificationType: notificationType, // 'credit-report', 'account', 'dispute', 'general', 'security', 'dispute_update'
            subject: subject,
            message: message,
            adminId: adminId,
            status: status, // 'sent', 'delivered', 'read', 'failed'
            read: false,
            timestamp: new Date().toISOString(),
            metadata: metadata,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    },

    createDisputeNotificationDocument: ({
        userId,
        userEmail,
        userName,
        disputeStatus,
        response,
        adminId
    }) => {
        return {
            id: `dispute_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'notification',
            userId: userId,
            userEmail: userEmail,
            userName: userName,
            notificationType: 'dispute_update',
            subject: `Dispute Status Update: ${disputeStatus}`,
            message: response,
            adminId: adminId,
            status: 'sent',
            read: false,
            timestamp: new Date().toISOString(),
            metadata: {
                disputeStatus: disputeStatus
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    },

    // Validation functions
    validateNotificationType: (type) => {
        const validTypes = ['credit-report', 'account', 'dispute', 'general', 'security', 'dispute_update'];
        return validTypes.includes(type);
    },

    validateStatus: (status) => {
        const validStatuses = ['sent', 'delivered', 'read', 'failed'];
        return validStatuses.includes(status);
    }
};

export default NotificationSchema;
