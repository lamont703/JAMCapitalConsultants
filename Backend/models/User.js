import { CosmosService } from '../services/cosmosService.js';

export class User {
    constructor(userData = {}) {
        this.id = userData.id || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.type = 'user';
        this.name = userData.name || '';
        this.email = userData.email ? userData.email.toLowerCase().trim() : '';
        this.password = userData.password || '';
        this.phone = userData.phone ? userData.phone.trim() : '';
        this.company = userData.company ? userData.company.trim() : '';
        this.ghlContactId = userData.ghlContactId || null;
        this.ghlSyncStatus = userData.ghlSyncStatus || 'pending';
        this.role = userData.role || 'user'; // Add role field with default value
        this.isActive = userData.isActive !== undefined ? userData.isActive : true;
        this.securityQuestion = userData.securityQuestion || '';
        this.securityAnswerHash = userData.securityAnswerHash || '';
        this.securitySalt = userData.securitySalt || '';
        this.createdAt = userData.createdAt || new Date().toISOString();
        this.updatedAt = userData.updatedAt || new Date().toISOString();
        
        // NEW: Subscription and Credit Tracking Fields
        this.subscription = {
            tier: userData.subscription?.tier || 'free',
            status: userData.subscription?.status || 'active',
            remainingCredits: userData.subscription?.remainingCredits || 2, // Free trial starts with 2 credits
            totalCreditsUsed: userData.subscription?.totalCreditsUsed || 0,
            creditsIncluded: userData.subscription?.creditsIncluded || 2,
            subscriptionStartDate: userData.subscription?.subscriptionStartDate || new Date().toISOString(),
            subscriptionEndDate: userData.subscription?.subscriptionEndDate || null,
            lastCreditResetDate: userData.subscription?.lastCreditResetDate || new Date().toISOString(),
            hasTrialUsed: userData.subscription?.hasTrialUsed || false,
            paymentProvider: userData.subscription?.paymentProvider || null,
            externalSubscriptionId: userData.subscription?.externalSubscriptionId || null,
            planHistory: userData.subscription?.planHistory || []
        };
        
        // Initialize CosmosService
        this.cosmosService = new CosmosService();
    }

