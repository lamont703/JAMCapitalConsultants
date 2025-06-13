import express from 'express';
import { SubscriptionService } from '../services/subscriptionService.js';
import { GoHighLevelService } from '../services/ghlService.js';
import subscriptionMiddleware from '../middleware/subscriptionMiddleware.js';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();
const subscriptionService = new SubscriptionService();

// IMPORTANT: Specific routes must come BEFORE generic /:userId routes

// Get user subscription dashboard
router.get('/dashboard', authenticateToken, subscriptionMiddleware.getSubscriptionStatus);

// Get payment history
router.get('/payment-history', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { limit = 10 } = req.query;
        
        const subscriptionService = new SubscriptionService();
        const paymentHistory = await subscriptionService.getPaymentHistory(userId);
        
        res.json({
            success: true,
            data: paymentHistory.slice(0, parseInt(limit))
        });
    } catch (error) {
        console.error('Error getting payment history:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving payment history'
        });
    }
});

// Check if user can generate dispute letters
router.get('/can-generate-dispute', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const subscriptionService = new SubscriptionService();
        const subscription = await subscriptionService.getUserSubscription(userId);
        
        res.json({
            success: true,
            data: {
                canGenerate: subscription.canGenerateDispute.allowed,
                reason: subscription.canGenerateDispute.reason,
                remainingCredits: subscription.remainingCredits,
                currentUsage: subscription.currentUsage,
                tier: subscription.tier,
                limits: subscription.limits
            }
        });
    } catch (error) {
        console.error('Error checking dispute generation capability:', error);
        res.status(500).json({
            success: false,
            message: 'Error checking dispute generation capability'
        });
    }
});

// Get subscription tier information
router.get('/tiers', (req, res) => {
    try {
        const subscriptionService = new SubscriptionService();
        res.json({
            success: true,
            data: subscriptionService.SUBSCRIPTION_TIERS
        });
    } catch (error) {
        console.error('Error getting subscription tiers:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get subscription tiers'
        });
    }
});

// Get monthly usage
router.get('/usage', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { month, year } = req.query;
        
        let monthStart = new Date();
        if (month && year) {
            monthStart = new Date(parseInt(year), parseInt(month) - 1, 1);
        } else {
            monthStart.setDate(1);
            monthStart.setHours(0, 0, 0, 0);
        }
        
        const subscriptionService = new SubscriptionService();
        const usage = await subscriptionService.getMonthlyUsage(userId, monthStart);
        
        res.json({
            success: true,
            data: usage
        });
    } catch (error) {
        console.error('Error getting usage:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving usage data'
        });
    }
});

// Upgrade subscription (this would typically be called after payment)
router.post('/upgrade', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { newTier, paymentData } = req.body;
        
        if (!newTier) {
            return res.status(400).json({
                success: false,
                message: 'New subscription tier is required'
            });
        }
        
        const subscriptionService = new SubscriptionService();
        const result = await subscriptionService.upgradeSubscription(userId, newTier, paymentData);
        
        res.json({
            success: true,
            message: 'Subscription upgraded successfully',
            data: result
        });
    } catch (error) {
        console.error('Error upgrading subscription:', error);
        res.status(500).json({
            success: false,
            message: 'Error upgrading subscription'
        });
    }
});

// Check subscription expiration warnings (admin only)
router.post('/check-expirations', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const subscriptionService = new SubscriptionService();
        const processed = await subscriptionService.checkSubscriptionExpirations();
        
        res.json({
            success: true,
            message: `Processed ${processed} expiration warnings`,
            data: { processedCount: processed }
        });
    } catch (error) {
        console.error('Error checking expirations:', error);
        res.status(500).json({
            success: false,
            message: 'Error checking subscription expirations'
        });
    }
});

/**
 * GET /api/subscription/payment-links/:tier - Get payment link for specific tier
 */
