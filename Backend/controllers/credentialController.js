import { UserCredentials } from '../models/UserCredentials.js';
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
            const validServices = ['smartcredit', 'identityiq', 'myscoreiq', 'cfpb', 'annualcreditreport'];
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

            // Get current credential completion status
            const completionStatus = await this.checkCredentialCompletion(userId);
            
            // 🎯 TRIGGER AUTOMATION ON EVERY CREDENTIAL UPLOAD (regardless of completion)
            console.log(`🚀 Credential uploaded for user ${userId} (${completionStatus.completedCount}/${completionStatus.totalRequired}) - triggering tag automation`);
            
            // Trigger tag automation immediately
            await this.triggerTagAutomation(userId, completionStatus, req);
            
            if (completionStatus.allComplete) {
                console.log(`✅ User ${userId} has now completed ALL credentials!`);
            } else {
                console.log(`📝 User ${userId} progress: ${completionStatus.completedCount}/${completionStatus.totalRequired} credentials complete`);
            }

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
                },
                cfpb: {
                    hasCredentials: false,
                    status: 'not_provided',
                    lastUpdated: null
                },
                annualcreditreport: {
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
     * Check if all required credit monitoring credentials are complete
     */
    async checkCredentialCompletion(userId) {
        try {
            const requiredServices = ['smartcredit', 'identityiq', 'myscoreiq'];
            const credentialStatus = await this.userCredentials.getUserCredentialStatus(userId);
            
            const completedServices = requiredServices.filter(service => 
                credentialStatus[service] && credentialStatus[service].status === 'active'
            );
            
            const allComplete = completedServices.length === requiredServices.length;
            
            return {
                allComplete,
                completedCount: completedServices.length,
                totalRequired: requiredServices.length,
                completedServices,
                missingServices: requiredServices.filter(service => !completedServices.includes(service))
            };
        } catch (error) {
            console.error('❌ Error checking credential completion:', error);
            return {
                allComplete: false,
                completedCount: 0,
                totalRequired: 3,
                completedServices: [],
                missingServices: ['smartcredit', 'identityiq', 'myscoreiq']
            };
        }
    }

    /**
     * Trigger tag-based automation on ANY credential upload (1/3, 2/3, or 3/3)
     */
    async triggerTagAutomation(userId, completionStatus, req) {
        try {
            console.log(`🚀 Starting tag-based automation for user ${userId}`);
            console.log(`📊 Completion status:`, completionStatus);
            
            // Get user details from database
            const userQuery = 'SELECT * FROM c WHERE c.id = @userId AND c.type = @type';
            const userParams = [
                { name: '@userId', value: userId },
                { name: '@type', value: 'user' }
            ];
            const users = await req.app.locals.cosmosService.queryDocuments(userQuery, userParams);
            const user = users.length > 0 ? users[0] : null;
            if (!user) {
                console.error(`❌ User ${userId} not found in database`);
                return;
            }

            // Get GHL service
            const ghlService = req.app.locals.ghlService;
            if (!ghlService) {
                console.error('❌ GHL service not available');
                return;
            }

            // Find or create contact in GoHighLevel
            console.log(`🔍 Finding GHL contact for: ${user.email}`);
            let contact = await ghlService.findContactByEmail(user.email);
            
            if (!contact) {
                console.log(`📝 Contact not found, creating new contact for: ${user.email}`);
                const createResult = await ghlService.createContactFromRegistration({
                    name: user.name,
                    firstName: user.firstName || user.name?.split(' ')[0] || '',
                    lastName: user.lastName || user.name?.split(' ').slice(1).join(' ') || '',
                    email: user.email,
                    phone: user.phone || '',
                    company: user.company || ''
                });
                
                if (createResult.success) {
                    contact = { id: createResult.ghlContactId };
                    console.log(`✅ Contact created: ${contact.id}`);
                } else {
                    console.error(`❌ Failed to create contact: ${createResult.error}`);
                    return;
                }
            } else {
                console.log(`✅ Found existing contact: ${contact.id}`);
            }

            // Get current credential status for tag generation
            const credentialStatus = await this.userCredentials.getUserCredentialStatus(userId);
            
            // Create credential status object for tag generation
            const statusForTags = {
                smartcredit: credentialStatus.smartcredit?.status === 'active',
                identityiq: credentialStatus.identityiq?.status === 'active',
                myscoreiq: credentialStatus.myscoreiq?.status === 'active'
            };

            console.log(`🏷️ Credential status for tags:`, statusForTags);

            // Update contact with credential completion tags
            const tagResult = await ghlService.updateCredentialTags(contact.id, statusForTags);
            
            if (tagResult.success) {
                console.log(`✅ Contact tags updated successfully`);
                
                // Log successful tag automation
                await this.logTagAutomation(
                    userId, 
                    contact.id, 
                    completionStatus, 
                    'tag_automation_success',
                    null,
                    { appliedTags: ghlService.generateCredentialTags(statusForTags) }
                );
                
                return {
                    success: true,
                    userId,
                    contactId: contact.id,
                    status: 'tag_automation_completed',
                    appliedTags: ghlService.generateCredentialTags(statusForTags),
                    completionCount: completionStatus.completedCount
                };
                
            } else {
                console.error(`❌ Failed to update contact tags: ${tagResult.error}`);
                
                // Log tag automation failure
                await this.logTagAutomation(
                    userId, 
                    contact.id, 
                    completionStatus, 
                    'tag_automation_error', 
                    tagResult.error
                );
                
                return {
                    success: false,
                    userId,
                    contactId: contact.id,
                    status: 'tag_automation_failed',
                    error: tagResult.error
                };
            }
            
        } catch (error) {
            console.error('❌ Error in tag-based automation:', error);
            
            // Log the error but don't fail the credential storage
            await this.logTagAutomation(userId, null, completionStatus, 'automation_error', error.message);
            
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Log tag automation events for audit and monitoring
     */
    async logTagAutomation(userId, contactId, completionStatus, eventType, errorMessage = null, additionalMetadata = {}) {
        try {
            const logEntry = {
                id: `tag_automation_log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                type: 'tag_automation_log',
                userId: userId,
                contactId: contactId,
                eventType: eventType,
                completionStatus: completionStatus,
                timestamp: new Date().toISOString(),
                success: !eventType.includes('error'),
                errorMessage: errorMessage,
                metadata: {
                    completedServices: completionStatus?.completedServices || [],
                    totalCredentials: completionStatus?.totalRequired || 3,
                    completionCount: completionStatus?.completedCount || 0,
                    ...additionalMetadata
                }
            };

            // Store in database for monitoring and debugging
            await this.userCredentials.cosmosService.createDocument(logEntry, 'tag_automation_log');
            
            console.log(`📝 Tag automation logged: ${eventType} for user ${userId}`);
            
        } catch (error) {
            console.error('❌ Error logging pipeline automation:', error);
            // Don't throw - logging errors shouldn't break the main flow
        }
    }

    /**
     * Helper function to get display name for services
     */
    getServiceDisplayName(serviceType) {
        const serviceNames = {
            'smartcredit': 'SmartCredit',
            'identityiq': 'IdentityIQ',
            'myscoreiq': 'MyScoreIQ',
            'cfpb': 'CFPB',
            'annualcreditreport': 'AnnualCreditReport.com'
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