    // Validation methods
    validate() {
        const errors = [];
        
        if (!this.name || this.name.trim().length === 0) {
            errors.push('Name is required');
        }
        
        if (!this.email || this.email.trim().length === 0) {
            errors.push('Email is required');
        }
        
        if (!this.isValidEmail(this.email)) {
            errors.push('Invalid email format');
        }
        
        if (!this.password || this.password.length < 6) {
            errors.push('Password must be at least 6 characters');
        }

        // Validate subscription fields
        const validTiers = ['free', 'starter', 'professional', 'premium'];
        if (!validTiers.includes(this.subscription.tier)) {
            errors.push('Invalid subscription tier');
        }

        const validStatuses = ['active', 'expired', 'cancelled', 'suspended'];
        if (!validStatuses.includes(this.subscription.status)) {
            errors.push('Invalid subscription status');
        }

        if (this.subscription.remainingCredits < 0) {
            errors.push('Remaining credits cannot be negative');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Instance methods
    async save() {
        try {
            // Validate before saving
            const validation = this.validate();
            if (!validation.isValid) {
                throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
            }

            // Ensure CosmosService is initialized
            await this.cosmosService.initialize();

            // Update timestamp
            this.updatedAt = new Date().toISOString();
            
            // Prepare document for CosmosDB
            const document = {
                id: this.id,
                type: this.type,
                name: this.name.trim(),
                email: this.email.toLowerCase().trim(),
                password: this.password,
                phone: this.phone.trim(),
                company: this.company.trim(),
                ghlContactId: this.ghlContactId,
                ghlSyncStatus: this.ghlSyncStatus,
                role: this.role,
                isActive: this.isActive,
                securityQuestion: this.securityQuestion,
                securityAnswerHash: this.securityAnswerHash,
                securitySalt: this.securitySalt,
                createdAt: this.createdAt,
                updatedAt: this.updatedAt,
                subscription: this.subscription
            };

            // Save to CosmosDB (use upsert to handle both create and update)
            const result = await this.cosmosService.upsertDocument(document, 'user');
            
            // Update this instance with the saved data
            Object.assign(this, result);
            
            return this;
        } catch (error) {
            console.error('Error saving user:', error);
            throw error;
        }
    }

    toObject() {
        return {
            id: this.id,
            type: this.type,
            name: this.name,
            email: this.email,
            password: this.password,
            phone: this.phone,
            company: this.company,
            ghlContactId: this.ghlContactId,
            ghlSyncStatus: this.ghlSyncStatus,
            role: this.role,
            isActive: this.isActive,
            securityQuestion: this.securityQuestion,
            securityAnswerHash: this.securityAnswerHash,
            securitySalt: this.securitySalt,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            subscription: this.subscription
        };
    }

    // Static methods for database operations
    static async findOne(query) {
        try {
            const cosmosService = new CosmosService();
            await cosmosService.initialize();

            if (query.email) {
                return await cosmosService.getUserByEmail(query.email);
            }

            // For other queries, build dynamic query
            let sqlQuery = 'SELECT * FROM c WHERE c.type = @type';
            const parameters = [{ name: '@type', value: 'user' }];

            Object.keys(query).forEach((key, index) => {
                const paramName = `@${key}`;
                sqlQuery += ` AND c.${key} = ${paramName}`;
                parameters.push({ name: paramName, value: query[key] });
            });

            const results = await cosmosService.queryDocuments(sqlQuery, parameters);
            return results.length > 0 ? results[0] : null;
        } catch (error) {
            console.error('Error finding user:', error);
            throw error;
        }
    }

    static async findById(id) {
        try {
            const cosmosService = new CosmosService();
            await cosmosService.initialize();

            const query = 'SELECT * FROM c WHERE c.id = @id AND c.type = @type';
            const parameters = [
                { name: '@id', value: id },
                { name: '@type', value: 'user' }
            ];

            const results = await cosmosService.queryDocuments(query, parameters);
            return results.length > 0 ? results[0] : null;
        } catch (error) {
            console.error('Error finding user by ID:', error);
            throw error;
        }
    }

    static async findByEmail(email) {
        try {
            const cosmosService = new CosmosService();
            await cosmosService.initialize();

            const query = 'SELECT * FROM c WHERE c.email = @email AND c.type = @type';
            const parameters = [
                { name: '@email', value: email.toLowerCase().trim() },
                { name: '@type', value: 'user' }
            ];

            const results = await cosmosService.queryDocuments(query, parameters);
            return results.length > 0 ? results[0] : null;
        } catch (error) {
            console.error('Error finding user by email:', error);
            throw error;
        }
    }

    static async findByIdAndUpdate(id, updateData) {
        try {
            const cosmosService = new CosmosService();
            await cosmosService.initialize();

            // Add updatedAt timestamp
            updateData.updatedAt = new Date().toISOString();

            const result = await cosmosService.updateDocument(id, 'user', updateData);
            return result;
        } catch (error) {
            console.error('Error updating user:', error);
            throw error;
        }
    }

    static async find(query = {}) {
        try {
            const cosmosService = new CosmosService();
            await cosmosService.initialize();

            let sqlQuery = 'SELECT * FROM c WHERE c.type = @type';
            const parameters = [{ name: '@type', value: 'user' }];

            Object.keys(query).forEach((key, index) => {
                const paramName = `@${key}`;
                sqlQuery += ` AND c.${key} = ${paramName}`;
                parameters.push({ name: paramName, value: query[key] });
            });

            return await cosmosService.queryDocuments(sqlQuery, parameters);
        } catch (error) {
            console.error('Error finding users:', error);
            throw error;
        }
    }

    static async deleteOne(query) {
        try {
            const cosmosService = new CosmosService();
            await cosmosService.initialize();

            const user = await this.findOne(query);
            if (user) {
                await cosmosService.deleteDocument(user.id, 'user');
                return { deletedCount: 1 };
            }
            return { deletedCount: 0 };
        } catch (error) {
            console.error('Error deleting user:', error);
            throw error;
        }
    }

    // Utility methods for GHL sync
    async updateGHLSyncStatus(status, contactId = null) {
        try {
            const updateData = {
                ghlSyncStatus: status,
                updatedAt: new Date().toISOString()
            };

            if (contactId) {
                updateData.ghlContactId = contactId;
            }

            const result = await User.findByIdAndUpdate(this.id, updateData);
            
            // Update this instance
            this.ghlSyncStatus = status;
            if (contactId) this.ghlContactId = contactId;
            this.updatedAt = updateData.updatedAt;

            return result;
        } catch (error) {
            console.error('Error updating GHL sync status:', error);
            throw error;
        }
    }

    async updateLastLogin() {
        try {
            const cosmosService = new CosmosService();
            await cosmosService.initialize();

            return await cosmosService.updateUserLastLogin(this.id);
        } catch (error) {
            console.error('Error updating last login:', error);
            throw error;
        }
    }

    // NEW: Subscription Management Methods
    
    /**
     * Check if user has sufficient credits for an operation
     * @param {number} requiredCredits - Number of credits needed
     * @returns {Object} Result with canUse boolean and details
     */
    checkCredits(requiredCredits = 1) {
        const subscription = this.subscription;
        
        // Check if subscription is active
        if (subscription.status !== 'active') {
            return {
                canUse: false,
                reason: 'subscription_inactive',
                message: 'Your subscription is not active.',
                remainingCredits: subscription.remainingCredits
            };
        }

        // Check for expired paid subscriptions
        if (subscription.tier !== 'free' && subscription.subscriptionEndDate) {
            const endDate = new Date(subscription.subscriptionEndDate);
            const now = new Date();
            if (now > endDate) {
                return {
                    canUse: false,
                    reason: 'subscription_expired',
                    message: 'Your subscription has expired.',
                    remainingCredits: subscription.remainingCredits
                };
            }
        }

        // Check if sufficient credits available
        if (subscription.remainingCredits < requiredCredits) {
            return {
                canUse: false,
                reason: subscription.tier === 'free' ? 'free_trial_exhausted' : 'insufficient_credits',
                message: `You need ${requiredCredits} credits but only have ${subscription.remainingCredits}.`,
                remainingCredits: subscription.remainingCredits
            };
        }

        return {
            canUse: true,
            remainingCredits: subscription.remainingCredits,
            remainingAfter: subscription.remainingCredits - requiredCredits
        };
    }

    /**
     * Consume credits after successful operation
     * @param {number} creditsUsed - Number of credits to consume
     * @param {string} operation - Description of operation
     * @returns {boolean} Success status
     */
    async consumeCredits(creditsUsed = 1, operation = 'dispute_letter_generation') {
        try {
            const creditCheck = this.checkCredits(creditsUsed);
            if (!creditCheck.canUse) {
                throw new Error(`Cannot consume credits: ${creditCheck.message}`);
            }

            // Update credit counts
            this.subscription.remainingCredits -= creditsUsed;
            this.subscription.totalCreditsUsed += creditsUsed;
            this.updatedAt = new Date().toISOString();

            // Log the credit usage
            await this.logCreditUsage(creditsUsed, operation);

            // Save updated user data
            await this.save();

            console.log(`✅ Consumed ${creditsUsed} credits for user ${this.email}. Remaining: ${this.subscription.remainingCredits}`);
            return true;

        } catch (error) {
            console.error('Error consuming credits:', error);
            throw error;
        }
    }

    /**
     * Update user's subscription tier
     * @param {string} newTier - New subscription tier
     * @param {Object} options - Additional options
     */
    async updateSubscriptionTier(newTier, options = {}) {
        try {
            const validTiers = ['free', 'starter', 'professional', 'premium'];
            if (!validTiers.includes(newTier)) {
                throw new Error(`Invalid subscription tier: ${newTier}`);
            }

            const tierCredits = {
                free: 2,
                starter: 5,
                professional: 15,
                premium: 50
            };

            // Store old tier in history
            this.subscription.planHistory.push({
                tier: this.subscription.tier,
                changedAt: new Date().toISOString(),
                reason: options.reason || 'manual_update'
            });

            // Update subscription details
            this.subscription.tier = newTier;
            this.subscription.creditsIncluded = tierCredits[newTier];
            
            // Handle status update
            if (options.status) {
                this.subscription.status = options.status;
            }
            
            // Handle subscription dates
            if (options.subscriptionStartDate) {
                this.subscription.subscriptionStartDate = options.subscriptionStartDate;
            } else if (newTier !== 'free') {
                // For paid tiers, set start date to now if not provided
                this.subscription.subscriptionStartDate = new Date().toISOString();
            }
            
            if (options.subscriptionEndDate) {
                this.subscription.subscriptionEndDate = options.subscriptionEndDate;
            } else if (newTier === 'free') {
                // Free tier has no end date
                this.subscription.subscriptionEndDate = null;
            }
            
            // Handle external subscription data
            this.subscription.externalSubscriptionId = options.externalSubscriptionId || this.subscription.externalSubscriptionId;
            this.subscription.paymentProvider = options.paymentProvider || this.subscription.paymentProvider;
            
            // Reset credits to tier amount (unless specified otherwise)
            if (options.resetCredits !== false) {
                this.subscription.remainingCredits = tierCredits[newTier];
                this.subscription.lastCreditResetDate = new Date().toISOString();
            }

            this.updatedAt = new Date().toISOString();

            // Save updated user data
            await this.save();

            console.log(`✅ Updated subscription tier for user ${this.email} to ${newTier} (status: ${this.subscription.status})`);
            return this;

        } catch (error) {
            console.error('Error updating subscription tier:', error);
            throw error;
        }
    }

    /**
     * Replenish credits (for monthly renewals)
     * @param {number} creditsToAdd - Number of credits to add
     */
    async replenishCredits(creditsToAdd = null) {
        try {
            const tierCredits = {
                free: 2,
                starter: 5,
                professional: 15,
                premium: 50
            };

            const creditsAmount = creditsToAdd || tierCredits[this.subscription.tier] || 0;
            
            this.subscription.remainingCredits = creditsAmount;
            this.subscription.lastCreditResetDate = new Date().toISOString();
            this.updatedAt = new Date().toISOString();

            await this.save();

            console.log(`✅ Replenished ${creditsAmount} credits for user ${this.email}`);
            return this;

        } catch (error) {
            console.error('Error replenishing credits:', error);
            throw error;
        }
    }

    /**
     * Get subscription display information
     */
    getSubscriptionInfo() {
        const tierInfo = {
            free: { name: 'Free Trial', monthlyPrice: 0 },
            starter: { name: 'DIY Starter', monthlyPrice: 29 },
            professional: { name: 'DIY Professional', monthlyPrice: 59 },
            premium: { name: 'DIY Premium', monthlyPrice: 99 }
        };

        const tier = tierInfo[this.subscription.tier] || tierInfo.free;

        return {
            tierName: tier.name,
            tierCode: this.subscription.tier,
            monthlyPrice: tier.monthlyPrice,
            remainingCredits: this.subscription.remainingCredits,
            totalCreditsUsed: this.subscription.totalCreditsUsed,
            creditsIncluded: this.subscription.creditsIncluded,
            subscriptionStatus: this.subscription.status,
            subscriptionStartDate: this.subscription.subscriptionStartDate,
            subscriptionEndDate: this.subscription.subscriptionEndDate,
            hasTrialUsed: this.subscription.hasTrialUsed,
            canUpgrade: this.subscription.tier !== 'premium'
        };
    }

    /**
     * Log credit usage for analytics
     */
    async logCreditUsage(creditsUsed, operation) {
        try {
            await this.cosmosService.initialize();
            
            const logEntry = {
                id: `credit_log_${this.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                type: 'credit_usage',
                userId: this.id,
                userEmail: this.email,
                creditsUsed: creditsUsed,
                operation: operation,
                remainingCreditsAfter: this.subscription.remainingCredits - creditsUsed,
                subscriptionTier: this.subscription.tier,
                timestamp: new Date().toISOString()
            };

            await this.cosmosService.createDocument(logEntry, 'credit_usage');
        } catch (error) {
            console.error('Error logging credit usage:', error);
            // Don't throw - this is just for analytics
        }
    }
}

// Export both the class and a default export for compatibility
export default User; 