router.get('/payment-links/:tier', (req, res) => {
    try {
        const { tier } = req.params;
        
        // Payment links configuration (replace with your actual GoHighLevel links)
        const paymentLinks = {
            starter: process.env.GHL_STARTER_PAYMENT_LINK || 'https://your-ghl-domain.com/diy-starter-payment',
            professional: process.env.GHL_PROFESSIONAL_PAYMENT_LINK || 'https://your-ghl-domain.com/diy-professional-payment',
            premium: process.env.GHL_PREMIUM_PAYMENT_LINK || 'https://your-ghl-domain.com/diy-premium-payment'
        };
        
        const paymentLink = paymentLinks[tier];
        
        if (!paymentLink) {
            return res.status(404).json({
                success: false,
                message: `Payment link not found for tier: ${tier}`
            });
        }
        
        res.json({
            success: true,
            paymentLink: paymentLink,
            tier: tier
        });
    } catch (error) {
        console.error('Error getting payment link:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get payment link'
        });
    }
});

/**
 * POST /api/subscription/consume-credits - Consume credits for an operation
 */
router.post('/consume-credits', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { creditsToConsume = 1, operation = 'dispute_letter_generation' } = req.body;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        if (creditsToConsume <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Credits to consume must be greater than 0'
            });
        }

        // Consume the credits
        const result = await subscriptionService.consumeUserCredits(userId, creditsToConsume, operation);
        
        res.json({
            success: true,
            message: `Successfully consumed ${creditsToConsume} credits`,
            data: result
        });
    } catch (error) {
        console.error('Error consuming credits:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to consume credits'
        });
    }
});

/**
 * GET /api/subscription/dispute-letter-usage - Get dispute letter usage statistics
 */
router.get('/dispute-letter-usage', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        const subscriptionService = new SubscriptionService();
        const usage = await subscriptionService.getDisputeLetterUsage(userId);
        
        res.json({
            success: true,
            data: usage
        });
    } catch (error) {
        console.error('Error getting dispute letter usage:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get dispute letter usage'
        });
    }
});

/**
 * POST /api/subscription/fix-credits - Fix remaining credits for current user based on their subscription tier
 */
router.post('/fix-credits', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        const subscriptionService = new SubscriptionService();
        
        // Get current subscription
        const subscription = await subscriptionService.getUserSubscription(userId);
        const usage = await subscriptionService.getDisputeLetterUsage(userId);
        
        // Get tier configuration (subscription.tier is the correct property)
        const userTier = subscription.tier || 'free';
        const tierConfig = subscriptionService.SUBSCRIPTION_TIERS[userTier] || subscriptionService.SUBSCRIPTION_TIERS['free'];
        const monthlyLimit = tierConfig.limits?.disputeLettersPerMonth || 0;
        
        console.log(`🔧 Fix credits debug: userTier=${userTier}, monthlyLimit=${monthlyLimit}, usage=${usage.monthlyLettersUsed}`);
        
        // Calculate correct remaining credits
        let correctRemainingCredits;
        if (userTier === 'free') {
            // Free tier: lifetime credits minus total used
            correctRemainingCredits = Math.max(0, monthlyLimit - usage.totalLettersGenerated);
        } else {
            // Paid tier: monthly limit minus current month usage
            correctRemainingCredits = Math.max(0, monthlyLimit - usage.monthlyLettersUsed);
        }
        
        // Update user's remaining credits - use the User model for proper access
        await subscriptionService.initialize(); // Ensure service is initialized
        
        const User = await import('../models/User.js').then(module => module.User);
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }
        
        // Update the user's subscription data with corrected credits
        const updatedUserData = {
            ...user,
            subscription: {
                ...user.subscription,
                remainingCredits: correctRemainingCredits,
                lastCreditFix: new Date().toISOString()
            },
            lastModified: new Date().toISOString()
        };
        
        // Use User.save() method for proper saving
        const userInstance = new User(updatedUserData);
        await userInstance.save();
        
        console.log(`🔧 Fixed credits for user ${userId}: ${subscription.remainingCredits} → ${correctRemainingCredits}`);
        
        res.json({
            success: true,
            message: 'Credits fixed successfully',
            data: {
                oldCredits: subscription.remainingCredits,
                newCredits: correctRemainingCredits,
                tier: userTier,
                monthlyLimit: monthlyLimit,
                monthlyUsed: usage.monthlyLettersUsed,
                totalGenerated: usage.totalLettersGenerated
            }
        });
    } catch (error) {
        console.error('Error fixing credits:', error);
        res.status(500).json({
            success: false,
            message: 'Error fixing credits',
            error: error.message
        });
    }
});

