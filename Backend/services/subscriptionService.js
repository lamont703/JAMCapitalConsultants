import { CosmosService } from './cosmosService.js';
import { User } from '../models/User.js';

export class SubscriptionService {
    constructor() {
        this.cosmosService = new CosmosService();
        this.isInitialized = false;
    }

    async initialize() {
        if (!this.isInitialized) {
            await this.cosmosService.initialize();
            this.isInitialized = true;
        }
        return this;
    }

    /**
     * Get user's current subscription information
     * @param {string} userId - User ID
     * @returns {Object} Subscription information
     */
    async getUserSubscription(userId) {
        try {
            await this.initialize();
            
            console.log(`🔍 Looking up user with ID: "${userId}" (type: ${typeof userId})`);
            const user = await User.findById(userId);
            if (!user) {
                console.log(`❌ User not found in database: "${userId}"`);
                
                // Try to find user by email if userId looks like an email
                if (userId && userId.includes('@')) {
                    console.log(`🔄 Attempting to find user by email: ${userId}`);
                    const userByEmail = await User.findByEmail(userId);
                    if (userByEmail) {
                        console.log(`✅ Found user by email: ${userByEmail.id}`);
                        // Recursively call with the correct user ID
                        return await this.getUserSubscription(userByEmail.id);
                    }
                }
                
                // For development/testing - provide a demo user experience
                if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
                    console.log(`⚠️ User ${userId} not found, returning demo subscription data for development`);
                    return {
                        userId: userId,
                        tier: 'demo',
                        tierConfig: {
                            name: 'Demo User',
                            monthlyCredits: 3,
                            features: ['Demo mode', 'Limited functionality'],
                            limits: {}
                        },
                        subscriptionEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
                        isActive: true,
                        currentUsage: { disputeLetters: 0, totalOperations: 0 },
                        remainingCredits: 3,
                        canGenerateDispute: { allowed: true, reason: 'Demo mode' },
                        features: ['Demo mode', 'Limited functionality'],
                        limits: {},
                        isDemoUser: true
                    };
                }
                throw new Error('User not found');
            }

            // Get subscription data from the user's subscription object
            const subscription = user.subscription || {};
            const subscriptionTier = subscription.tier || user.subscriptionTier || 'none';
            const tierConfig = this.SUBSCRIPTION_TIERS[subscriptionTier];
            
            console.log(`🔍 User subscription data:`, subscription);
            console.log(`🔍 Subscription tier: "${subscriptionTier}"`);
            console.log(`🔍 Tier config found:`, tierConfig ? 'Yes' : 'No');
            
            // Use subscription end date from the subscription object
            const subscriptionEndDate = subscription.subscriptionEndDate || user.subscriptionEndDate;
            
            // Calculate current period usage
            const monthStart = new Date();
            monthStart.setDate(1);
            monthStart.setHours(0, 0, 0, 0);
            
            const usage = await this.getMonthlyUsage(userId, monthStart);
            
            // Calculate remaining credits and active status based on tier type
            let remainingCredits;
            let isActive;
            let daysUntilExpiration = null;
            
            if (subscriptionTier === 'free') {
                // Free tier: lifetime credits, no expiration
                remainingCredits = subscription.remainingCredits || 0;
                isActive = subscription.status === 'active';
                daysUntilExpiration = null; // No expiration for free tier
            } else {
                // Paid tiers: monthly credits with expiration
                const monthlyLimit = tierConfig?.monthlyCredits || 0;
                remainingCredits = Math.max(0, monthlyLimit - usage.disputeLetters);
                
                if (subscriptionEndDate) {
                    const endDate = new Date(subscriptionEndDate);
                    const now = new Date();
                    isActive = now < endDate;
                    
                    if (isActive) {
                        const timeDiff = endDate.getTime() - now.getTime();
                        daysUntilExpiration = Math.ceil(timeDiff / (1000 * 3600 * 24));
                    } else {
                        daysUntilExpiration = 0;
                    }
                } else {
                    isActive = false;
                    daysUntilExpiration = 0;
                }
            }
            
            console.log(`🔍 Final values: tier=${subscriptionTier}, isActive=${isActive}, remainingCredits=${remainingCredits}, daysUntilExpiration=${daysUntilExpiration}`);
            
            return {
                userId,
                tier: subscriptionTier,
                tierConfig,
                subscriptionEndDate,
                isActive,
                currentUsage: usage,
                remainingCredits,
                daysUntilExpiration,
                canGenerateDispute: this.canUserGenerateDispute(user, usage, tierConfig),
                features: tierConfig?.features || [],
                limits: tierConfig?.limits || {},
                isDemoUser: false
            };
        } catch (error) {
            console.error('Error getting user subscription:', error);
            throw error;
        }
    }

    /**
     * Check if user can perform an operation requiring credits
     * @param {string} userId - User ID
     * @param {number} requiredCredits - Number of credits needed
     * @returns {Object} Credit check result
     */
    async checkUserCredits(userId, requiredCredits = 1) {
        try {
            await this.initialize();
            
            const user = await User.findById(userId);
            if (!user) {
                // For development/testing - provide a demo user experience
                if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
                    console.log(`User ${userId} not found, returning demo credit check for development`);
                    return {
                        canUse: true,
                        reason: 'Demo mode - unlimited credits',
                        message: 'Demo user has unlimited credits',
                        remainingCredits: 999,
                        isDemoUser: true
                    };
                }
                throw new Error('User not found');
            }

            // Create User instance to access methods
            const userInstance = new User(user);
            return userInstance.checkCredits(requiredCredits);
        } catch (error) {
            console.error('Error checking user credits:', error);
            throw error;
        }
    }

    /**
     * Consume credits after successful operation
     * @param {string} userId - User ID
     * @param {number} creditsUsed - Number of credits to consume
     * @param {string} operation - Operation description
     * @returns {Object} Updated subscription info
     */
    async consumeUserCredits(userId, creditsUsed = 1, operation = 'dispute_letter_generation') {
        try {
            await this.initialize();
            
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            // Create User instance to access methods
            const userInstance = new User(user);
            await userInstance.consumeCredits(creditsUsed, operation);
            
            return userInstance.getSubscriptionInfo();
        } catch (error) {
            console.error('Error consuming user credits:', error);
            throw error;
        }
    }

    /**
     * Update user's subscription tier (for manual admin updates or payment processing)
     * @param {string} userId - User ID
     * @param {string} newTier - New subscription tier
     * @param {Object} options - Additional options
     * @returns {Object} Updated subscription info
     */
    async updateUserSubscriptionTier(userId, newTier, options = {}) {
        try {
            await this.initialize();
            
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            // Create User instance to access methods
            const userInstance = new User(user);
            await userInstance.updateSubscriptionTier(newTier, options);
            
            return userInstance.getSubscriptionInfo();
        } catch (error) {
            console.error('Error updating user subscription tier:', error);
            throw error;
        }
    }

    /**
     * Replenish user's credits (for subscription renewals)
     * @param {string} userId - User ID
     * @param {number} creditsToAdd - Number of credits to add (null for tier default)
     * @returns {Object} Updated subscription info
     */
    async replenishUserCredits(userId, creditsToAdd = null) {
        try {
            await this.initialize();
            
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            // Create User instance to access methods
            const userInstance = new User(user);
            await userInstance.replenishCredits(creditsToAdd);
            
            return userInstance.getSubscriptionInfo();
        } catch (error) {
            console.error('Error replenishing user credits:', error);
            throw error;
        }
    }

    /**
     * Get subscription analytics and usage data
     * @param {string} userId - User ID (optional, for specific user)
     * @returns {Object} Analytics data
     */
    async getSubscriptionAnalytics(userId = null) {
        try {
            await this.initialize();
            
            let query, parameters;

            if (userId) {
                // Get analytics for specific user
                query = `
                    SELECT * FROM c 
                    WHERE c.type = @type 
                    AND c.userId = @userId 
                    ORDER BY c.timestamp DESC
                `;
                parameters = [
                    { name: '@type', value: 'credit_usage' },
                    { name: '@userId', value: userId }
                ];
            } else {
                // Get analytics for all users
                query = `
                    SELECT * FROM c 
                    WHERE c.type = @type 
                    ORDER BY c.timestamp DESC
                `;
                parameters = [
                    { name: '@type', value: 'credit_usage' }
                ];
            }

            const creditUsageLogs = await this.cosmosService.queryDocuments(query, parameters);

            // Get user subscription summary
            const userQuery = `
                SELECT c.id, c.email, c.subscription FROM c 
                WHERE c.type = @type
                ${userId ? 'AND c.id = @userId' : ''}
            `;
            const userParams = userId 
                ? [{ name: '@type', value: 'user' }, { name: '@userId', value: userId }]
                : [{ name: '@type', value: 'user' }];

            const users = await this.cosmosService.queryDocuments(userQuery, userParams);

            return {
                creditUsageLogs: creditUsageLogs,
                userSubscriptions: users,
                summary: this.calculateAnalyticsSummary(users, creditUsageLogs)
            };
        } catch (error) {
            console.error('Error getting subscription analytics:', error);
            throw error;
        }
    }

    /**
     * Calculate analytics summary
     * @private
     */
    calculateAnalyticsSummary(users, creditLogs) {
        const summary = {
            totalUsers: users.length,
            tierBreakdown: {},
            totalCreditsUsed: 0,
            avgCreditsPerUser: 0,
            mostActiveUsers: []
        };

        // Calculate tier breakdown
        users.forEach(user => {
            const tier = user.subscription?.tier || 'free';
            summary.tierBreakdown[tier] = (summary.tierBreakdown[tier] || 0) + 1;
        });

        // Calculate credit usage
        summary.totalCreditsUsed = creditLogs.reduce((total, log) => total + (log.creditsUsed || 0), 0);
        summary.avgCreditsPerUser = users.length > 0 ? summary.totalCreditsUsed / users.length : 0;

        // Find most active users
        const userCreditUsage = {};
        creditLogs.forEach(log => {
            if (!userCreditUsage[log.userId]) {
                userCreditUsage[log.userId] = { userId: log.userId, email: log.userEmail, totalCredits: 0 };
            }
            userCreditUsage[log.userId].totalCredits += log.creditsUsed || 0;
        });

        summary.mostActiveUsers = Object.values(userCreditUsage)
            .sort((a, b) => b.totalCredits - a.totalCredits)
            .slice(0, 10);

        return summary;
    }

    /**
     * Get all users with expired subscriptions
     * @returns {Array} Users with expired subscriptions
     */
    async getExpiredSubscriptions() {
        try {
            await this.initialize();
            
            const now = new Date().toISOString();
            const query = `
                SELECT * FROM c 
                WHERE c.type = @type 
                AND c.subscription.subscriptionEndDate < @now
                AND c.subscription.status = @status
            `;
            const parameters = [
                { name: '@type', value: 'user' },
                { name: '@now', value: now },
                { name: '@status', value: 'active' }
            ];

            return await this.cosmosService.queryDocuments(query, parameters);
        } catch (error) {
            console.error('Error getting expired subscriptions:', error);
            throw error;
        }
    }

    /**
     * Process expired subscriptions (downgrade to free tier)
     * @returns {Array} Processed users
     */
    async processExpiredSubscriptions() {
        try {
            const expiredUsers = await this.getExpiredSubscriptions();
            const processedUsers = [];

            for (const userData of expiredUsers) {
                try {
                    const userInstance = new User(userData);
                    await userInstance.updateSubscriptionTier('free', {
                        reason: 'subscription_expired',
                        resetCredits: false // Keep any remaining credits
                    });
                    
                    // Update status to expired
                    userInstance.subscription.status = 'expired';
                    await userInstance.save();

                    processedUsers.push({
                        userId: userData.id,
                        email: userData.email,
                        previousTier: userData.subscription.tier,
                        processed: true
                    });

                    console.log(`✅ Processed expired subscription for user ${userData.email}`);
                } catch (error) {
                    console.error(`❌ Error processing expired subscription for user ${userData.email}:`, error);
                    processedUsers.push({
                        userId: userData.id,
                        email: userData.email,
                        processed: false,
                        error: error.message
                    });
                }
            }

            return processedUsers;
        } catch (error) {
            console.error('Error processing expired subscriptions:', error);
            throw error;
        }
    }

    /**
     * Validate subscription before expensive operations (ChatGPT API calls)
     * @param {string} userId - User ID
     * @param {string} operation - Operation type
     * @returns {Object} Validation result
     */
    async validateSubscriptionForOperation(userId, operation = 'credit_analysis') {
        try {
            const creditCheck = await this.checkUserCredits(userId, 1);
            
            return {
                canProceed: creditCheck.canUse,
                reason: creditCheck.reason || 'valid',
                message: creditCheck.message || 'Operation approved',
                remainingCredits: creditCheck.remainingCredits,
                subscriptionInfo: await this.getUserSubscription(userId)
            };
        } catch (error) {
            console.error('Error validating subscription for operation:', error);
            return {
                canProceed: false,
                reason: 'validation_error',
                message: 'Unable to validate subscription',
                error: error.message
            };
        }
    }

    /**
     * Log payment events from GoHighLevel
     * @param {string} userId - User ID
     * @param {Object} paymentData - Payment event data
     * @returns {Object} Log entry
     */
    async logPaymentEvent(userId, paymentData) {
        try {
            await this.initialize();
            
            const logEntry = {
                id: `payment_log_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                type: 'payment_event',
                userId: userId,
                event: paymentData.event,
                productName: paymentData.productName || null,
                amount: paymentData.amount || null,
                transactionId: paymentData.transactionId || null,
                subscriptionId: paymentData.subscriptionId || null,
                ghlContactId: paymentData.ghlContactId || null,
                failureReason: paymentData.failureReason || null,
                cancellationReason: paymentData.cancellationReason || null,
                metadata: paymentData,
                timestamp: new Date().toISOString()
            };

            const result = await this.cosmosService.createDocument(logEntry, 'payment_event');
            console.log(`✅ Payment event logged: ${paymentData.event} for user ${userId}`);
            return result;
        } catch (error) {
            console.error('Error logging payment event:', error);
            throw error;
        }
    }

    /**
     * Get payment history for a user
     * @param {string} userId - User ID
     * @returns {Array} Payment events
     */
    async getPaymentHistory(userId) {
        try {
            await this.initialize();
            
            const query = `
                SELECT * FROM c 
                WHERE c.type = @type 
                AND c.userId = @userId 
                ORDER BY c.timestamp DESC
            `;
            const parameters = [
                { name: '@type', value: 'payment_event' },
                { name: '@userId', value: userId }
            ];

            return await this.cosmosService.queryDocuments(query, parameters);
        } catch (error) {
            console.error('Error getting payment history:', error);
            throw error;
        }
    }

    /**
     * Get subscription metrics for business intelligence
     * @returns {Object} Subscription metrics
     */
    async getSubscriptionMetrics() {
        try {
            await this.initialize();
            
            // Get all payment events
            const paymentQuery = 'SELECT * FROM c WHERE c.type = @type ORDER BY c.timestamp DESC';
            const paymentParams = [{ name: '@type', value: 'payment_event' }];
            const paymentEvents = await this.cosmosService.queryDocuments(paymentQuery, paymentParams);
            
            // Get all users with subscriptions
            const userQuery = 'SELECT c.id, c.email, c.subscription FROM c WHERE c.type = @type';
            const userParams = [{ name: '@type', value: 'user' }];
            const users = await this.cosmosService.queryDocuments(userQuery, userParams);
            
            // Calculate metrics
            const metrics = {
                totalUsers: users.length,
                paidUsers: users.filter(u => u.subscription?.tier && u.subscription.tier !== 'free').length,
                freeUsers: users.filter(u => !u.subscription?.tier || u.subscription.tier === 'free').length,
                
                // Revenue calculations
                monthlyRevenue: 0,
                totalRevenue: 0,
                
                // Subscription distribution
                tierDistribution: {},
                
                // Payment events
                recentPayments: paymentEvents.slice(0, 10),
                paymentFailures: paymentEvents.filter(e => e.event === 'payment_failed').length,
                cancellations: paymentEvents.filter(e => e.event === 'subscription_cancelled').length
            };
            
            // Calculate revenue and tier distribution
            const tierPrices = { starter: 29, professional: 59, premium: 99 };
            users.forEach(user => {
                const tier = user.subscription?.tier || 'free';
                metrics.tierDistribution[tier] = (metrics.tierDistribution[tier] || 0) + 1;
                
                if (tier !== 'free' && user.subscription?.status === 'active') {
                    metrics.monthlyRevenue += tierPrices[tier] || 0;
                }
            });
            
            // Calculate total revenue from successful payments
            metrics.totalRevenue = paymentEvents
                .filter(e => e.event === 'payment_success' && e.amount)
                .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
            
            return metrics;
        } catch (error) {
            console.error('Error getting subscription metrics:', error);
            throw error;
        }
    }

    // Subscription tier configurations matching the payment plans
    SUBSCRIPTION_TIERS = {
        free: {
            name: 'Free Trial',
            price: 0,
            monthlyCredits: 2, // Lifetime total, not monthly
            isLifetime: true,
            features: [
                '2 dispute letters (lifetime)',
                'Basic templates only',
                'Email support',
                'Limited AI analysis'
            ],
            limits: {
                disputeLettersPerMonth: 2,
                advancedFeatures: false,
                prioritySupport: false,
                creditMonitoring: false,
                premiumTemplates: false,
                phoneSupport: false,
                analytics: false
            }
        },
        starter: {
            name: 'DIY Starter',
            price: 29,
            monthlyCredits: 5,
            additionalLetterCost: 4.99,
            features: [
                '5 dispute letters included',
                'All templates + AI optimization',
                'Priority email support',
                '$4.99 per additional letter'
            ],
            limits: {
                disputeLettersPerMonth: 5,
                advancedFeatures: true,
                prioritySupport: true,
                creditMonitoring: false,
                premiumTemplates: false,
                phoneSupport: false
            }
        },
        professional: {
            name: 'DIY Professional',
            price: 59,
            monthlyCredits: 15,
            additionalLetterCost: 3.99,
            features: [
                '15 dispute letters included',
                'Advanced letter customization',
                'Multi-bureau coordination',
                'Phone + email support',
                '$3.99 per additional letter'
            ],
            limits: {
                disputeLettersPerMonth: 15,
                advancedFeatures: true,
                prioritySupport: true,
                creditMonitoring: true,
                premiumTemplates: true,
                phoneSupport: true
            }
        },
        premium: {
            name: 'DIY Premium',
            price: 99,
            monthlyCredits: 50,
            additionalLetterCost: 2.99,
            features: [
                '50 dispute letters included',
                'Custom letter templates',
                'Legal review option',
                'Dedicated support line',
                '$2.99 per additional letter'
            ],
            limits: {
                disputeLettersPerMonth: 50,
                advancedFeatures: true,
                prioritySupport: true,
                creditMonitoring: true,
                premiumTemplates: true,
                phoneSupport: true,
                analytics: true,
                legalReview: true
            }
        }
    };

    // Check if user can generate a dispute letter
    canUserGenerateDispute(user, usage, tierConfig) {
        // Check if subscription is active
        if (new Date() >= new Date(user.subscriptionEndDate)) {
            return { allowed: false, reason: 'Subscription expired' };
        }
        
        // Check monthly limits
        if (tierConfig?.limits?.disputeLettersPerMonth === -1) {
            return { allowed: true, reason: 'Unlimited plan' };
        }
        
        const monthlyLimit = tierConfig?.limits?.disputeLettersPerMonth || 0;
        if (usage.disputeLetters >= monthlyLimit) {
            return { 
                allowed: false, 
                reason: `Monthly limit of ${monthlyLimit} dispute letters reached` 
            };
        }
        
        return { allowed: true, reason: 'Within limits' };
    }

    // Get monthly usage for a user
    async getMonthlyUsage(userId, monthStart = null) {
        try {
            if (!monthStart) {
                monthStart = new Date();
                monthStart.setDate(1);
                monthStart.setHours(0, 0, 0, 0);
            }
            
            const monthEnd = new Date(monthStart);
            monthEnd.setMonth(monthEnd.getMonth() + 1);
            
            // Query usage from activities/logs
            const query = `
                SELECT * FROM c 
                WHERE c.userId = @userId 
                AND c.type = @type 
                AND c.timestamp >= @startDate 
                AND c.timestamp < @endDate
            `;
            
            const parameters = [
                { name: '@userId', value: userId },
                { name: '@type', value: 'dispute_letter_generated' },
                { name: '@startDate', value: monthStart.toISOString() },
                { name: '@endDate', value: monthEnd.toISOString() }
            ];

            const activities = await this.cosmosService.queryDocuments(query, parameters);
            
            return {
                disputeLetters: activities.length,
                monthStart,
                monthEnd: new Date(monthEnd.getTime() - 1) // Subtract 1ms to get end of previous day
            };
        } catch (error) {
            console.error('Error getting monthly usage:', error);
            return { disputeLetters: 0, monthStart, monthEnd: new Date() };
        }
    }

    // Log dispute letter generation
    async logDisputeLetterGeneration(userId) {
        try {
            const activityId = `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            await this.cosmosService.createDocument('activities', {
                id: activityId,
                userId,
                type: 'dispute_letter_generated',
                timestamp: new Date().toISOString(),
                data: {
                    action: 'dispute_letter_generated'
                }
            });
            
            console.log(`Logged dispute letter generation for user ${userId}`);
            return true;
        } catch (error) {
            console.error('Error logging dispute letter generation:', error);
            throw error;
        }
    }

    // Reset monthly credits (to be called monthly via cron job)
    async resetMonthlyCredits() {
        try {
            console.log('Starting monthly credit reset...');
            
            // This could be implemented as a batch operation
            // For now, we'll rely on real-time calculation based on monthly usage
            
            console.log('Monthly credit reset completed');
            return true;
        } catch (error) {
            console.error('Error resetting monthly credits:', error);
            throw error;
        }
    }

    // Check subscription expiration and send notifications
    async checkSubscriptionExpirations() {
        try {
            const warningDate = new Date();
            warningDate.setDate(warningDate.getDate() + 7); // 7 days before expiration
            
            const query = `
                SELECT * FROM c 
                WHERE c.subscriptionEndDate <= @warningDate 
                AND c.subscriptionEndDate > @now
                AND (c.expirationWarningPent != true OR NOT IS_DEFINED(c.expirationWarningPent))
            `;
            
            const parameters = [
                { name: '@warningDate', value: warningDate.toISOString() },
                { name: '@now', value: new Date().toISOString() }
            ];

            const expiringUsers = await this.cosmosService.queryDocuments(query, parameters);
            
            for (const user of expiringUsers) {
                // Send expiration warning
                await this.sendExpirationWarning(user);
                
                // Mark warning as sent
                await this.cosmosService.updateDocument('users', user.id, {
                    ...user,
                    expirationWarningPent: true,
                    lastModified: new Date().toISOString()
                });
            }
            
            console.log(`Processed ${expiringUsers.length} subscription expiration warnings`);
            return expiringUsers.length;
        } catch (error) {
            console.error('Error checking subscription expirations:', error);
            throw error;
        }
    }

    // Send expiration warning notification
    async sendExpirationWarning(user) {
        try {
            // This would integrate with your notification system
            console.log(`Sending expiration warning to user ${user.email}`);
            
            // Add notification to user's notifications
            const notificationId = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            await this.cosmosService.createDocument('notifications', {
                id: notificationId,
                userId: user.id,
                type: 'subscription_expiring',
                title: 'Subscription Expiring Soon',
                message: `Your ${user.subscriptionTier} subscription will expire on ${new Date(user.subscriptionEndDate).toLocaleDateString()}. Renew now to continue accessing your credit repair tools.`,
                timestamp: new Date().toISOString(),
                read: false,
                data: {
                    subscriptionTier: user.subscriptionTier,
                    expirationDate: user.subscriptionEndDate
                }
            });
            
            return true;
        } catch (error) {
            console.error('Error sending expiration warning:', error);
            throw error;
        }
    }

    // Upgrade user subscription
    async upgradeSubscription(userId, newTier, paymentData) {
        try {
            const user = await this.cosmosService.getDocument('users', userId);
            if (!user) {
                throw new Error('User not found');
            }
            
            const oldTier = user.subscriptionTier;
            const newTierConfig = this.SUBSCRIPTION_TIERS[newTier];
            
            if (!newTierConfig) {
                throw new Error('Invalid subscription tier');
            }
            
            // Update user subscription
            const updatedUser = {
                ...user,
                subscriptionTier: newTier,
                lastModified: new Date().toISOString()
            };
            
            await this.cosmosService.updateDocument('users', userId, updatedUser);
            
            // Log the upgrade
            await this.logPaymentEvent(userId, {
                ...paymentData,
                type: 'subscription_upgrade',
                oldTier,
                newTier
            });
            
            console.log(`Upgraded user ${userId} from ${oldTier} to ${newTier}`);
            return { success: true, oldTier, newTier };
        } catch (error) {
            console.error('Error upgrading subscription:', error);
            throw error;
        }
    }

    /**
     * Get dispute letter usage statistics for user
     * @param {string} userId - User ID
     * @returns {Object} Usage statistics
     */
    async getDisputeLetterUsage(userId) {
        try {
            await this.initialize();
            
            // Calculate current month boundaries
            const monthStart = new Date();
            monthStart.setDate(1);
            monthStart.setHours(0, 0, 0, 0);
            
            const monthEnd = new Date(monthStart);
            monthEnd.setMonth(monthEnd.getMonth() + 1);
            
            // Get all-time dispute letters
            const allTimeQuery = `
                SELECT * FROM c 
                WHERE c.type = @type 
                AND (c.userId = @userId OR c.letterData.userInfo.userId = @userId)
                ORDER BY c.createdAt DESC
            `;
            
            const allTimeParams = [
                { name: '@type', value: 'dispute_letter' },
                { name: '@userId', value: userId }
            ];
            
            const allLetters = await this.cosmosService.queryDocuments(allTimeQuery, allTimeParams);
            
            // Get current month's dispute letters
            const monthlyQuery = `
                SELECT * FROM c 
                WHERE c.type = @type 
                AND (c.userId = @userId OR c.letterData.userInfo.userId = @userId)
                AND c.createdAt >= @monthStart 
                AND c.createdAt < @monthEnd
                ORDER BY c.createdAt DESC
            `;
            
            const monthlyParams = [
                { name: '@type', value: 'dispute_letter' },
                { name: '@userId', value: userId },
                { name: '@monthStart', value: monthStart.toISOString() },
                { name: '@monthEnd', value: monthEnd.toISOString() }
            ];
            
            const monthlyLetters = await this.cosmosService.queryDocuments(monthlyQuery, monthlyParams);
            
            console.log(`📊 Dispute letter usage for user ${userId}:`, {
                totalCount: allLetters.length,
                monthlyCount: monthlyLetters.length,
                monthStart: monthStart.toISOString(),
                monthEnd: monthEnd.toISOString()
            });
            
            return {
                totalLettersGenerated: allLetters.length,
                monthlyLettersUsed: monthlyLetters.length,
                monthStart: monthStart.toISOString(),
                monthEnd: monthEnd.toISOString(),
                letters: allLetters,
                monthlyLetters: monthlyLetters
            };
        } catch (error) {
            console.error('Error getting dispute letter usage:', error);
            return {
                totalLettersGenerated: 0,
                monthlyLettersUsed: 0,
                monthStart: new Date().toISOString(),
                monthEnd: new Date().toISOString(),
                letters: [],
                monthlyLetters: []
            };
        }
    }

    // Get subscription status for dashboard
    async getSubscriptionDashboard(userId) {
        try {
            const subscription = await this.getUserSubscription(userId);
            const paymentHistory = await this.getPaymentHistory(userId);
            const disputeLetterUsage = await this.getDisputeLetterUsage(userId);
            
            // Calculate days until expiration
            const daysUntilExpiration = Math.ceil(
                (new Date(subscription.subscriptionEndDate) - new Date()) / (1000 * 60 * 60 * 24)
            );

            // Calculate monthly remaining letters with enhanced debugging - use subscription.tier not subscriptionTier
            const userTier = subscription.tier || 'free';
            const tierConfig = this.SUBSCRIPTION_TIERS[userTier] || this.SUBSCRIPTION_TIERS['free'];
            const monthlyLimit = tierConfig.limits?.disputeLettersPerMonth || 0;
            const monthlyRemaining = Math.max(0, monthlyLimit - disputeLetterUsage.monthlyLettersUsed);
            
            // Enhanced debugging for monthly calculation
            console.log(`🔍 Monthly Remaining Calculation Debug for user ${userId}:`, {
                userTier: userTier,
                tierConfig: tierConfig,
                monthlyLimit: monthlyLimit,
                monthlyLettersUsed: disputeLetterUsage.monthlyLettersUsed,
                calculatedRemaining: monthlyRemaining,
                remainingCredits: subscription.remainingCredits
            });
            
            // Make sure monthly remaining doesn't exceed remaining credits for paid plans
            let finalMonthlyRemaining = monthlyRemaining;
            if (userTier !== 'free') {
                finalMonthlyRemaining = Math.min(monthlyRemaining, subscription.remainingCredits || 0);
                console.log(`🔄 Adjusted monthly remaining for ${userTier}: ${finalMonthlyRemaining}`);
            }
            
            return {
                ...subscription,
                daysUntilExpiration,
                paymentHistory: paymentHistory.slice(0, 5), // Last 5 payments
                disputeLetterUsage: {
                    totalLettersGenerated: disputeLetterUsage.totalLettersGenerated,
                    monthlyLettersUsed: disputeLetterUsage.monthlyLettersUsed,
                    monthlyLimit: monthlyLimit,
                    monthlyRemaining: finalMonthlyRemaining,
                    monthStart: disputeLetterUsage.monthStart,
                    monthEnd: disputeLetterUsage.monthEnd
                },
                needsRenewal: daysUntilExpiration <= 7,
                status: subscription.isActive ? 'active' : 'expired'
            };
        } catch (error) {
            console.error('Error getting subscription dashboard:', error);
            throw error;
        }
    }
} 