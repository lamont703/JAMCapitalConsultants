import { SubscriptionService } from '../services/subscriptionService.js';

// Subscription middleware to check user permissions
export async function requireActiveSubscription(req, res, next) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User authentication required'
            });
        }

        const subscriptionService = new SubscriptionService();
        const subscription = await subscriptionService.getUserSubscription(userId);

        if (!subscription.isActive) {
            return res.status(403).json({
                success: false,
                message: 'Active subscription required',
                data: {
                    subscriptionStatus: 'expired',
                    expirationDate: subscription.subscriptionEndDate
                }
            });
        }

        // Add subscription info to request
        req.subscription = subscription;
        next();
    } catch (error) {
        console.error('Subscription middleware error:', error);
        res.status(500).json({
            success: false,
            message: 'Error checking subscription status'
        });
    }
}

// Middleware to check if user can generate dispute letters
export async function requireDisputeLetterCredit(req, res, next) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User authentication required'
            });
        }

        const subscriptionService = new SubscriptionService();
        const subscription = await subscriptionService.getUserSubscription(userId);
        
        if (!subscription.canGenerateDispute.allowed) {
            return res.status(403).json({
                success: false,
                message: subscription.canGenerateDispute.reason,
                data: {
                    currentUsage: subscription.currentUsage,
                    remainingCredits: subscription.remainingCredits,
                    tier: subscription.tier,
                    needsUpgrade: subscription.tier === 'starter'
                }
            });
        }

        // Add subscription info to request
        req.subscription = subscription;
        next();
    } catch (error) {
        console.error('Dispute letter credit middleware error:', error);
        res.status(500).json({
            success: false,
            message: 'Error checking dispute letter credits'
        });
    }
}

// Middleware to check feature access based on subscription tier
export function requireFeature(featureName) {
    return async (req, res, next) => {
        try {
            const subscription = req.subscription;
            if (!subscription) {
                // If subscription not already loaded, load it
                const userId = req.user?.id;
                if (!userId) {
                    return res.status(401).json({
                        success: false,
                        message: 'User authentication required'
                    });
                }

                const subscriptionService = new SubscriptionService();
                req.subscription = await subscriptionService.getUserSubscription(userId);
            }

            const hasFeature = req.subscription.limits[featureName] === true;
            if (!hasFeature) {
                return res.status(403).json({
                    success: false,
                    message: `Feature '${featureName}' not available in your current plan`,
                    data: {
                        currentTier: req.subscription.tier,
                        availableFeatures: Object.keys(req.subscription.limits).filter(
                            key => req.subscription.limits[key] === true
                        ),
                        needsUpgrade: true
                    }
                });
            }

            next();
        } catch (error) {
            console.error('Feature requirement middleware error:', error);
            res.status(500).json({
                success: false,
                message: 'Error checking feature access'
            });
        }
    };
}

// Middleware to log usage after successful operations
export function logUsageAfterSuccess(usageType) {
    return (req, res, next) => {
        // Store original send function
        const originalSend = res.send;
        
        // Override send function
        res.send = async function(data) {
            // Check if response was successful
            if (res.statusCode >= 200 && res.statusCode < 300) {
                try {
                    const userId = req.user?.id;
                    if (userId && usageType === 'dispute_letter') {
                        const subscriptionService = new SubscriptionService();
                        await subscriptionService.logDisputeLetterGeneration(userId);
                        console.log(`Logged ${usageType} usage for user ${userId}`);
                    }
                } catch (error) {
                    console.error(`Error logging ${usageType} usage:`, error);
                    // Don't fail the request if logging fails
                }
            }
            
            // Call original send function
            originalSend.call(this, data);
        };
        
        next();
    };
}

// Get user subscription status (for dashboard/API calls)
export async function getSubscriptionStatus(req, res) {
    try {
        console.log('🔍 === SUBSCRIPTION MIDDLEWARE DEBUG START ===');
        console.log('🔍 req.user object:', JSON.stringify(req.user, null, 2));
        
        const userId = req.user?.id || req.user?.userId; // Try both properties
        console.log('🔍 Extracted userId:', userId);
        console.log('🔍 req.user.email:', req.user?.email);
        
        if (!userId) {
            console.log('❌ No userId found in req.user');
            return res.status(401).json({
                success: false,
                message: 'User authentication required'
            });
        }

        const subscriptionService = new SubscriptionService();
        console.log('🔍 Calling getSubscriptionDashboard with userId:', userId);
        const dashboard = await subscriptionService.getSubscriptionDashboard(userId);
        console.log('🔍 === SUBSCRIPTION MIDDLEWARE DEBUG END ===');

        res.json({
            success: true,
            data: dashboard
        });
    } catch (error) {
        console.error('Error getting subscription status:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving subscription status'
        });
    }
}

export default {
    requireActiveSubscription,
    requireDisputeLetterCredit,
    requireFeature,
    logUsageAfterSuccess,
    getSubscriptionStatus
}; 