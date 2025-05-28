import bcrypt from 'bcrypt';
import crypto from 'crypto';

export const settingsController = {
    // Get user settings/profile
    async getUserSettings(req, res) {
        try {
            const userEmail = req.user.email; // From JWT middleware
            const cosmosService = req.app.locals.cosmosService;

            const user = await cosmosService.getUserByEmail(userEmail);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            // Remove sensitive data
            const { password, securityAnswerHash, securitySalt, resetToken, resetTokenExpiry, ...userSettings } = user;

            res.json({
                success: true,
                user: userSettings
            });

        } catch (error) {
            console.error('❌ Get user settings error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve user settings'
            });
        }
    },

    // Update profile information
    async updateProfile(req, res) {
        try {
            const userEmail = req.user.email;
            const { name, email, phone, company } = req.body;
            const cosmosService = req.app.locals.cosmosService;

            // Validate required fields
            if (!name || !email) {
                return res.status(400).json({
                    success: false,
                    error: 'Name and email are required'
                });
            }

            // Get current user
            const currentUser = await cosmosService.getUserByEmail(userEmail);
            if (!currentUser) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            // Check if email is already taken by another user
            if (email !== userEmail) {
                const existingUser = await cosmosService.getUserByEmail(email.toLowerCase().trim());
                if (existingUser && existingUser.id !== currentUser.id) {
                    return res.status(400).json({
                        success: false,
                        error: 'Email is already taken by another user'
                    });
                }
            }

            // Update user profile
            const updatedUser = await cosmosService.updateDocument(currentUser.id, 'user', {
                name: name.trim(),
                email: email.toLowerCase().trim(),
                phone: phone ? phone.trim() : '',
                company: company ? company.trim() : '',
                updatedAt: new Date().toISOString()
            });

            // Remove sensitive data from response
            const { password, securityAnswerHash, securitySalt, resetToken, resetTokenExpiry, ...userResponse } = updatedUser;

            console.log('✅ Profile updated for user:', email);

            res.json({
                success: true,
                message: 'Profile updated successfully',
                user: userResponse
            });

        } catch (error) {
            console.error('❌ Update profile error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update profile'
            });
        }
    },

    // Change password
    async changePassword(req, res) {
        try {
            const userEmail = req.user.email;
            const { currentPassword, newPassword } = req.body;
            const cosmosService = req.app.locals.cosmosService;

            // Validate input
            if (!currentPassword || !newPassword) {
                return res.status(400).json({
                    success: false,
                    error: 'Current password and new password are required'
                });
            }

            if (newPassword.length < 6) {
                return res.status(400).json({
                    success: false,
                    error: 'New password must be at least 6 characters long'
                });
            }

            // Get user
            const user = await cosmosService.getUserByEmail(userEmail);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            // Verify current password
            const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
            if (!isCurrentPasswordValid) {
                return res.status(401).json({
                    success: false,
                    error: 'Current password is incorrect'
                });
            }

            // Hash new password
            const saltRounds = 12;
            const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

            // Update password
            await cosmosService.updateDocument(user.id, 'user', {
                password: hashedNewPassword,
                updatedAt: new Date().toISOString()
            });

            console.log('✅ Password changed for user:', user.email);

            res.json({
                success: true,
                message: 'Password changed successfully'
            });

        } catch (error) {
            console.error('❌ Change password error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to change password'
            });
        }
    },

    // Update security question
    async updateSecurityQuestion(req, res) {
        try {
            const userEmail = req.user.email;
            const { currentPassword, securityQuestion, securityAnswer } = req.body;
            const cosmosService = req.app.locals.cosmosService;

            // Validate input
            if (!currentPassword || !securityQuestion || !securityAnswer) {
                return res.status(400).json({
                    success: false,
                    error: 'Current password, security question, and answer are required'
                });
            }

            // Get user
            const user = await cosmosService.getUserByEmail(userEmail);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            // Verify current password
            const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
            if (!isPasswordValid) {
                return res.status(401).json({
                    success: false,
                    error: 'Current password is incorrect'
                });
            }

            // Hash security answer with salt
            const securitySalt = crypto.randomBytes(16).toString('hex');
            const normalizedAnswer = securityAnswer.trim().toLowerCase();
            const securityAnswerHash = crypto
                .pbkdf2Sync(normalizedAnswer, securitySalt, 10000, 64, 'sha512')
                .toString('hex');

            // Update security question and answer
            await cosmosService.updateDocument(user.id, 'user', {
                securityQuestion,
                securityAnswerHash,
                securitySalt,
                updatedAt: new Date().toISOString()
            });

            console.log('✅ Security question updated for user:', user.email);

            res.json({
                success: true,
                message: 'Security question updated successfully'
            });

        } catch (error) {
            console.error('❌ Update security question error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update security question'
            });
        }
    },

    // Update notification preferences
    async updateNotifications(req, res) {
        try {
            const userEmail = req.user.email;
            const { emailNotifications, smsNotifications, pushNotifications } = req.body;
            const cosmosService = req.app.locals.cosmosService;

            // Get user
            const user = await cosmosService.getUserByEmail(userEmail);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            // Update notification preferences
            await cosmosService.updateDocument(user.id, 'user', {
                notifications: {
                    email: emailNotifications !== undefined ? emailNotifications : true,
                    sms: smsNotifications !== undefined ? smsNotifications : false,
                    push: pushNotifications !== undefined ? pushNotifications : true
                },
                updatedAt: new Date().toISOString()
            });

            console.log('✅ Notification preferences updated for user:', user.email);

            res.json({
                success: true,
                message: 'Notification preferences updated successfully'
            });

        } catch (error) {
            console.error('❌ Update notifications error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update notification preferences'
            });
        }
    },

    // Delete account
    async deleteAccount(req, res) {
        try {
            const userEmail = req.user.email;
            const { password, confirmDelete } = req.body;
            const cosmosService = req.app.locals.cosmosService;

            // Validate input
            if (!password || confirmDelete !== 'DELETE') {
                return res.status(400).json({
                    success: false,
                    error: 'Password and confirmation required'
                });
            }

            // Get user
            const user = await cosmosService.getUserByEmail(userEmail);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            // Verify password
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                return res.status(401).json({
                    success: false,
                    error: 'Password is incorrect'
                });
            }

            // Mark account as deleted (soft delete)
            await cosmosService.updateDocument(user.id, 'user', {
                isActive: false,
                deletedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });

            console.log('✅ Account deleted for user:', user.email);

            res.json({
                success: true,
                message: 'Account has been deleted successfully'
            });

        } catch (error) {
            console.error('❌ Delete account error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to delete account'
            });
        }
    }
}; 