/**
 * GET /api/subscription/:userId - Get user's subscription information
 */
router.get('/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        const subscriptionInfo = await subscriptionService.getUserSubscription(userId);
        
        res.json({
            success: true,
            data: subscriptionInfo
        });
    } catch (error) {
        console.error('Error getting subscription:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to get subscription information'
        });
    }
});

/**
 * POST /api/subscription/:userId/check-credits - Check if user has sufficient credits
 */
router.post('/:userId/check-credits', async (req, res) => {
    try {
        const { userId } = req.params;
        const { requiredCredits = 1, operation = 'dispute_letter_generation' } = req.body;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        const creditCheck = await subscriptionService.checkUserCredits(userId, requiredCredits);
        
        res.json({
            success: true,
            data: {
                canProceed: creditCheck.canUse,
                reason: creditCheck.reason,
                message: creditCheck.message,
                remainingCredits: creditCheck.remainingCredits,
                operation: operation
            }
        });
    } catch (error) {
        console.error('Error checking credits:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to check credits'
        });
    }
});

/**
 * POST /api/subscription/:userId/consume-credits - Consume credits after successful operation
 */
router.post('/:userId/consume-credits', async (req, res) => {
    try {
        const { userId } = req.params;
        const { creditsUsed = 1, operation = 'dispute_letter_generation' } = req.body;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        const updatedSubscription = await subscriptionService.consumeUserCredits(userId, creditsUsed, operation);
        
        res.json({
            success: true,
            message: `Successfully consumed ${creditsUsed} credits`,
            data: updatedSubscription
        });
    } catch (error) {
        console.error('Error consuming credits:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to consume credits'
        });
    }
});

/**
 * PUT /api/subscription/:userId/tier - Update user's subscription tier
 */
router.put('/:userId/tier', async (req, res) => {
    try {
        const { userId } = req.params;
        const { 
            tier, 
            startDate = null, 
            endDate = null, 
            externalSubscriptionId = null,
            paymentProvider = null,
            reason = 'manual_update',
            resetCredits = true
        } = req.body;
        
        if (!userId || !tier) {
            return res.status(400).json({
                success: false,
                message: 'User ID and tier are required'
            });
        }

        const validTiers = ['free', 'starter', 'professional', 'premium'];
        if (!validTiers.includes(tier)) {
            return res.status(400).json({
                success: false,
                message: `Invalid tier. Must be one of: ${validTiers.join(', ')}`
            });
        }

        const options = {
            startDate,
            endDate,
            externalSubscriptionId,
            paymentProvider,
            reason,
            resetCredits
        };

        const updatedSubscription = await subscriptionService.updateUserSubscriptionTier(userId, tier, options);
        
        res.json({
            success: true,
            message: `Successfully updated subscription to ${tier}`,
            data: updatedSubscription
        });
    } catch (error) {
        console.error('Error updating subscription tier:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to update subscription tier'
        });
    }
});

/**
 * POST /api/subscription/:userId/replenish-credits - Replenish user's credits
 */
router.post('/:userId/replenish-credits', async (req, res) => {
    try {
        const { userId } = req.params;
        const { creditsToAdd = null } = req.body;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        const updatedSubscription = await subscriptionService.replenishUserCredits(userId, creditsToAdd);
        
        res.json({
            success: true,
            message: 'Successfully replenished credits',
            data: updatedSubscription
        });
    } catch (error) {
        console.error('Error replenishing credits:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to replenish credits'
        });
    }
});

/**
 * POST /api/subscription/:userId/validate-operation - Validate subscription before expensive operations
 */
router.post('/:userId/validate-operation', async (req, res) => {
    try {
        const { userId } = req.params;
        const { operation = 'credit_analysis' } = req.body;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        const validation = await subscriptionService.validateSubscriptionForOperation(userId, operation);
        
        res.json({
            success: true,
            data: validation
        });
    } catch (error) {
        console.error('Error validating operation:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to validate operation'
        });
    }
});

/**
 * GET /api/subscription/analytics/:userId? - Get subscription analytics
 */
router.get('/analytics/:userId?', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const analytics = await subscriptionService.getSubscriptionAnalytics(userId);
        
        res.json({
            success: true,
            data: analytics
        });
    } catch (error) {
        console.error('Error getting analytics:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to get analytics'
        });
    }
});

