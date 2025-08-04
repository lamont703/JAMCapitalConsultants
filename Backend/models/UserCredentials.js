import CryptoJS from 'crypto-js';

export class UserCredentials {
    constructor(cosmosService) {
        this.cosmosService = cosmosService;
        this.encryptionKey = process.env.CREDENTIAL_ENCRYPTION_KEY || 'your-secure-32-character-key-here';
        
        // Validate encryption key length for AES-256
        if (this.encryptionKey.length < 32) {
            console.warn('⚠️ Encryption key should be at least 32 characters for AES-256');
        }
    }

    /**
     * Encrypt sensitive data using AES-256
     */
    encrypt(text) {
        try {
            const encrypted = CryptoJS.AES.encrypt(text, this.encryptionKey).toString();
            return encrypted;
        } catch (error) {
            console.error('❌ Encryption error:', error);
            throw new Error('Failed to encrypt data');
        }
    }

    /**
     * Decrypt sensitive data
     */
    decrypt(encryptedText) {
        try {
            const bytes = CryptoJS.AES.decrypt(encryptedText, this.encryptionKey);
            const decrypted = bytes.toString(CryptoJS.enc.Utf8);
            
            if (!decrypted) {
                throw new Error('Failed to decrypt - invalid data or key');
            }
            
            return decrypted;
        } catch (error) {
            console.error('❌ Decryption error:', error);
            throw new Error('Failed to decrypt data');
        }
    }

    /**
     * Store encrypted user credentials
     */
    async storeCredentials(userId, serviceType, email, password, ssn, purpose = 'credit_monitoring') {
        try {
            // Validate inputs
            if (!userId || !serviceType || !email || !password || !ssn) {
                throw new Error('Missing required fields: userId, serviceType, email, password, ssn');
            }

            const validServices = ['smartcredit', 'identityiq', 'myscoreiq', 'cfpb', 'annualcreditreport'];
            if (!validServices.includes(serviceType.toLowerCase())) {
                throw new Error(`Invalid service type. Must be one of: ${validServices.join(', ')}`);
            }

            // Validate SSN format (exactly 4 digits)
            if (!/^\d{4}$/.test(ssn)) {
                throw new Error('SSN must be exactly 4 digits');
            }

            // Check if credentials already exist for this user and service
            const existingCredentials = await this.getCredentials(userId, serviceType);
            if (existingCredentials) {
                throw new Error(`Credentials for ${serviceType} already exist for this user. Use updateCredentials to modify.`);
            }

            // Encrypt sensitive data
            const encryptedEmail = this.encrypt(email);
            const encryptedPassword = this.encrypt(password);
            const encryptedSSN = this.encrypt(ssn);

            // Create credential document
            const credentialDoc = {
                id: `credentials_${userId}_${serviceType}_${Date.now()}`,
                userId: userId,
                serviceType: serviceType.toLowerCase(),
                type: 'user_credentials',
                encryptedEmail: encryptedEmail,
                encryptedPassword: encryptedPassword,
                encryptedSSN: encryptedSSN,
                purpose: purpose,
                status: 'active',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                lastAccessedAt: null,
                encryptionKeyId: 'v1', // For future key rotation
                metadata: {
                    ipAddress: null, // Will be set by the route handler
                    userAgent: null  // Will be set by the route handler
                }
            };

            // Store in database
            const result = await this.cosmosService.createDocument(credentialDoc, 'user_credentials');
            
            console.log(`✅ Credentials stored for user ${userId} - service: ${serviceType}`);
            return {
                id: result.id,
                serviceType: serviceType,
                status: 'stored',
                createdAt: result.createdAt
            };

        } catch (error) {
            console.error('❌ Error storing credentials:', error);
            throw error;
        }
    }

