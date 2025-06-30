import crypto from 'crypto';

// Add debugging to see if the module loads
console.log('🔐 Loading credentialsController module...');

// Encryption key for credentials (should be in environment variables)
// For AES-256-CBC, we need exactly 32 bytes (256 bits)
const ENCRYPTION_KEY = process.env.CREDENTIAL_ENCRYPTION_KEY ? 
    crypto.createHash('sha256').update(process.env.CREDENTIAL_ENCRYPTION_KEY).digest() : 
    crypto.createHash('sha256').update('default-key-for-local-development').digest();
const ALGORITHM = 'aes-256-cbc';

// Encrypt credentials
function encryptCredentials(text) {
    try {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
        
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
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
        const iv = Buffer.from(encryptedData.iv, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
        
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
            
            // Ensure CORS headers are set
            res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
            res.header('Access-Control-Allow-Credentials', 'true');
            
            const { serviceType, email, password, purpose } = req.body;
            const userId = req.user.id; // Get userId from authenticated user
            const cosmosService = req.app.locals.cosmosService;
            
            // Validate required fields
            if (!serviceType || !email || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: serviceType, email, password'
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
                    lastUpdatedBy: req.user.id,
                    isActive: true
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
            
            // Ensure CORS headers are set even in error responses
            res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
            res.header('Access-Control-Allow-Credentials', 'true');
            
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
            
            // Ensure CORS headers are set
            res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
            res.header('Access-Control-Allow-Credentials', 'true');
            
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
                    hasCredentials: true,
                    currentEmail: credential.email,
                    lastUpdated: credential.updatedAt,
                    serviceType: credential.serviceType
                });
            } else {
                res.json({
                    success: true,
                    hasCredentials: false
                });
            }

        } catch (error) {
            console.error('❌ Error checking credentials:', error);
            
            // Ensure CORS headers are set even in error responses
            res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
            res.header('Access-Control-Allow-Credentials', 'true');
            
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
            
            // Ensure CORS headers are set
            res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
            res.header('Access-Control-Allow-Credentials', 'true');
            
            const { serviceType } = req.params;
            const userId = req.user.id; // Get userId from authenticated user
            const cosmosService = req.app.locals.cosmosService;

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
                deletedBy: userId
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
                performedBy: userId
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
            
            // Ensure CORS headers are set even in error responses
            res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
            res.header('Access-Control-Allow-Credentials', 'true');
            
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
    },

    // Admin retrieve credentials with decryption
    async adminRetrieveCredentials(req, res) {
        try {
            console.log('🛡️ Admin retrieving credentials...');
            
            // Ensure CORS headers are set
            res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
            res.header('Access-Control-Allow-Credentials', 'true');
            
            const { userEmail, serviceType, purpose } = req.body;
            const cosmosService = req.app.locals.cosmosService;

            // Validate required fields
            if (!userEmail || !serviceType || !purpose) {
                return res.status(400).json({
                    success: false,
                    message: 'User email, service type, and purpose are required'
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

            console.log(`🔍 Looking for user with email: ${userEmail}`);

            // First, find the user by email
            const users = await cosmosService.queryDocuments(
                `SELECT * FROM c WHERE c.email = '${userEmail}' AND c.type = 'user'`
            );

            if (users.length === 0) {
                console.log('❌ User not found');
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            const user = users[0];
            console.log(`✅ Found user: ${user.id}`);

            // Find the user's credentials for the specified service
            const credentials = await cosmosService.queryDocuments(
                `SELECT * FROM c 
                 WHERE c.userId = '${user.id}' 
                 AND c.type = 'credential' 
                 AND c.serviceType = '${serviceType}'
                 AND c.isActive = true`
            );

            if (credentials.length === 0) {
                console.log('❌ No credentials found for this service');
                return res.status(404).json({
                    success: false,
                    message: `No ${serviceType} credentials found for this user`
                });
            }

            const credential = credentials[0];
            console.log(`✅ Found credentials for service: ${serviceType}`);

            // Decrypt the password
            const decryptedPassword = decryptCredentials(credential.encryptedPassword);

            // Create audit log for admin access
            const auditLogId = `audit_admin_access_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const auditLog = {
                id: auditLogId,
                type: 'audit_log',
                action: 'admin_credential_access',
                adminId: req.user.id,
                adminEmail: req.user.email,
                targetUserId: user.id,
                targetUserEmail: userEmail,
                serviceType: serviceType,
                purpose: purpose,
                accessTimestamp: new Date().toISOString(),
                ipAddress: req.ip || req.connection.remoteAddress,
                userAgent: req.get('User-Agent')
            };

            await cosmosService.createDocument(auditLog);

            // Update the credential with last accessed info
            const updatedCredential = {
                ...credential,
                lastAccessed: new Date().toISOString(),
                lastAccessedBy: req.user.id
            };

            await cosmosService.updateDocument(credential.id, 'credential', updatedCredential);

            console.log(`✅ Admin access logged and credentials retrieved for ${serviceType}`);

            // Return decrypted credentials
            res.json({
                success: true,
                data: {
                    serviceType: serviceType,
                    email: credential.email,
                    password: decryptedPassword,
                    lastAccessed: credential.lastAccessed,
                    createdAt: credential.createdAt,
                    updatedAt: credential.updatedAt
                },
                userInfo: {
                    name: user.name || user.firstName + ' ' + user.lastName || 'Unknown',
                    email: user.email
                },
                accessLog: auditLog
            });

        } catch (error) {
            console.error('❌ Error retrieving credentials for admin:', error);
            
            // Ensure CORS headers are set even in error responses
            res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
            res.header('Access-Control-Allow-Credentials', 'true');
            
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve credentials',
                error: error.message
            });
        }
    },

    // Get audit log for admin access
    async getAuditLog(req, res) {
        try {
            console.log('📊 Getting credential audit log...');
            
            const cosmosService = req.app.locals.cosmosService;

            // Get recent audit logs (last 100 entries)
            const auditLogs = await cosmosService.queryDocuments(
                `SELECT * FROM c 
                 WHERE c.type = 'audit_log' 
                 AND c.action = 'admin_credential_access'
                 ORDER BY c.accessTimestamp DESC
                 OFFSET 0 LIMIT 100`
            );

            res.json({
                success: true,
                data: auditLogs
            });

        } catch (error) {
            console.error('❌ Error getting audit log:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get audit log',
                error: error.message
            });
        }
    }
};

export { credentialsController }; 