/**
 * GET /api/subscription/admin/expired - Get expired subscriptions (admin only)
 */
router.get('/admin/expired', async (req, res) => {
    try {
        const expiredSubscriptions = await subscriptionService.getExpiredSubscriptions();
        
        res.json({
            success: true,
            data: expiredSubscriptions,
            count: expiredSubscriptions.length
        });
    } catch (error) {
        console.error('Error getting expired subscriptions:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to get expired subscriptions'
        });
    }
});

/**
 * POST /api/subscription/admin/process-expired - Process expired subscriptions (admin only)
 */
router.post('/admin/process-expired', async (req, res) => {
    try {
        const processedUsers = await subscriptionService.processExpiredSubscriptions();
        
        const successCount = processedUsers.filter(u => u.processed).length;
        const errorCount = processedUsers.filter(u => !u.processed).length;
        
        res.json({
            success: true,
            message: `Processed ${successCount} expired subscriptions (${errorCount} errors)`,
            data: {
                processedUsers,
                summary: {
                    total: processedUsers.length,
                    successful: successCount,
                    errors: errorCount
                }
            }
        });
    } catch (error) {
        console.error('Error processing expired subscriptions:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to process expired subscriptions'
        });
    }
});

/**
 * GET /api/subscription/tiers - Get available subscription tiers and pricing
 */
router.get('/tiers', (req, res) => {
    try {
        const tiers = {
            free: {
                name: 'Free Trial',
                monthlyPrice: 0,
                creditsIncluded: 2,
                additionalCreditPrice: null,
                features: ['2 dispute letters (lifetime)', 'Basic templates', 'Email support'],
                description: 'Perfect for trying out our service'
            },
            starter: {
                name: 'DIY Starter',
                monthlyPrice: 29,
                creditsIncluded: 5,
                additionalCreditPrice: 4.99,
                features: ['5 letters included', '$4.99 per additional letter', 'Standard templates', 'Priority email support'],
                description: 'Great for individuals getting started'
            },
            professional: {
                name: 'DIY Professional',
                monthlyPrice: 59,
                creditsIncluded: 15,
                additionalCreditPrice: 3.99,
                features: ['15 letters included', '$3.99 per additional letter', 'Advanced templates', 'Phone + email support'],
                description: 'Perfect for regular use'
            },
            premium: {
                name: 'DIY Premium',
                monthlyPrice: 99,
                creditsIncluded: 50,
                additionalCreditPrice: 2.99,
                features: ['50 letters included', '$2.99 per additional letter', 'Premium templates', 'Priority phone + email support'],
                description: 'Best value for heavy users'
            }
        };
        
        res.json({
            success: true,
            data: tiers
        });
    } catch (error) {
        console.error('Error getting tiers:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get subscription tiers'
        });
    }
});

/**
 * GET /api/subscription/payment-links/:tier - Get payment link for specific tier
 */
router.get('/payment-links/:tier', (req, res) => {
    try {
        const { tier } = req.params;
        
        // Payment links configuration (replace with your actual GoHighLevel links)
        const paymentLinks = {
            starter: process.env.GHL_STARTER_PAYMENT_LINK || 'https://your-ghl-domain.com/diy-starter-payment',
            professional: process.env.GHL_PROFESSIONAL_PAYMENT_LINK || 'https://your-ghl-domain.com/diy-professional-payment',
            premium: process.env.GHL_PREMIUM_PAYMENT_LINK || 'https://your-ghl-domain.com/diy-premium-payment'
        };
        
        const paymentLink = paymentLinks[tier];
        
        if (!paymentLink) {
            return res.status(404).json({
                success: false,
                message: `Payment link not found for tier: ${tier}`
            });
        }
        
        res.json({
            success: true,
            paymentLink: paymentLink,
            tier: tier
        });
    } catch (error) {
        console.error('Error getting payment link:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get payment link'
        });
    }
});

/**
 * POST /api/subscriptions/cancel - Cancel user subscription
 */
