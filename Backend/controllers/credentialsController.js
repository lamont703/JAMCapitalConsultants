import crypto from 'crypto';

// Add debugging to see if the module loads
console.log('🔐 Loading credentialsController module...');

// Encryption key for credentials (should be in environment variables)
const ENCRYPTION_KEY = process.env.CREDENTIAL_ENCRYPTION_KEY || crypto.randomBytes(32);
const ALGORITHM = 'aes-256-gcm';

// Encrypt credentials
function encryptCredentials(text) {
    try {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipher(ALGORITHM, ENCRYPTION_KEY);
        
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        // Note: For simplicity, using older cipher method. In production, use authenticated encryption
        return {
            encrypted: encrypted,
            iv: iv.toString('hex')
        };
    } catch (error) {
        console.error('❌ Encryption error:', error);
        throw new Error('Failed to encrypt credentials');
    }
}

// Decrypt credentials (if needed for future use)
function decryptCredentials(encryptedData) {
    try {
        const decipher = crypto.createDecipher(ALGORITHM, ENCRYPTION_KEY);
        
        let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (error) {
        console.error('❌ Decryption error:', error);
        throw new Error('Failed to decrypt credentials');
    }
}

const credentialsController = {
    // Store or update credentials
    async storeCredentials(req, res) {
        try {
            console.log('🔐 Processing credential storage request...');
            
            const { userId, serviceType, email, password, purpose } = req.body;
            const cosmosService = req.app.locals.cosmosService;
            
            // Validate required fields
            if (!userId || !serviceType || !email || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: userId, serviceType, email, password'
                });
            }

            // Validate service type
            const validServices = ['smartcredit', 'identityiq', 'myscoreiq', 'cfpb', 'annualcreditreport'];
            if (!validServices.includes(serviceType)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid service type'
                });
            }

            // Encrypt the password
            const encryptedPassword = encryptCredentials(password);
            
            // Check if credentials already exist
            const existingCredentials = await cosmosService.queryDocuments(
                `SELECT * FROM c WHERE c.userId = '${userId}' AND c.type = 'credential' AND c.serviceType = '${serviceType}'`
            );

            const timestamp = new Date().toISOString();
            let credentialData;
            let operation;

            if (existingCredentials.length > 0) {
                // Update existing credentials
                const existing = existingCredentials[0];
                operation = 'update';
                
                credentialData = {
                    ...existing,
                    email: email,
                    encryptedPassword: encryptedPassword,
                    purpose: purpose || existing.purpose,
                    updatedAt: timestamp,
                    lastUpdatedBy: req.user.id
                };
                
                await cosmosService.updateDocument(existing.id, 'credential', credentialData);
                console.log(`✅ Updated ${serviceType} credentials for user ${userId}`);
            } else {
                // Create new credentials
                operation = 'create';
                const credentialId = `credential_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                
                credentialData = {
                    id: credentialId,
                    userId: userId,
                    type: 'credential',
                    serviceType: serviceType,
                    email: email,
                    encryptedPassword: encryptedPassword,
                    purpose: purpose || 'credit_monitoring',
                    createdAt: timestamp,
                    updatedAt: timestamp,
                    isActive: true
                };
                
                await cosmosService.createDocument(credentialData);
                console.log(`✅ Created ${serviceType} credentials for user ${userId}`);
            }

            // Create audit log
            const auditLogId = `audit_credential_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const auditLog = {
                id: auditLogId,
                userId: userId,
                type: 'audit_log',
                action: `credential_${operation}`,
                serviceType: serviceType,
                email: email,
                timestamp: timestamp,
                ipAddress: req.ip || req.connection.remoteAddress,
                userAgent: req.get('User-Agent'),
                performedBy: req.user.id
            };
            
            await cosmosService.createDocument(auditLog);

            // Return success response (without sensitive data)
            res.json({
                success: true,
                message: `${serviceType} credentials ${operation}d successfully`,
                operation: operation,
                serviceType: serviceType,
                email: email,
                updatedAt: timestamp
            });

        } catch (error) {
            console.error('❌ Error storing credentials:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to store credentials',
                error: error.message
            });
        }
    },

    // Check if credentials exist for a service
    async checkCredentials(req, res) {
        try {
            console.log('🔍 Checking existing credentials...');
            
            const { serviceType } = req.params;
            const userId = req.user.id; // From auth middleware
            const cosmosService = req.app.locals.cosmosService;

            // Validate service type
            const validServices = ['smartcredit', 'identityiq', 'myscoreiq', 'cfpb', 'annualcreditreport'];
            if (!validServices.includes(serviceType)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid service type'
                });
            }

            const credentials = await cosmosService.queryDocuments(
                `SELECT c.id, c.email, c.serviceType, c.createdAt, c.updatedAt, c.isActive 
                 FROM c 
                 WHERE c.userId = '${userId}' 
                 AND c.type = 'credential' 
                 AND c.serviceType = '${serviceType}'
                 AND c.isActive = true`
            );

            if (credentials.length > 0) {
                const credential = credentials[0];
                
                res.json({
                    success: true,
                    exists: true,
                    credential: {
                        email: credential.email,
                        serviceType: credential.serviceType,
                        createdAt: credential.createdAt,
                        updatedAt: credential.updatedAt
                    }
                });
            } else {
                res.json({
                    success: true,
                    exists: false
                });
            }

        } catch (error) {
            console.error('❌ Error checking credentials:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to check credentials',
                error: error.message
            });
        }
    },

    // Remove credentials for a service
    async removeCredentials(req, res) {
        try {
            console.log('🗑️ Removing credentials...');
            
            const { serviceType } = req.params;
            const { userId } = req.body;
            const requestingUserId = req.user.id; // From auth middleware
            const cosmosService = req.app.locals.cosmosService;

            // Validate that user can only remove their own credentials (unless admin)
            if (userId !== requestingUserId && req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Unauthorized to remove credentials for another user'
                });
            }

            // Validate service type
            const validServices = ['smartcredit', 'identityiq', 'myscoreiq', 'cfpb', 'annualcreditreport'];
            if (!validServices.includes(serviceType)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid service type'
                });
            }

            // Find existing credentials
            const credentials = await cosmosService.queryDocuments(
                `SELECT * FROM c 
                 WHERE c.userId = '${userId}' 
                 AND c.type = 'credential' 
                 AND c.serviceType = '${serviceType}'`
            );

            if (credentials.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Credentials not found'
                });
            }

            const credential = credentials[0];
            
            // Soft delete - mark as inactive
            const updatedCredential = {
                ...credential,
                isActive: false,
                deletedAt: new Date().toISOString(),
                deletedBy: requestingUserId
            };
            
            await cosmosService.updateDocument(credential.id, 'credential', updatedCredential);

            // Create audit log
            const auditLogId = `audit_credential_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const auditLog = {
                id: auditLogId,
                userId: userId,
                type: 'audit_log',
                action: 'credential_remove',
                serviceType: serviceType,
                email: credential.email,
                timestamp: new Date().toISOString(),
                ipAddress: req.ip || req.connection.remoteAddress,
                userAgent: req.get('User-Agent'),
                performedBy: requestingUserId
            };
            
            await cosmosService.createDocument(auditLog);

            console.log(`✅ Removed ${serviceType} credentials for user ${userId}`);

            res.json({
                success: true,
                message: `${serviceType} credentials removed successfully`,
                serviceType: serviceType
            });

        } catch (error) {
            console.error('❌ Error removing credentials:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to remove credentials',
                error: error.message
            });
        }
    },

    // Get all credentials for a user (admin only)
    async getUserCredentials(req, res) {
        try {
            console.log('📋 Getting user credentials...');
            
            const { userId } = req.params;
            const cosmosService = req.app.locals.cosmosService;
            
            // Only admins can view other users' credentials
            if (req.user.role !== 'admin' && req.user.id !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Unauthorized to view credentials'
                });
            }

            const credentials = await cosmosService.queryDocuments(
                `SELECT c.id, c.email, c.serviceType, c.createdAt, c.updatedAt, c.isActive
                 FROM c 
                 WHERE c.userId = '${userId}' 
                 AND c.type = 'credential'
                 AND c.isActive = true
                 ORDER BY c.updatedAt DESC`
            );

            res.json({
                success: true,
                credentials: credentials.map(cred => ({
                    serviceType: cred.serviceType,
                    email: cred.email,
                    createdAt: cred.createdAt,
                    updatedAt: cred.updatedAt
                }))
            });

        } catch (error) {
            console.error('❌ Error getting user credentials:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get user credentials',
                error: error.message
            });
        }
    }
};

export { credentialsController }; 