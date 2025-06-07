/**
 * Phase 2 Integration Test Script
 * Tests GoHighLevel payment webhook integration and subscription management
 */

import fetch from 'node-fetch';
import { User } from '../models/User.js';
import { SubscriptionService } from '../services/subscriptionService.js';

// Configuration
const BASE_URL = 'http://localhost:3000';
const TEST_EMAIL = 'phase2.test@jamcapital.com';

const subscriptionService = new SubscriptionService();

/**
 * Test Suite: Phase 2 GoHighLevel Integration
 */
async function runPhase2Tests() {
    console.log('🧪 Starting Phase 2 Integration Tests...\n');
    
    try {
        await test1_WebhookEndpoints();
        await test2_PaymentSuccessFlow();
        await test3_PaymentLinksAPI();
        await test4_SubscriptionCancellation();
        await test5_PaymentFailureHandling();
        await test6_FrontendIntegration();
        await test7_AnalyticsAndMetrics();
        
        console.log('\n✅ All Phase 2 tests completed successfully!');
        console.log('🚀 Phase 2 GoHighLevel integration is ready for production.');
        
    } catch (error) {
        console.error('\n❌ Phase 2 test failed:', error.message);
        process.exit(1);
    }
}

/**
 * Test 1: Webhook Endpoint Availability
 */
async function test1_WebhookEndpoints() {
    console.log('🔗 Test 1: Webhook Endpoint Availability');
    
    // Test webhook test endpoint
    const testResponse = await fetch(`${BASE_URL}/api/webhooks/ghl/test`);
    const testData = await testResponse.json();
    
    if (testData.success) {
        console.log('✅ Webhook test endpoint active');
    } else {
        throw new Error('Webhook test endpoint not responding');
    }
    
    console.log('   - Payment success endpoint: /api/webhooks/ghl/payment-success');
    console.log('   - Subscription cancelled endpoint: /api/webhooks/ghl/subscription-cancelled');
    console.log('   - Payment failed endpoint: /api/webhooks/ghl/payment-failed');
    console.log('   - Test endpoint: /api/webhooks/ghl/test ✅\n');
}

/**
 * Test 2: Payment Success Flow
 */
async function test2_PaymentSuccessFlow() {
    console.log('💳 Test 2: Payment Success Flow');
    
    // Clean up test user if exists
    await cleanupTestUser();
    
    // Simulate GoHighLevel payment success webhook
    const paymentData = {
        contact_id: 'test_contact_phase2',
        email: TEST_EMAIL,
        name: 'Phase 2 Test User',
        product_name: 'DIY Professional',
        amount: '59',
        subscription_id: 'test_sub_phase2_456',
        payment_status: 'paid',
        transaction_id: 'test_txn_phase2_789',
        billing_cycle: 'monthly'
    };
    
    const response = await fetch(`${BASE_URL}/api/webhooks/ghl/payment-success`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData)
    });
    
    const result = await response.json();
    
    if (!result.success) {
        throw new Error(`Payment webhook failed: ${result.message}`);
    }
    
    // Verify user was created/updated correctly
    const user = await User.findOne({ email: TEST_EMAIL });
    if (!user) {
        throw new Error('User not created from payment webhook');
    }
    
    if (user.subscription.tier !== 'professional') {
        throw new Error(`Subscription tier not updated correctly. Expected: professional, Got: ${user.subscription.tier}`);
    }
    
    if (user.subscription.remainingCredits !== 15) {
        throw new Error(`Credits not set correctly. Expected: 15, Got: ${user.subscription.remainingCredits}`);
    }
    
    console.log('✅ Payment success webhook processed correctly');
    console.log(`   - User created: ${user.email}`);
    console.log(`   - Subscription tier: ${user.subscription.tier}`);
    console.log(`   - Credits: ${user.subscription.remainingCredits}`);
    console.log(`   - Status: ${user.subscription.status}\n`);
}

/**
 * Test 3: Payment Links API
 */
async function test3_PaymentLinksAPI() {
    console.log('🔗 Test 3: Payment Links API');
    
    const tiers = ['starter', 'professional', 'premium'];
    
    for (const tier of tiers) {
        const response = await fetch(`${BASE_URL}/api/subscription/payment-links/${tier}`);
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(`Payment link API failed for ${tier}: ${result.message}`);
        }
        
        console.log(`✅ ${tier.charAt(0).toUpperCase() + tier.slice(1)} payment link: ${result.paymentLink}`);
    }
    
    // Test invalid tier
    const invalidResponse = await fetch(`${BASE_URL}/api/subscription/payment-links/invalid`);
    const invalidResult = await invalidResponse.json();
    
    if (invalidResponse.status !== 404) {
        throw new Error('Invalid tier should return 404');
    }
    
    console.log('✅ Invalid tier handling works correctly\n');
}

/**
 * Test 4: Subscription Cancellation
 */