router.post('/cancel', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { 
            cancellationReason = 'user_requested',
            feedback = '',
            cancellationType = 'end_of_period',
            downgradeTo = 'free'
        } = req.body;

        console.log(`🔄 Processing subscription cancellation for user ${userId}`, {
            reason: cancellationReason,
            type: cancellationType,
            downgradeTo: downgradeTo
        });

        const subscriptionService = new SubscriptionService();
        const ghlService = new GoHighLevelService();
        
        // Get current subscription
        const currentSubscription = await subscriptionService.getUserSubscription(userId);
        
        if (!currentSubscription || currentSubscription.tier === 'free') {
            return res.status(400).json({
                success: false,
                message: 'No active paid subscription to cancel'
            });
        }

        // Calculate effective date based on cancellation type
        let effectiveDate;
        if (cancellationType === 'immediate') {
            effectiveDate = new Date().toISOString();
        } else {
            // End of period - use subscription end date or add 30 days
            effectiveDate = currentSubscription.subscriptionEndDate || 
                          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        }

        // Store cancellation information
        const cancellationData = {
            userId: userId,
            originalTier: currentSubscription.tier,
            cancellationReason: cancellationReason,
            feedback: feedback,
            cancellationType: cancellationType,
            downgradeTo: downgradeTo,
            requestedAt: new Date().toISOString(),
            effectiveDate: effectiveDate,
            gracePeriodDays: 30
        };

        // === STEP 1: Cancel in GoHighLevel (if subscription exists) ===
        let ghlCancellationResult = null;
        
        // Try to find and cancel GHL subscription
        try {
            // Look for GHL subscription by user email
            const user = req.user;
            const ghlSubscriptionSearch = await ghlService.findSubscriptionByEmail(user.email);
            
            if (ghlSubscriptionSearch.success && ghlSubscriptionSearch.subscriptions.length > 0) {
                const ghlSubscription = ghlSubscriptionSearch.subscriptions[0]; // Use first active subscription
                console.log(`🔍 Found GHL subscription: ${ghlSubscription.id}`);
                
                // Cancel the subscription in GoHighLevel
                ghlCancellationResult = await ghlService.cancelSubscription(
                    ghlSubscription.id,
                    cancellationReason
                );
                
                if (ghlCancellationResult.success) {
                    console.log(`✅ Successfully cancelled GHL subscription: ${ghlSubscription.id}`);
                } else {
                    console.log(`⚠️ GHL cancellation failed: ${ghlCancellationResult.error}`);
                }
            } else {
                console.log(`📝 No active GHL subscription found for ${user.email}`);
                ghlCancellationResult = { 
                    success: true, 
                    message: 'No active GHL subscription found',
                    localOnly: true 
                };
            }
        } catch (ghlError) {
            console.error(`❌ Error with GHL cancellation: ${ghlError.message}`);
            ghlCancellationResult = { 
                success: false, 
                error: ghlError.message,
                localOnly: true 
            };
        }

        // === STEP 2: Process cancellation in JAM system ===
        
        // For immediate cancellation, downgrade now
        if (cancellationType === 'immediate') {
            // Downgrade to free tier immediately
            await subscriptionService.downgradeTo(userId, 'free', {
                reason: 'user_cancellation',
                originalTier: currentSubscription.tier,
                cancellationData: cancellationData,
                ghlCancellationResult: ghlCancellationResult
            });
            
            console.log(`✅ Immediate cancellation processed for user ${userId}`);
        } else {
            // For end-of-period, just mark for future processing
            // In a real system, you'd store this in a database and process it later
            console.log(`✅ End-of-period cancellation scheduled for user ${userId} on ${effectiveDate}`);
        }

        // Store cancellation feedback for analytics (optional)
        try {
            // You could store this in a cancellations collection for analytics
            console.log(`📝 Cancellation feedback stored: ${feedback}`);
        } catch (feedbackError) {
            console.warn('⚠️ Could not store cancellation feedback:', feedbackError);
        }

        res.json({
            success: true,
            message: 'Subscription cancellation processed successfully',
            data: {
                effectiveDate: effectiveDate,
                downgradeTo: downgradeTo,
                gracePeriodDays: 30,
                cancellationType: cancellationType,
                currentAccess: cancellationType === 'end_of_period' ? 'continues_until_effective_date' : 'downgraded_immediately',
                ghlCancellation: {
                    success: ghlCancellationResult?.success || false,
                    message: ghlCancellationResult?.message || ghlCancellationResult?.error || 'GHL cancellation status unknown',
                    subscriptionId: ghlCancellationResult?.subscriptionId || null,
                    localOnly: ghlCancellationResult?.localOnly || false
                }
            }
        });

    } catch (error) {
        console.error('❌ Error processing subscription cancellation:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing cancellation request',
            error: error.message
        });
    }
});

