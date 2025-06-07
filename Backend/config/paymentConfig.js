/**
 * Payment Configuration for JAM Dispute Bot
 * 
 * This file contains the payment links and configuration for GoHighLevel integration
 */

export const PAYMENT_CONFIG = {
    // GoHighLevel Payment Links (replace with your actual payment links)
    PAYMENT_LINKS: {
        starter: 'https://yourcompany.com/diy-starter-payment', // $29/month
        professional: 'https://yourcompany.com/diy-professional-payment', // $59/month
        premium: 'https://yourcompany.com/diy-premium-payment' // $99/month
    },

    // Tier mapping from GoHighLevel product names to internal tiers
    PRODUCT_TIER_MAPPING: {
        'DIY Starter': 'starter',
        'DIY Professional': 'professional',
        'DIY Premium': 'premium'
    },

    // Tier pricing information
    TIER_PRICING: {
        starter: {
            name: 'DIY Starter',
            monthlyPrice: 29,
            creditsIncluded: 5,
            additionalCreditPrice: 4.99
        },
        professional: {
            name: 'DIY Professional', 
            monthlyPrice: 59,
            creditsIncluded: 15,
            additionalCreditPrice: 3.99
        },
        premium: {
            name: 'DIY Premium',
            monthlyPrice: 99,
            creditsIncluded: 50,
            additionalCreditPrice: 2.99
        }
    },

    // Webhook endpoints (for GoHighLevel configuration)
    WEBHOOK_ENDPOINTS: {
        paymentSuccess: '/api/webhooks/ghl/payment-success',
        subscriptionCancelled: '/api/webhooks/ghl/subscription-cancelled',
        paymentFailed: '/api/webhooks/ghl/payment-failed'
    },

    // GoHighLevel specific settings
    GHL_SETTINGS: {
        // These will be provided by GoHighLevel
        webhookSecret: process.env.GHL_WEBHOOK_SECRET || 'your-webhook-secret',
        locationId: process.env.GHL_LOCATION_ID || 'your-location-id',
        
        // Webhook validation settings
        validateWebhooks: process.env.NODE_ENV === 'production',
        
        // Billing cycle settings
        billingCycle: 'monthly',
        trialPeriodDays: 0
    },

    // Credit configuration
    CREDIT_CONFIG: {
        freeTrialCredits: 2,
        creditResetDay: 1, // 1st of each month
        gracePeriodDays: 3 // Days to keep access after payment failure
    },

    // Additional purchase links (for buying extra credits)
    ADDITIONAL_CREDIT_LINKS: {
        starter: 'https://yourcompany.com/starter-additional-credits',
        professional: 'https://yourcompany.com/professional-additional-credits', 
        premium: 'https://yourcompany.com/premium-additional-credits'
    }
};

/**
 * Get payment link for a specific tier
 * @param {string} tier - Subscription tier
 * @returns {string} Payment link URL
 */
export function getPaymentLink(tier) {
    return PAYMENT_CONFIG.PAYMENT_LINKS[tier] || null;
}

/**
 * Get tier from GoHighLevel product name
 * @param {string} productName - Product name from GoHighLevel
 * @returns {string} Internal tier name
 */
export function getTierFromProductName(productName) {
    return PAYMENT_CONFIG.PRODUCT_TIER_MAPPING[productName] || null;
}

/**
 * Get pricing information for a tier
 * @param {string} tier - Subscription tier
 * @returns {Object} Pricing information
 */
export function getTierPricing(tier) {
    return PAYMENT_CONFIG.TIER_PRICING[tier] || null;
}

/**
 * Validate webhook signature (implement based on GoHighLevel docs)
 * @param {string} payload - Webhook payload
 * @param {string} signature - Webhook signature
 * @returns {boolean} Is valid signature
 */
export function validateWebhookSignature(payload, signature) {
    // Implement webhook signature validation based on GoHighLevel documentation
    // For now, return true if validation is disabled
    if (!PAYMENT_CONFIG.GHL_SETTINGS.validateWebhooks) {
        return true;
    }
    
    // TODO: Implement actual signature validation
    // This would typically involve HMAC verification with the webhook secret
    console.log('⚠️ Webhook signature validation not yet implemented');
    return true;
} 