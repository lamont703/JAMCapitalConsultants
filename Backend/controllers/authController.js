import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { ghlSyncMiddleware } from '../middleware/ghlSyncMiddleware.js';

export const authController = {
    async register(req, res) {
        try {
            const { name, email, password, phone, company, ...otherData } = req.body;
            
            console.log('🔍 Registration started for:', email);
            
            // Get CosmosService from app.locals
            const cosmosService = req.app.locals.cosmosService;
            if (!cosmosService) {
                console.error('❌ CosmosService not available');
                return res.status(503).json({
                    success: false,
                    message: 'Database service not available'
                });
            }

            // Check if user already exists using the service directly
            const existingUser = await cosmosService.getUserByEmail(email);
            if (existingUser) {
                console.log('❌ User already exists:', email);
                return res.status(400).json({
                    success: false,
                    message: 'User already exists with this email'
                });
            }

            // Hash password
            const saltRounds = 12;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            // Create user document directly
            const userDocument = {
                id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                type: 'user',
                name: name.trim(),
                email: email.toLowerCase().trim(),
                password: hashedPassword,
                phone: phone ? phone.trim() : '',
                company: company ? company.trim() : '',
                ghlContactId: null,
                ghlSyncStatus: 'pending',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            console.log('💾 Saving user to database...');
            // Save user to CosmosDB
            const savedUser = await cosmosService.createDocument(userDocument, 'user');
            console.log('✅ User saved to database:', savedUser.id);

            // **NEW: Sync to GoHighLevel CRM with detailed debugging**
            console.log('🔄 Starting GHL sync for user:', savedUser.email);
            
            const ghlResult = await ghlSyncMiddleware.syncNewUser({
                id: savedUser.id,
                name: savedUser.name,
                email: savedUser.email,
                phone: savedUser.phone,
                company: savedUser.company,
                ...otherData
            });

            console.log('📊 GHL sync result:', JSON.stringify(ghlResult, null, 2));

            // Update user record with GHL contact ID if successful
            if (ghlResult.success && ghlResult.ghlContactId) {
                console.log('✅ GHL sync successful, updating user record...');
                await cosmosService.updateDocument(savedUser.id, 'user', {
                    ghlContactId: ghlResult.ghlContactId,
                    ghlSyncStatus: 'synced',
                    updatedAt: new Date().toISOString()
                });
                console.log('✅ User record updated with GHL contact ID:', ghlResult.ghlContactId);
            } else if (!ghlResult.success) {
                console.log('❌ GHL sync failed, updating status...');
                await cosmosService.updateDocument(savedUser.id, 'user', {
                    ghlSyncStatus: 'failed',
                    updatedAt: new Date().toISOString()
                });
                console.log('❌ GHL sync error:', ghlResult.error);
            }

            // Generate JWT token
            const token = jwt.sign(
                { 
                    userId: savedUser.id,
                    email: savedUser.email 
                },
                process.env.JWT_SECRET || 'your-secret-key',
                { expiresIn: '24h' }
            );

            // Remove password from response
            const { password: _, ...userResponse } = savedUser;

            console.log('🎉 Registration completed for:', email);

            res.status(201).json({
                success: true,
                message: 'User registered successfully',
                user: userResponse,
                token,
                ghlSync: {
                    success: ghlResult.success,
                    action: ghlResult.action || 'attempted',
                    error: ghlResult.error || null
                }
            });

        } catch (error) {
            console.error('❌ Registration error:', error);
            res.status(500).json({
                success: false,
                message: 'Registration failed',
                error: error.message
            });
        }
    },

    async login(req, res) {
        try {
            const { email, password } = req.body;

            // Validate input
            if (!email || !password) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Email and password are required' 
                });
            }

            const cosmosService = req.app.locals.cosmosService;

            // Find user by email
            const user = await cosmosService.getUserByEmail(email.toLowerCase().trim());
            if (!user) {
                return res.status(401).json({ 
                    success: false, 
                    error: 'Invalid email or password' 
                });
            }

            // Check if user is active
            if (!user.isActive) {
                return res.status(401).json({ 
                    success: false, 
                    error: 'Account is deactivated. Please contact support.' 
                });
            }

            // Verify password
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                return res.status(401).json({ 
                    success: false, 
                    error: 'Invalid email or password' 
                });
            }

            // Generate JWT token
            const token = jwt.sign(
                { 
                    userId: user.id, 
                    email: user.email,
                    role: user.role 
                },
                process.env.JWT_SECRET || 'your-secret-key',
                { expiresIn: '24h' }
            );

            // Update last login
            await cosmosService.updateUserLastLogin(user.id);

            // Remove password from response
            const { password: _, ...userResponse } = user;

            res.json({
                success: true,
                message: 'Login successful',
                user: userResponse,
                token: token
            });

        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Login failed. Please try again.' 
            });
        }
    },

    async logout(req, res) {
        try {
            // In a more advanced setup, you might:
            // 1. Add the token to a blacklist in CosmosDB
            // 2. Log the logout event for security auditing
            // 3. Clear any server-side session data
            console.log('Logout request received');

            const token = req.headers.authorization?.replace('Bearer ', '');
            const cosmosService = req.app.locals.cosmosService;

            if (token && cosmosService) {
                // Optional: Log the logout event for security auditing
                try {
                    const decoded = jwt.verify(token, process.env.JWT_SECRET);
                    await cosmosService.logUserActivity(decoded.userId, 'logout', {
                        timestamp: new Date().toISOString(),
                        userAgent: req.headers['user-agent'],
                        ip: req.ip
                    });
                } catch (jwtError) {
                    // Token might be expired or invalid, but that's okay for logout
                    console.log('Token verification failed during logout (expected if expired)');
                }
            }

            console.log('Logout successful');
            res.json({
                success: true,
                message: 'Logged out successfully'
            });

        } catch (error) {
            console.error('Logout error:', error);
            // Even if there's an error, we should still return success
            // because the client will clear local storage anyway
            res.json({
                success: true,
                message: 'Logged out successfully'
            });
        }
    }
}; 