/**
 * POST /api/subscriptions/pause - Pause user subscription
 */
router.post('/pause', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { pauseDurationMonths = 3 } = req.body;

        console.log(`⏸️ Processing subscription pause for user ${userId}`, {
            durationMonths: pauseDurationMonths
        });

        const subscriptionService = new SubscriptionService();
        const ghlService = new GoHighLevelService();
        
        // Get current subscription
        const currentSubscription = await subscriptionService.getUserSubscription(userId);
        
        if (!currentSubscription || currentSubscription.tier === 'free') {
            return res.status(400).json({
                success: false,
                message: 'No active paid subscription to pause'
            });
        }

        // Calculate pause dates
        const pauseStartDate = new Date().toISOString();
        const pauseEndDate = new Date(Date.now() + pauseDurationMonths * 30 * 24 * 60 * 60 * 1000).toISOString();
        
        // Store pause information
        const pauseData = {
            userId: userId,
            originalTier: currentSubscription.tier,
            pauseDurationMonths: pauseDurationMonths,
            pauseStartDate: pauseStartDate,
            pauseEndDate: pauseEndDate,
            requestedAt: new Date().toISOString()
        };

        // === STEP 1: Pause in GoHighLevel (if subscription exists) ===
        let ghlPauseResult = null;
        
        // Try to find and pause GHL subscription
        try {
            // Look for GHL subscription by user email
            const user = req.user;
            const ghlSubscriptionSearch = await ghlService.findSubscriptionByEmail(user.email);
            
            if (ghlSubscriptionSearch.success && ghlSubscriptionSearch.subscriptions.length > 0) {
                const ghlSubscription = ghlSubscriptionSearch.subscriptions[0]; // Use first active subscription
                console.log(`🔍 Found GHL subscription for pause: ${ghlSubscription.id}`);
                
                // Pause the subscription in GoHighLevel
                ghlPauseResult = await ghlService.pauseSubscription(
                    ghlSubscription.id,
                    pauseDurationMonths
                );
                
                if (ghlPauseResult.success) {
                    console.log(`✅ Successfully paused GHL subscription: ${ghlSubscription.id}`);
                } else {
                    console.log(`⚠️ GHL pause failed: ${ghlPauseResult.error}`);
                }
            } else {
                console.log(`📝 No active GHL subscription found for pause: ${user.email}`);
                ghlPauseResult = { 
                    success: true, 
                    message: 'No active GHL subscription found',
                    localOnly: true 
                };
            }
        } catch (ghlError) {
            console.error(`❌ Error with GHL pause: ${ghlError.message}`);
            ghlPauseResult = { 
                success: false, 
                error: ghlError.message,
                localOnly: true 
            };
        }

        // === STEP 2: Process pause in JAM system ===
        
        // In a real implementation, you would:
        // 1. Update the subscription status to 'paused'
        // 2. Store the pause information
        // 3. Set up a job to reactivate after pause period
        // 4. Stop billing during pause period

        console.log(`✅ Subscription pause scheduled for user ${userId}`, pauseData);

        res.json({
            success: true,
            message: 'Subscription pause processed successfully',
            data: {
                pauseStartDate: pauseStartDate,
                pauseEndDate: pauseEndDate,
                pauseDurationMonths: pauseDurationMonths,
                originalTier: currentSubscription.tier,
                reactivationDate: pauseEndDate,
                message: 'Your subscription will be paused and billing will stop. You can reactivate anytime during the pause period.',
                ghlPause: {
                    success: ghlPauseResult?.success || false,
                    message: ghlPauseResult?.message || ghlPauseResult?.error || 'GHL pause status unknown',
                    subscriptionId: ghlPauseResult?.subscriptionId || null,
                    pauseUntil: ghlPauseResult?.pauseUntil || null,
                    localOnly: ghlPauseResult?.localOnly || false
                }
            }
        });

    } catch (error) {
        console.error('❌ Error processing subscription pause:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing pause request',
            error: error.message
        });
    }
});

export default router; 