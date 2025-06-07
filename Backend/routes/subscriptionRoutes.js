import express from 'express';
import { SubscriptionService } from '../services/subscriptionService.js';
import subscriptionMiddleware from '../middleware/subscriptionMiddleware.js';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();
const subscriptionService = new SubscriptionService();

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

// Get user subscription dashboard
router.get('/dashboard', authenticateToken, subscriptionMiddleware.getSubscriptionStatus);

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
            message: 'Error retrieving subscription tiers'
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

export default router; 