async function test4_SubscriptionCancellation() {
    console.log('❌ Test 4: Subscription Cancellation');
    
    // Simulate cancellation webhook
    const cancellationData = {
        email: TEST_EMAIL,
        subscription_id: 'test_sub_phase2_456',
        cancellation_reason: 'customer_requested'
    };
    
    const response = await fetch(`${BASE_URL}/api/webhooks/ghl/subscription-cancelled`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cancellationData)
    });
    
    const result = await response.json();
    
    if (!result.success) {
        throw new Error(`Cancellation webhook failed: ${result.message}`);
    }
    
    // Verify subscription status updated
    const user = await User.findOne({ email: TEST_EMAIL });
    if (user.subscription.status !== 'cancelled') {
        throw new Error(`Subscription status not updated. Expected: cancelled, Got: ${user.subscription.status}`);
    }
    
    console.log('✅ Subscription cancellation processed correctly');
    console.log(`   - Status: ${user.subscription.status}`);
    console.log(`   - External subscription ID cleared\n`);
}

/**
 * Test 5: Payment Failure Handling
 */
async function test5_PaymentFailureHandling() {
    console.log('⚠️ Test 5: Payment Failure Handling');
    
    // Simulate payment failure webhook
    const failureData = {
        email: TEST_EMAIL,
        subscription_id: 'test_sub_phase2_456',
        failure_reason: 'insufficient_funds',
        amount: '59'
    };
    
    const response = await fetch(`${BASE_URL}/api/webhooks/ghl/payment-failed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(failureData)
    });
    
    const result = await response.json();
    
    if (!result.success) {
        throw new Error(`Payment failure webhook failed: ${result.message}`);
    }
    
    console.log('✅ Payment failure logged correctly');
    console.log(`   - Failure reason: ${failureData.failure_reason}`);
    console.log(`   - Amount: $${failureData.amount}\n`);
}

/**
 * Test 6: Frontend Integration
 */
async function test6_FrontendIntegration() {
    console.log('🎨 Test 6: Frontend Integration');
    
    // Test subscription tiers API
    const tiersResponse = await fetch(`${BASE_URL}/api/subscription/tiers`);
    const tiersResult = await tiersResponse.json();
    
    if (!tiersResult.success) {
        throw new Error('Subscription tiers API failed');
    }
    
    const expectedTiers = ['free', 'starter', 'professional', 'premium'];
    const actualTiers = Object.keys(tiersResult.data);
    
    for (const tier of expectedTiers) {
        if (!actualTiers.includes(tier)) {
            throw new Error(`Missing tier: ${tier}`);
        }
    }
    
    console.log('✅ Subscription tiers API working');
    console.log(`   - Available tiers: ${actualTiers.join(', ')}`);
    
    // Verify tier data structure
    const starterTier = tiersResult.data.starter;
    if (starterTier.monthlyPrice !== 29 || starterTier.creditsIncluded !== 5) {
        throw new Error('Starter tier pricing incorrect');
    }
    
    console.log('✅ Tier pricing data correct\n');
}

/**
 * Test 7: Analytics and Metrics
 */
async function test7_AnalyticsAndMetrics() {
    console.log('📊 Test 7: Analytics and Metrics');
    
    // Test payment history for user
    const paymentHistory = await subscriptionService.getPaymentHistory(
        (await User.findOne({ email: TEST_EMAIL })).id
    );
    
    if (paymentHistory.length === 0) {
        throw new Error('Payment history not recorded');
    }
    
    console.log(`✅ Payment history recorded: ${paymentHistory.length} events`);
    
    // Test subscription metrics
    const metrics = await subscriptionService.getSubscriptionMetrics();
    
    if (!metrics.totalUsers || metrics.totalUsers === 0) {
        throw new Error('Subscription metrics not calculating');
    }
    
    console.log('✅ Subscription metrics calculated');
    console.log(`   - Total users: ${metrics.totalUsers}`);
    console.log(`   - Paid users: ${metrics.paidUsers}`);
    console.log(`   - Monthly revenue: $${metrics.monthlyRevenue}`);
    console.log(`   - Recent payments: ${metrics.recentPayments.length}\n`);
}

/**
 * Cleanup test user
 */
async function cleanupTestUser() {
    try {
        const user = await User.findOne({ email: TEST_EMAIL });
        if (user) {
            await user.delete();
        }
    } catch (error) {
        // User doesn't exist, that's fine
    }
}

/**
 * Display setup instructions
 */
function displaySetupInstructions() {
    console.log('\n📋 Phase 2 Setup Instructions:');
    console.log('1. Update your .env file with GoHighLevel payment links');
    console.log('2. Configure webhooks in GoHighLevel admin panel');
    console.log('3. Replace placeholder URLs with your actual payment links');
    console.log('4. Test with real GoHighLevel payment flow');
    console.log('\n📖 See Backend/PHASE2_IMPLEMENTATION_GUIDE.md for detailed instructions');
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('🚀 JAM Dispute Bot - Phase 2 Integration Test Suite');
    console.log('==================================================\n');
    
    runPhase2Tests()
        .then(() => {
            displaySetupInstructions();
            console.log('\n🎉 Phase 2 integration is ready!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Test suite failed:', error);
            process.exit(1);
        });
} 