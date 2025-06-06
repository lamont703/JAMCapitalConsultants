import UserCredentials from '../models/UserCredentials.js';
import rateLimit from 'express-rate-limit';

// Rate limiting for credential operations
export const credentialRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit each IP to 10 requests per windowMs
    message: {
        success: false,
        message: 'Too many credential operations. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

class CredentialController {
    constructor() {
        this.userCredentials = null;
    }

    // Initialize with Cosmos service
    initialize(cosmosService) {
        this.userCredentials = new UserCredentials(cosmosService);
    }

    /**
     * Store user credentials securely
     */
    async storeCredentials(req, res) {
        try {
            // Validate request
            if (!this.userCredentials) {
                return res.status(500).json({
                    success: false,
                    message: 'Credential service not initialized'
                });
            }

            const { userId, serviceType, email, password, purpose } = req.body;

            // Validate required fields
            if (!userId || !serviceType || !email || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: userId, serviceType, email, password'
                });
            }

            // Validate service type
            const validServices = ['smartcredit', 'identityiq', 'myscoreiq'];
            if (!validServices.includes(serviceType.toLowerCase())) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid service type. Must be one of: ${validServices.join(', ')}`
                });
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid email format'
                });
            }

            // Validate password strength (basic requirements)
            if (password.length < 6) {
                return res.status(400).json({
                    success: false,
                    message: 'Password must be at least 6 characters long'
                });
            }

            // Get user info from token (added by auth middleware)
            const requestingUserId = req.user?.id;
            if (userId !== requestingUserId) {
                return res.status(403).json({
                    success: false,
                    message: 'Cannot store credentials for another user'
                });
            }

            // Store credentials
            const result = await this.userCredentials.storeCredentials(
                userId, 
                serviceType, 
                email, 
                password, 
                purpose || 'credit_monitoring'
            );

            // Log the operation (without sensitive data)
            console.log(`✅ Credentials stored for user ${userId} - service: ${serviceType}`);

            // Audit log with request metadata
            await this.userCredentials.logCredentialAccess(
                result.id, 
                requestingUserId, 
                'credential_storage', 
                req.ip, 
                req.get('User-Agent')
            );

            res.status(201).json({
                success: true,
                message: `${this.getServiceDisplayName(serviceType)} credentials stored securely`,
                data: {
                    id: result.id,
                    serviceType: result.serviceType,
                    status: result.status,
                    createdAt: result.createdAt
                }
            });

        } catch (error) {
            console.error('❌ Error storing credentials:', error);

            // Handle specific error types
            if (error.message.includes('already exist')) {
                return res.status(409).json({
                    success: false,
                    message: error.message
                });
            }

            res.status(500).json({
                success: false,
                message: 'Failed to store credentials securely'
            });
        }
    }

    /**
     * Get user credential status for all services
     */
    async getCredentialStatus(req, res) {
        try {
            if (!this.userCredentials) {
                return res.status(500).json({
                    success: false,
                    message: 'Credential service not initialized'
                });
            }

            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'User authentication required'
                });
            }

            // Get credential status for all services
            const credentialStatus = await this.userCredentials.getUserCredentialStatus(userId);

            // Transform the response to show user-friendly information
            const serviceStatus = {
                smartcredit: {
                    hasCredentials: false,
                    status: 'not_provided',
                    lastUpdated: null
                },
                identityiq: {
                    hasCredentials: false,
                    status: 'not_provided',
                    lastUpdated: null
                },
                myscoreiq: {
                    hasCredentials: false,
                    status: 'not_provided',
                    lastUpdated: null
                }
            };

            // Update status based on stored credentials
            Object.keys(credentialStatus).forEach(serviceType => {
                const cred = credentialStatus[serviceType];
                if (cred && cred.status === 'active') {
                    serviceStatus[serviceType] = {
                        hasCredentials: true,
                        status: 'provided',
                        lastUpdated: cred.createdAt,
                        lastAccessed: cred.lastAccessedAt
                    };
                }
            });

            res.json({
                success: true,
                data: serviceStatus
            });

        } catch (error) {
            console.error('❌ Error getting credential status:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve credential status'
            });
        }
    }

    /**
     * Admin function to retrieve credentials (with audit logging)
     */
    async getCredentialsForAdmin(req, res) {
        try {
            if (!this.userCredentials) {
                return res.status(500).json({
                    success: false,
                    message: 'Credential service not initialized'
                });
            }

            const { userEmail, serviceType, purpose } = req.body;
            const adminId = req.user?.id;

            // Validate required fields
            if (!userEmail || !serviceType || !purpose) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: userEmail, serviceType, purpose'
                });
            }

            // First, get the user ID from email
            const user = await req.app.locals.cosmosService.getUserByEmail(userEmail);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Get encrypted credentials
            const encryptedCreds = await this.userCredentials.getCredentials(
                user.id, 
                serviceType, 
                adminId, 
                purpose
            );

            if (!encryptedCreds) {
                return res.status(404).json({
                    success: false,
                    message: `No ${serviceType} credentials found for user`
                });
            }

            // Decrypt credentials (only for authorized admin access)
            const decryptedEmail = this.userCredentials.decrypt(encryptedCreds.encryptedEmail);
            const decryptedPassword = this.userCredentials.decrypt(encryptedCreds.encryptedPassword);

            // Log the admin access with additional context
            await this.userCredentials.logCredentialAccess(
                encryptedCreds.id, 
                adminId, 
                `admin_access_${purpose}`, 
                req.ip, 
                req.get('User-Agent'),
                userEmail  // Pass the user email for audit logs
            );

            res.json({
                success: true,
                message: 'Credentials retrieved successfully',
                data: {
                    serviceType: serviceType,
                    email: decryptedEmail,
                    password: decryptedPassword,
                    lastAccessed: encryptedCreds.lastAccessedAt,
                    warning: 'These credentials will be hidden after 45 seconds for security'
                }
            });

        } catch (error) {
            console.error('❌ Error retrieving credentials for admin:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve credentials'
            });
        }
    }

    /**
     * Update existing credentials
     */
    async updateCredentials(req, res) {
        try {
            if (!this.userCredentials) {
                return res.status(500).json({
                    success: false,
                    message: 'Credential service not initialized'
                });
            }

            const { serviceType, email, password } = req.body;
            const userId = req.user?.id;

            // Validate required fields
            if (!serviceType || !email || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: serviceType, email, password'
                });
            }

            // Update credentials
            const result = await this.userCredentials.updateCredentials(
                userId, 
                serviceType, 
                email, 
                password, 
                userId
            );

            res.json({
                success: true,
                message: `${this.getServiceDisplayName(serviceType)} credentials updated successfully`,
                data: {
                    serviceType: result.serviceType,
                    status: result.status,
                    updatedAt: result.updatedAt
                }
            });

        } catch (error) {
            console.error('❌ Error updating credentials:', error);
            
            if (error.message.includes('No credentials found')) {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }

            res.status(500).json({
                success: false,
                message: 'Failed to update credentials'
            });
        }
    }

    /**
     * Delete user credentials
     */
    async deleteCredentials(req, res) {
        try {
            if (!this.userCredentials) {
                return res.status(500).json({
                    success: false,
                    message: 'Credential service not initialized'
                });
            }

            const { serviceType } = req.body;
            const userId = req.user?.id;

            if (!serviceType) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required field: serviceType'
                });
            }

            // Delete credentials
            const result = await this.userCredentials.deleteCredentials(
                userId, 
                serviceType, 
                userId
            );

            res.json({
                success: true,
                message: `${this.getServiceDisplayName(serviceType)} credentials deleted successfully`,
                data: {
                    serviceType: result.serviceType,
                    status: result.status
                }
            });

        } catch (error) {
            console.error('❌ Error deleting credentials:', error);
            
            if (error.message.includes('No credentials found')) {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }

            res.status(500).json({
                success: false,
                message: 'Failed to delete credentials'
            });
        }
    }

    /**
     * Get audit trail for credential access
     */
    async getCredentialAuditTrail(req, res) {
        try {
            if (!this.userCredentials) {
                return res.status(500).json({
                    success: false,
                    message: 'Credential service not initialized'
                });
            }

            const { credentialId } = req.params;
            const limit = parseInt(req.query.limit) || 50;

            const auditTrail = await this.userCredentials.getCredentialAuditTrail(credentialId, limit);

            res.json({
                success: true,
                data: auditTrail
            });

        } catch (error) {
            console.error('❌ Error getting audit trail:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve audit trail'
            });
        }
    }

    /**
     * Get recent admin credential access logs for the admin panel
     */
    async getAdminAuditLog(req, res) {
        try {
            if (!this.userCredentials) {
                return res.status(500).json({
                    success: false,
                    message: 'Credential service not initialized'
                });
            }

            const limit = parseInt(req.query.limit) || 50;
            console.log(`📊 Getting admin audit log (limit: ${limit})`);

            const auditLogs = await this.userCredentials.getAdminAuditLog(limit);

            // Format the logs for the admin panel display
            const formattedLogs = auditLogs.map(log => ({
                id: log.id,
                timestamp: log.accessTimestamp,
                adminId: log.adminId,
                purpose: log.purpose,
                serviceType: log.serviceType || 'unknown',
                userEmail: log.userEmail || `user-${log.userId?.substring(0, 8)}` || 'unknown',
                ipAddress: log.ipAddress
            }));

            res.json({
                success: true,
                data: formattedLogs,
                message: `Retrieved ${formattedLogs.length} audit log entries`
            });

        } catch (error) {
            console.error('❌ Error getting admin audit log:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve admin audit log'
            });
        }
    }

    /**
     * Helper function to get display name for services
     */
    getServiceDisplayName(serviceType) {
        const serviceNames = {
            'smartcredit': 'SmartCredit',
            'identityiq': 'IdentityIQ',
            'myscoreiq': 'MyScoreIQ'
        };
        return serviceNames[serviceType.toLowerCase()] || serviceType;
    }
}

const credentialController = new CredentialController();

// Bind methods to instance to ensure proper context
credentialController.storeCredentials = credentialController.storeCredentials.bind(credentialController);
credentialController.getCredentialStatus = credentialController.getCredentialStatus.bind(credentialController);
credentialController.getCredentialsForAdmin = credentialController.getCredentialsForAdmin.bind(credentialController);
credentialController.updateCredentials = credentialController.updateCredentials.bind(credentialController);
credentialController.deleteCredentials = credentialController.deleteCredentials.bind(credentialController);
credentialController.getCredentialAuditTrail = credentialController.getCredentialAuditTrail.bind(credentialController);
credentialController.getAdminAuditLog = credentialController.getAdminAuditLog.bind(credentialController);

export default credentialController; 