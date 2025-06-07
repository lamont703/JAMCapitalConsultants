import express from 'express';
import { SubscriptionService } from '../services/subscriptionService.js';
import { User } from '../models/User.js';

const router = express.Router();
const subscriptionService = new SubscriptionService();

// GoHighLevel Webhook Handler for Payment Events
router.post('/ghl/payment-success', async (req, res) => {
    try {
        console.log('🔔 GoHighLevel Payment Success Webhook Received:', req.body);
        
        const { 
            contact_id,
            email,
            name,
            product_name,
            amount,
            subscription_id,
            payment_status,
            transaction_id,
            billing_cycle
        } = req.body;

        // Validate required fields
        if (!email || !product_name || payment_status !== 'paid') {
            console.log('⚠️ Invalid webhook data or payment not successful');
            return res.status(400).json({
                success: false,
                message: 'Invalid webhook data or payment not successful'
            });
        }

        // Map GoHighLevel product names to our subscription tiers
        const tierMapping = {
            'DIY Starter': 'starter',
            'DIY Professional': 'professional', 
            'DIY Premium': 'premium'
        };

        const subscriptionTier = tierMapping[product_name];
        if (!subscriptionTier) {
            console.log('❌ Unknown product name:', product_name);
            return res.status(400).json({
                success: false,
                message: `Unknown product: ${product_name}`
            });
        }

        // Find or create user
        console.log('🔍 Looking for existing user:', email.toLowerCase());
        let user;
        
        try {
            user = await User.findOne({ email: email.toLowerCase() });
            console.log('🔍 User search result:', user ? 'Found existing user' : 'No existing user found');
        } catch (findError) {
            console.error('❌ Error finding user:', findError);
            user = null;
        }
        
        if (!user) {
            // Create new user if they don't exist
            console.log('👤 Creating new user from payment:', email);
            try {
                user = new User({
                    name: name || email.split('@')[0],
                    email: email.toLowerCase(),
                    password: 'temp_password_' + Math.random().toString(36).substr(2, 9), // Temporary password
                    ghlContactId: contact_id
                });
                console.log('💾 About to save new user...');
                await user.save();
                console.log('✅ New user saved successfully:', user.id);
            } catch (saveError) {
                console.error('❌ Error saving new user:', saveError);
                throw saveError;
            }
        }

        // Calculate subscription end date (monthly billing)
        const subscriptionStartDate = new Date().toISOString();
        const subscriptionEndDate = new Date();
        subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 1);

        // TODO: TEMPORARILY DISABLED FOR DEBUGGING
        // Update user subscription
        console.log('⏸️ Temporarily skipping subscription service calls for debugging');
        /*
        await subscriptionService.updateUserSubscriptionTier(user.id, subscriptionTier, {
            startDate: subscriptionStartDate,
            endDate: subscriptionEndDate.toISOString(),
            externalSubscriptionId: subscription_id,
            paymentProvider: 'gohighlevel',
            reason: 'payment_success',
            resetCredits: true
        });

        // Log the payment event
        await subscriptionService.logPaymentEvent(user.id, {
            event: 'payment_success',
            productName: product_name,
            amount: amount,
            transactionId: transaction_id,
            subscriptionId: subscription_id,
            ghlContactId: contact_id
        });
        */

        console.log(`✅ Successfully processed payment for ${email} - ${product_name}`);

        res.json({
            success: true,
            message: 'Payment processed successfully',
            data: {
                userId: user.id,
                email: user.email,
                subscriptionTier: subscriptionTier,
                subscriptionEndDate: subscriptionEndDate.toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Error processing GoHighLevel payment webhook:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing payment webhook',
            error: error.message
        });
    }
});

// GoHighLevel Webhook Handler for Subscription Cancellations
router.post('/ghl/subscription-cancelled', async (req, res) => {
    try {
        console.log('🔔 GoHighLevel Subscription Cancelled Webhook:', req.body);
        
        const { email, subscription_id, cancellation_reason } = req.body;
        
        if (!email || !subscription_id) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: email or subscription_id'
            });
        }

        // Find user
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            console.log('❌ User not found for cancellation:', email);
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Update subscription status to cancelled but keep access until end date
        const userInstance = new User(user);
        userInstance.subscription.status = 'cancelled';
        userInstance.subscription.externalSubscriptionId = null;
        userInstance.updatedAt = new Date().toISOString();
        await userInstance.save();

        // Log the cancellation event
        await subscriptionService.logPaymentEvent(user.id, {
            event: 'subscription_cancelled',
            subscriptionId: subscription_id,
            cancellationReason: cancellation_reason,
            cancelledAt: new Date().toISOString()
        });

        console.log(`✅ Processed subscription cancellation for ${email}`);

        res.json({
            success: true,
            message: 'Subscription cancellation processed',
            data: {
                userId: user.id,
                email: user.email,
                status: 'cancelled'
            }
        });

    } catch (error) {
        console.error('❌ Error processing cancellation webhook:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing cancellation webhook',
            error: error.message
        });
    }
});

// GoHighLevel Webhook Handler for Payment Failures
router.post('/ghl/payment-failed', async (req, res) => {
    try {
        console.log('🔔 GoHighLevel Payment Failed Webhook:', req.body);
        
        const { email, subscription_id, failure_reason, amount } = req.body;
        
        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Missing required field: email'
            });
        }

        // Find user
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            console.log('❌ User not found for payment failure:', email);
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Log the payment failure event
        await subscriptionService.logPaymentEvent(user.id, {
            event: 'payment_failed',
            subscriptionId: subscription_id,
            failureReason: failure_reason,
            amount: amount,
            failedAt: new Date().toISOString()
        });

        // Note: We don't immediately downgrade on first failure
        // GoHighLevel typically retries payments automatically
        console.log(`⚠️ Payment failure logged for ${email} - ${failure_reason}`);

        res.json({
            success: true,
            message: 'Payment failure logged',
            data: {
                userId: user.id,
                email: user.email,
                failureReason: failure_reason
            }
        });

    } catch (error) {
        console.error('❌ Error processing payment failure webhook:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing payment failure webhook',
            error: error.message
        });
    }
});

// Test endpoint for webhook validation
router.get('/ghl/test', (req, res) => {
    res.json({
        success: true,
        message: 'GoHighLevel webhook endpoint is active',
        timestamp: new Date().toISOString()
    });
});

// Test endpoint for user creation debugging
router.post('/ghl/test-user-creation', async (req, res) => {
    try {
        console.log('🧪 Testing user creation:', req.body);
        
        const { email, name } = req.body;
        
        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        // Try to create a simple user
        console.log('👤 Creating test user:', email);
        const user = new User({
            name: name || 'Test User',
            email: email.toLowerCase(),
            password: 'temp_password_123',
        });
        
        console.log('💾 Saving user...');
        await user.save();
        console.log('✅ User saved successfully:', user.id);

        res.json({
            success: true,
            message: 'Test user created successfully',
            data: {
                userId: user.id,
                email: user.email,
                name: user.name
            }
        });

    } catch (error) {
        console.error('❌ Error creating test user:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating test user',
            error: error.message
        });
    }
});

export default router; 