    /**
     * Retrieve and decrypt user credentials (with audit logging)
     */
    async getCredentials(userId, serviceType, adminId = null, accessPurpose = 'system_access') {
        try {
            // Query for credentials
            const query = `
                SELECT * FROM c 
                WHERE c.userId = @userId 
                AND c.serviceType = @serviceType 
                AND c.type = @type
                AND c.status = @status
            `;
            
            const parameters = [
                { name: '@userId', value: userId },
                { name: '@serviceType', value: serviceType.toLowerCase() },
                { name: '@type', value: 'user_credentials' },
                { name: '@status', value: 'active' }
            ];

            const results = await this.cosmosService.queryDocuments(query, parameters);
            
            if (results.length === 0) {
                return null;
            }

            const credentialDoc = results[0];

            // Log access attempt
            await this.logCredentialAccess(credentialDoc.id, adminId, accessPurpose);

            // Update last accessed time
            await this.cosmosService.updateDocument(
                credentialDoc.id, 
                'user_credentials', 
                { 
                    lastAccessedAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            );

            // Return encrypted data (decryption handled by route for security)
            return {
                id: credentialDoc.id,
                userId: credentialDoc.userId,
                serviceType: credentialDoc.serviceType,
                encryptedEmail: credentialDoc.encryptedEmail,
                encryptedPassword: credentialDoc.encryptedPassword,
                encryptedSSN: credentialDoc.encryptedSSN,
                status: credentialDoc.status,
                createdAt: credentialDoc.createdAt,
                lastAccessedAt: credentialDoc.lastAccessedAt
            };

        } catch (error) {
            console.error('❌ Error retrieving credentials:', error);
            throw error;
        }
    }

    /**
     * Update existing credentials
     */
    async updateCredentials(userId, serviceType, email, password, ssn, adminId = null) {
        try {
            // Find existing credentials
            const existingCreds = await this.getCredentials(userId, serviceType, adminId, 'credential_update');
            
            if (!existingCreds) {
                throw new Error(`No credentials found for user ${userId} and service ${serviceType}`);
            }

            // Validate SSN format (exactly 4 digits)
            if (!/^\d{4}$/.test(ssn)) {
                throw new Error('SSN must be exactly 4 digits');
            }

            // Encrypt new data
            const encryptedEmail = this.encrypt(email);
            const encryptedPassword = this.encrypt(password);
            const encryptedSSN = this.encrypt(ssn);

            // Update document
            const updates = {
                encryptedEmail: encryptedEmail,
                encryptedPassword: encryptedPassword,
                encryptedSSN: encryptedSSN,
                updatedAt: new Date().toISOString(),
                encryptionKeyId: 'v1' // For future key rotation
            };

            const result = await this.cosmosService.updateDocument(
                existingCreds.id, 
                'user_credentials', 
                updates
            );

            console.log(`✅ Credentials updated for user ${userId} - service: ${serviceType}`);
            return {
                id: result.id,
                serviceType: serviceType,
                status: 'updated',
                updatedAt: result.updatedAt
            };

        } catch (error) {
            console.error('❌ Error updating credentials:', error);
            throw error;
        }
    }

    /**
     * Delete user credentials
     */
    async deleteCredentials(userId, serviceType, adminId = null) {
        try {
            // Find existing credentials
            const existingCreds = await this.getCredentials(userId, serviceType, adminId, 'credential_deletion');
            
            if (!existingCreds) {
                throw new Error(`No credentials found for user ${userId} and service ${serviceType}`);
            }

            // Soft delete by updating status
            const result = await this.cosmosService.updateDocument(
                existingCreds.id, 
                'user_credentials', 
                { 
                    status: 'deleted',
                    deletedAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            );

            console.log(`✅ Credentials deleted for user ${userId} - service: ${serviceType}`);
            return {
                id: result.id,
                serviceType: serviceType,
                status: 'deleted'
            };

        } catch (error) {
            console.error('❌ Error deleting credentials:', error);
            throw error;
        }
    }

    /**
     * Get user's credential status for all services
     */
    async getUserCredentialStatus(userId) {
        try {
            const query = `
                SELECT c.serviceType, c.status, c.createdAt, c.lastAccessedAt 
                FROM c 
                WHERE c.userId = @userId 
                AND c.type = @type
                ORDER BY c.createdAt DESC
            `;
            
            const parameters = [
                { name: '@userId', value: userId },
                { name: '@type', value: 'user_credentials' }
            ];

            const results = await this.cosmosService.queryDocuments(query, parameters);
            
            // Group by service type and get the latest for each
            const statusMap = {};
            results.forEach(cred => {
                if (!statusMap[cred.serviceType] || 
                    new Date(cred.createdAt) > new Date(statusMap[cred.serviceType].createdAt)) {
                    statusMap[cred.serviceType] = cred;
                }
            });

            return statusMap;

        } catch (error) {
            console.error('❌ Error getting credential status:', error);
            throw error;
        }
    }

    /**
     * Log credential access for audit trail
     */
    async logCredentialAccess(credentialId, adminId, purpose, ipAddress = null, userAgent = null, userEmail = null) {
        try {
            const accessLog = {
                id: `access_log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                type: 'credential_access_log',
                credentialId: credentialId,
                adminId: adminId || 'system',
                purpose: purpose,
                accessTimestamp: new Date().toISOString(),
                ipAddress: ipAddress,
                userAgent: userAgent,
                userEmail: userEmail, // Store the user email for admin audit logs
                sessionId: null // Could be enhanced with session tracking
            };

            await this.cosmosService.createDocument(accessLog, 'credential_access_log');
            console.log(`📝 Logged credential access: ${purpose}${userEmail ? ` for ${userEmail}` : ''}`);

        } catch (error) {
            console.error('❌ Error logging credential access:', error);
            // Don't throw - logging errors shouldn't break the main flow
        }
    }

    /**
     * Get audit trail for credential access
     */
    async getCredentialAuditTrail(credentialId, limit = 50) {
        try {
            const query = `
                SELECT * FROM c 
                WHERE c.credentialId = @credentialId 
                AND c.type = @type
                ORDER BY c.accessTimestamp DESC
                OFFSET 0 LIMIT @limit
            `;
            
            const parameters = [
                { name: '@credentialId', value: credentialId },
                { name: '@type', value: 'credential_access_log' },
                { name: '@limit', value: limit }
            ];

            return await this.cosmosService.queryDocuments(query, parameters);

        } catch (error) {
            console.error('❌ Error getting audit trail:', error);
            throw error;
        }
    }

    /**
     * Get recent admin credential access logs for the admin panel
     */
    async getAdminAuditLog(limit = 50) {
        try {
            // Use simple query first - Cosmos DB JOIN syntax is complex
            console.log('🔍 Querying admin access logs...');
            
            // Get recent admin access logs first
            const simpleQuery = `
                SELECT * FROM c 
                WHERE c.type = @logType
                AND (c.purpose LIKE @adminAccessPattern OR c.adminId != @systemId)
                ORDER BY c.accessTimestamp DESC
                OFFSET 0 LIMIT @limit
            `;
            
            const simpleParams = [
                { name: '@logType', value: 'credential_access_log' },
                { name: '@adminAccessPattern', value: 'admin_access_%' },
                { name: '@systemId', value: 'system' },
                { name: '@limit', value: limit }
            ];

            const results = await this.cosmosService.queryDocuments(simpleQuery, simpleParams);
            console.log(`🔍 Found ${results.length} access log entries`);

                        // Enrich with credential info
            const enrichedLogs = [];
            for (const log of results) {
                    try {
                        // If we have userEmail stored directly in the log, use it
                        if (log.userEmail) {
                            // Get credential info for service type
                            const credQuery = `SELECT * FROM c WHERE c.id = @credId AND c.type = 'user_credentials'`;
                            const credParams = [{ name: '@credId', value: log.credentialId }];
                            const credResults = await this.cosmosService.queryDocuments(credQuery, credParams);
                            
                            if (credResults.length > 0) {
                                const cred = credResults[0];
                                enrichedLogs.push({
                                    ...log,
                                    userId: cred.userId,
                                    serviceType: cred.serviceType,
                                    userEmail: log.userEmail // Use the stored email from the log
                                });
                            } else {
                                enrichedLogs.push({
                                    ...log,
                                    userId: 'unknown',
                                    serviceType: 'unknown',
                                    userEmail: log.userEmail
                                });
                            }
                        } else {
                            // Fallback for older logs without userEmail
                            const credQuery = `SELECT * FROM c WHERE c.id = @credId AND c.type = 'user_credentials'`;
                            const credParams = [{ name: '@credId', value: log.credentialId }];
                            const credResults = await this.cosmosService.queryDocuments(credQuery, credParams);
                            
                            if (credResults.length > 0) {
                                const cred = credResults[0];
                                enrichedLogs.push({
                                    ...log,
                                    userId: cred.userId,
                                    serviceType: cred.serviceType,
                                    userEmail: `user-${cred.userId?.substring(0, 8)}` || 'unknown'
                                });
                            }
                        }
                    } catch (error) {
                        console.warn('⚠️ Could not enrich audit log entry:', log.id);
                        // Include the log anyway with available info
                        enrichedLogs.push({
                            ...log,
                            userId: 'unknown',
                            serviceType: 'unknown',
                            userEmail: log.userEmail || 'unknown'
                        });
                    }
                }

            return enrichedLogs;

        } catch (error) {
            console.error('❌ Error getting admin audit log:', error);
            throw error;
        }
    }
}

export default UserCredentials; 