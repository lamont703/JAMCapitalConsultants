import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { ghlSyncMiddleware } from '../middleware/ghlSyncMiddleware.js';
import { User } from '../models/User.js';

export const authController = {
    async register(req, res) {
        try {
            const { name, email, password, phone, company, securityQuestion, securityAnswer, ...otherData } = req.body;
            
            console.log('🔍 === REGISTRATION DEBUG START ===');
            console.log('🔍 Registration started for:', email);
            console.log('🔍 Request body keys:', Object.keys(req.body));
            console.log('🔍 Environment check:');
            console.log('  - JWT_SECRET exists:', !!process.env.JWT_SECRET);
            console.log('  - JWT_SECRET length:', process.env.JWT_SECRET ? process.env.JWT_SECRET.length : 'undefined');
            
            // Get CosmosService from app.locals
            const cosmosService = req.app.locals.cosmosService;
            console.log('🔍 CosmosService check:', !!cosmosService);
            
            if (!cosmosService) {
                console.error('❌ CosmosService not available');
                return res.status(503).json({
                    success: false,
                    message: 'Database service not available'
                });
            }

            // Validate security question and answer
            if (!securityQuestion || !securityAnswer) {
                console.log('❌ Missing security question/answer');
                return res.status(400).json({
                    success: false,
                    message: 'Security question and answer are required'
                });
            }

            console.log('🔍 Checking for existing user...');
            // Check if user already exists
            const existingUser = await cosmosService.getUserByEmail(email);
            if (existingUser) {
                console.log('❌ User already exists:', email);
                return res.status(400).json({
                    success: false,
                    message: 'User already exists with this email'
                });
            }
            console.log('✅ No existing user found');

            console.log('🔍 Hashing password...');
            // Hash password
            const saltRounds = 12;
            const hashedPassword = await bcrypt.hash(password, saltRounds);
            console.log('✅ Password hashed successfully');

            console.log('🔍 Hashing security answer...');
            // Hash security answer with salt
            const securitySalt = crypto.randomBytes(16).toString('hex');
            const normalizedAnswer = securityAnswer.trim().toLowerCase();
            const securityAnswerHash = crypto
                .pbkdf2Sync(normalizedAnswer, securitySalt, 10000, 64, 'sha512')
                .toString('hex');
            console.log('✅ Security answer hashed successfully');

            console.log('🔍 Creating User model...');
            // Create user using User model to ensure Free Tier subscription is assigned
            const user = new User({
                name: name.trim(),
                email: email.toLowerCase().trim(),
                password: hashedPassword,
                phone: phone ? phone.trim() : '',
                company: company ? company.trim() : '',
                securityQuestion: securityQuestion,
                securityAnswerHash: securityAnswerHash,
                securitySalt: securitySalt,
                ghlContactId: null,
                ghlSyncStatus: 'pending'
            });
            console.log('✅ User model created');

            console.log('💾 Saving user to database...');
            // Save user using User model's save method to ensure proper validation and subscription assignment
            const savedUser = await user.save();
            console.log('✅ User saved to database:', savedUser.id);

            console.log('🔍 Starting GHL sync...');
            // Sync to GoHighLevel CRM
            try {
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
            } catch (ghlError) {
                console.error('❌ GHL sync threw exception:', ghlError);
                // Continue with registration even if GHL fails
            }

            console.log('🔍 Generating JWT token...');
            console.log('🔍 JWT_SECRET check before signing:', !!process.env.JWT_SECRET);
            
            // Generate JWT token
            let token;
            try {
                token = jwt.sign(
                    { 
                        userId: savedUser.id, 
                        email: savedUser.email,
                        role: savedUser.role || 'user'
                    },
                    process.env.JWT_SECRET,
                    { expiresIn: '7d' }
                );
                console.log('✅ JWT token generated successfully');
            } catch (jwtError) {
                console.error('❌ JWT token generation failed:', jwtError);
                throw new Error(`JWT generation failed: ${jwtError.message}`);
            }

            console.log('🔍 Preparing response...');
            // Remove sensitive data from response
            const { password: _, securityAnswerHash: __, securitySalt: ___, ...userResponse } = savedUser;

            console.log('✅ Registration successful for:', email);
            console.log('🔍 === REGISTRATION DEBUG END ===');

            res.status(201).json({
                success: true,
                message: 'User registered successfully',
                user: userResponse,
                token: token
            });

        } catch (error) {
            console.error('❌ === REGISTRATION ERROR DETAILS ===');
            console.error('❌ Error name:', error.name);
            console.error('❌ Error message:', error.message);
            console.error('❌ Error stack:', error.stack);
            console.error('❌ Full error object:', error);
            console.error('❌ === END ERROR DETAILS ===');
            
            res.status(500).json({ 
                success: false, 
                error: 'Registration failed. Please try again.' 
            });
        }
    },

    // Add method to verify security answer for password reset
    async verifySecurityAnswer(req, res) {
        try {
            const { email, securityAnswer } = req.body;

            if (!email || !securityAnswer) {
                return res.status(400).json({
                    success: false,
                    error: 'Email and security answer are required'
                });
            }

            const cosmosService = req.app.locals.cosmosService;
            const user = await cosmosService.getUserByEmail(email.toLowerCase().trim());

            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            // Verify security answer
            const normalizedAnswer = securityAnswer.trim().toLowerCase();
            const hashedAnswer = crypto
                .pbkdf2Sync(normalizedAnswer, user.securitySalt, 10000, 64, 'sha512')
                .toString('hex');

            if (hashedAnswer !== user.securityAnswerHash) {
                return res.status(401).json({
                    success: false,
                    error: 'Incorrect security answer'
                });
            }

            res.json({
                success: true,
                message: 'Security answer verified',
                securityQuestion: user.securityQuestion
            });

        } catch (error) {
            console.error('❌ Security verification error:', error);
            res.status(500).json({
                success: false,
                error: 'Verification failed'
            });
        }
    },

    async login(req, res) {
        try {
            const { email, password } = req.body;

            console.log('🔍 Login attempt for:', email);

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
                console.log('❌ User not found:', email);
                return res.status(401).json({ 
                    success: false, 
                    error: 'Invalid email or password' 
                });
            }

            console.log('👤 User found:', user.email, 'isActive:', user.isActive);

            // Check if user is active (only reject if explicitly set to false)
            if (user.isActive === false) {
                console.log('❌ Account deactivated:', email);
                return res.status(401).json({ 
                    success: false, 
                    error: 'Account is deactivated. Please contact support.' 
                });
            }

            // Verify password
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                console.log('❌ Invalid password for:', email);
                return res.status(401).json({ 
                    success: false, 
                    error: 'Invalid email or password' 
                });
            }

            // Generate JWT token
            const token = jwt.sign(
                { 
                    id: user.id,
                    email: user.email,
                    role: user.role || 'user'
                },
                process.env.JWT_SECRET || 'your-secret-key',
                { expiresIn: '24h' }
            );

            // Update last login
            try {
                await cosmosService.updateDocument(user.id, 'user', {
                    lastLoginAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
            } catch (updateError) {
                console.log('⚠️ Failed to update last login:', updateError.message);
                // Don't fail login if we can't update last login
            }

            // Remove password from response
            const { password: _, ...userResponse } = user;

            console.log('✅ Login successful for:', email);

            res.json({
                success: true,
                message: 'Login successful',
                user: userResponse,
                token: token
            });

        } catch (error) {
            console.error('❌ Login error:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Login failed. Please try again.' 
            });
        }
    },

    async logout(req, res) {
        try {
            console.log('🔄 Logout request received');

            const token = req.headers.authorization?.replace('Bearer ', '');
            const cosmosService = req.app.locals.cosmosService;

            if (token && cosmosService) {
                try {
                    const decoded = jwt.verify(token, process.env.JWT_SECRET);
                    console.log('📝 Logging logout activity for user:', decoded.userId);
                } catch (jwtError) {
                    console.log('⚠️ Token verification failed during logout (expected if expired)');
                }
            }

            console.log('✅ Logout successful');
            res.json({
                success: true,
                message: 'Logged out successfully'
            });

        } catch (error) {
            console.error('❌ Logout error:', error);
            res.json({
                success: true,
                message: 'Logged out successfully'
            });
        }
    },

    async forgotPassword(req, res) {
        try {
            const { email } = req.body;

            console.log('🔍 Password reset request for:', email);

            if (!email) {
                return res.status(400).json({
                    success: false,
                    error: 'Email is required'
                });
            }

            const cosmosService = req.app.locals.cosmosService;

            // Find user by email
            const user = await cosmosService.getUserByEmail(email.toLowerCase().trim());
            if (!user) {
                // Don't reveal if user exists or not for security
                return res.json({
                    success: true,
                    message: 'If an account with that email exists, a password reset link has been sent.'
                });
            }

            // Generate reset token
            const resetToken = crypto.randomBytes(32).toString('hex');
            const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

            // Save reset token to user document
            await cosmosService.updateDocument(user.id, 'user', {
                resetToken: resetToken,
                resetTokenExpiry: resetTokenExpiry.toISOString(),
                updatedAt: new Date().toISOString()
            });

            // TODO: Send email with reset link (in production, send via email service)
            // For now, we'll log the reset link (in production, send via email service)
            const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
            console.log('🔗 Password reset link for', email, ':', resetLink);

            // In production, you would send an email here
            // await emailService.sendPasswordResetEmail(user.email, resetLink);

            console.log('✅ Password reset token generated for:', email);

            res.json({
                success: true,
                message: 'If an account with that email exists, a password reset link has been sent.',
                // Remove this in production - only for development
                resetLink: process.env.NODE_ENV === 'development' ? resetLink : undefined
            });

        } catch (error) {
            console.error('❌ Forgot password error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to process password reset request'
            });
        }
    },

    async resetPassword(req, res) {
        try {
            const { token, newPassword } = req.body;

            console.log('🔍 Password reset attempt with token:', token?.substring(0, 8) + '...');

            if (!token || !newPassword) {
                return res.status(400).json({
                    success: false,
                    error: 'Reset token and new password are required'
                });
            }

            if (newPassword.length < 6) {
                return res.status(400).json({
                    success: false,
                    error: 'Password must be at least 6 characters long'
                });
            }

            const cosmosService = req.app.locals.cosmosService;

            // Find user by reset token
            const user = await cosmosService.getUserByResetToken(token);
            if (!user) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid or expired reset token'
                });
            }

            // Check if token is expired
            const now = new Date();
            const tokenExpiry = new Date(user.resetTokenExpiry);
            if (now > tokenExpiry) {
                return res.status(400).json({
                    success: false,
                    error: 'Reset token has expired. Please request a new password reset.'
                });
            }

            // Hash new password
            const saltRounds = 12;
            const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

            // Update user password and clear reset token
            await cosmosService.updateDocument(user.id, 'user', {
                password: hashedPassword,
                resetToken: null,
                resetTokenExpiry: null,
                updatedAt: new Date().toISOString()
            });

            console.log('✅ Password reset successful for user:', user.email);

            res.json({
                success: true,
                message: 'Password has been reset successfully. You can now log in with your new password.'
            });

        } catch (error) {
            console.error('❌ Reset password error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to reset password'
            });
        }
    },

    async getSecurityQuestion(req, res) {
        try {
            const { email } = req.body;

            if (!email) {
                return res.status(400).json({
                    success: false,
                    error: 'Email is required'
                });
            }

            const cosmosService = req.app.locals.cosmosService;
            const user = await cosmosService.getUserByEmail(email.toLowerCase().trim());

            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'No account found with this email address'
                });
            }

            res.json({
                success: true,
                securityQuestion: user.securityQuestion
            });

        } catch (error) {
            console.error('❌ Get security question error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve security question'
            });
        }
    },

    async resetPasswordWithSecurity(req, res) {
        try {
            const { email, newPassword } = req.body;

            if (!email || !newPassword) {
                return res.status(400).json({
                    success: false,
                    error: 'Email and new password are required'
                });
            }

            if (newPassword.length < 6) {
                return res.status(400).json({
                    success: false,
                    error: 'Password must be at least 6 characters long'
                });
            }

            const cosmosService = req.app.locals.cosmosService;
            const user = await cosmosService.getUserByEmail(email.toLowerCase().trim());

            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            // Hash new password
            const saltRounds = 12;
            const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

            // Update user password
            await cosmosService.updateDocument(user.id, 'user', {
                password: hashedPassword,
                updatedAt: new Date().toISOString()
            });

            console.log('✅ Password reset successful for user:', user.email);

            res.json({
                success: true,
                message: 'Password has been reset successfully'
            });

        } catch (error) {
            console.error('❌ Reset password with security error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to reset password'
            });
        }
    }
}; 