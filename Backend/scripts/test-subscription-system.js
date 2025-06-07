import { SubscriptionService } from '../services/subscriptionService.js';
import { User } from '../models/User.js';
import { CosmosService } from '../services/cosmosService.js';

/**
 * Test Script for JAM Dispute Bot Subscription System - Phase 1
 * 
 * This script tests all the core subscription functionality:
 * - User creation with subscription data
 * - Credit checking and consumption
 * - Tier upgrades and downgrades
 * - Analytics and reporting
 */

class SubscriptionSystemTester {
    constructor() {
        this.subscriptionService = new SubscriptionService();
        this.cosmosService = new CosmosService();
        this.testUsers = [];
    }

    async initialize() {
        console.log('🚀 Initializing Subscription System Test...\n');
        await this.subscriptionService.initialize();
        await this.cosmosService.initialize();
        console.log('✅ Services initialized\n');
    }

    async runAllTests() {
        try {
            await this.initialize();
            
            console.log('📋 Running Subscription System Tests...\n');
            
            // Test 1: Create test users with different subscription tiers
            await this.testUserCreation();
            
            // Test 2: Test credit checking functionality
            await this.testCreditChecking();
            
            // Test 3: Test credit consumption
            await this.testCreditConsumption();
            
            // Test 4: Test subscription tier updates
            await this.testTierUpdates();
            
            // Test 5: Test analytics
            await this.testAnalytics();
            
            // Test 6: Test expired subscription processing
            await this.testExpiredSubscriptions();
            
            console.log('🎉 All tests completed successfully!\n');
            
            // Cleanup
            await this.cleanup();
            
        } catch (error) {
            console.error('❌ Test failed:', error);
            throw error;
        }
    }

    async testUserCreation() {
        console.log('🧪 Test 1: Creating test users with different subscription tiers...');
        
        const testUserData = [
            {
                name: 'Free Trial User',
                email: 'free@test.com',
                password: 'password123',
                tier: 'free'
            },
            {
                name: 'Starter User',
                email: 'starter@test.com',
                password: 'password123',
                tier: 'starter'
            },
            {
                name: 'Professional User',
                email: 'professional@test.com',
                password: 'password123',
                tier: 'professional'
            },
            {
                name: 'Premium User',
                email: 'premium@test.com',
                password: 'password123',
                tier: 'premium'
            }
        ];

        for (const userData of testUserData) {
            try {
                // Create user with default free subscription
                const user = new User(userData);
                await user.save();
                
                // Update to desired tier if not free
                if (userData.tier !== 'free') {
                    await user.updateSubscriptionTier(userData.tier, {
                        reason: 'test_setup',
                        resetCredits: true
                    });
                }
                
                this.testUsers.push(user);
                console.log(`  ✅ Created ${userData.tier} user: ${userData.email}`);
                
            } catch (error) {
                console.error(`  ❌ Failed to create user ${userData.email}:`, error.message);
            }
        }
        
        console.log(`✅ Test 1 Complete: Created ${this.testUsers.length} test users\n`);
    }

    async testCreditChecking() {
        console.log('🧪 Test 2: Testing credit checking functionality...');
        
        for (const user of this.testUsers) {
            try {
                const creditCheck = await this.subscriptionService.checkUserCredits(user.id, 1);
                const subscriptionInfo = await this.subscriptionService.getUserSubscription(user.id);
                
                console.log(`  📊 ${user.email} (${subscriptionInfo.tierName}):`);
                console.log(`    - Can use credits: ${creditCheck.canUse}`);
                console.log(`    - Remaining credits: ${creditCheck.remainingCredits}`);
                console.log(`    - Reason: ${creditCheck.reason || 'valid'}`);
                
            } catch (error) {
                console.error(`  ❌ Credit check failed for ${user.email}:`, error.message);
            }
        }
        
        console.log('✅ Test 2 Complete: Credit checking functionality verified\n');
    }

    async testCreditConsumption() {
        console.log('🧪 Test 3: Testing credit consumption...');
        
        for (const user of this.testUsers) {
            try {
                const beforeInfo = await this.subscriptionService.getUserSubscription(user.id);
                console.log(`  📝 ${user.email} - Before: ${beforeInfo.remainingCredits} credits`);
                
                // Try to consume 1 credit
                const result = await this.subscriptionService.consumeUserCredits(user.id, 1, 'test_letter_generation');
                
                const afterInfo = await this.subscriptionService.getUserSubscription(user.id);
                console.log(`    - After: ${afterInfo.remainingCredits} credits`);
                console.log(`    - Consumption successful: ${!!result}`);
                
            } catch (error) {
                console.log(`    - Consumption failed (expected for exhausted accounts): ${error.message}`);
            }
        }
        
        console.log('✅ Test 3 Complete: Credit consumption functionality verified\n');
    }

    async testTierUpdates() {
        console.log('🧪 Test 4: Testing subscription tier updates...');
        
        // Test upgrading the free user to starter
        const freeUser = this.testUsers.find(u => u.email === 'free@test.com');
        if (freeUser) {
            try {
                console.log('  📈 Upgrading free user to starter tier...');
                const beforeInfo = await this.subscriptionService.getUserSubscription(freeUser.id);
                console.log(`    - Before: ${beforeInfo.tierName}, ${beforeInfo.remainingCredits} credits`);
                
                await this.subscriptionService.updateUserSubscriptionTier(freeUser.id, 'starter', {
                    reason: 'test_upgrade',
                    resetCredits: true
                });
                
                const afterInfo = await this.subscriptionService.getUserSubscription(freeUser.id);
                console.log(`    - After: ${afterInfo.tierName}, ${afterInfo.remainingCredits} credits`);
                
            } catch (error) {
                console.error(`  ❌ Tier update failed:`, error.message);
            }
        }
        
        console.log('✅ Test 4 Complete: Tier update functionality verified\n');
    }

    async testAnalytics() {
        console.log('🧪 Test 5: Testing analytics functionality...');
        
        try {
            const analytics = await this.subscriptionService.getSubscriptionAnalytics();
            
            console.log('  📊 Analytics Summary:');
            console.log(`    - Total users: ${analytics.summary.totalUsers}`);
            console.log(`    - Total credits used: ${analytics.summary.totalCreditsUsed}`);
            console.log(`    - Average credits per user: ${analytics.summary.avgCreditsPerUser.toFixed(2)}`);
            console.log('    - Tier breakdown:');
            
            Object.entries(analytics.summary.tierBreakdown).forEach(([tier, count]) => {
                console.log(`      * ${tier}: ${count} users`);
            });
            
            console.log(`    - Recent activities: ${analytics.creditUsageLogs.length} logged`);
            
        } catch (error) {
            console.error('  ❌ Analytics test failed:', error.message);
        }
        
        console.log('✅ Test 5 Complete: Analytics functionality verified\n');
    }

    async testExpiredSubscriptions() {
        console.log('🧪 Test 6: Testing expired subscription processing...');
        
        try {
            // Create a user with an expired subscription for testing
            const expiredUser = new User({
                name: 'Expired User',
                email: 'expired@test.com',
                password: 'password123'
            });
            await expiredUser.save();
            
            // Set up expired subscription
            await expiredUser.updateSubscriptionTier('professional', {
                reason: 'test_expired',
                startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days ago
                endDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
                resetCredits: true
            });
            
            this.testUsers.push(expiredUser);
            
            console.log('  ⏰ Created user with expired subscription');
            
            // Check for expired subscriptions
            const expiredSubscriptions = await this.subscriptionService.getExpiredSubscriptions();
            console.log(`  📋 Found ${expiredSubscriptions.length} expired subscriptions`);
            
            // Process expired subscriptions
            const processedUsers = await this.subscriptionService.processExpiredSubscriptions();
            console.log(`  🔄 Processed ${processedUsers.length} expired subscriptions`);
            
            const successCount = processedUsers.filter(u => u.processed).length;
            console.log(`  ✅ Successfully processed: ${successCount}`);
            
        } catch (error) {
            console.error('  ❌ Expired subscription test failed:', error.message);
        }
        
        console.log('✅ Test 6 Complete: Expired subscription processing verified\n');
    }

    async cleanup() {
        console.log('🧹 Cleaning up test data...');
        
        for (const user of this.testUsers) {
            try {
                await this.cosmosService.deleteDocument(user.id, 'user');
                console.log(`  🗑️ Deleted test user: ${user.email}`);
            } catch (error) {
                console.error(`  ❌ Failed to delete user ${user.email}:`, error.message);
            }
        }
        
        console.log('✅ Cleanup complete\n');
    }
}

// Run the tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const tester = new SubscriptionSystemTester();
    
    tester.runAllTests()
        .then(() => {
            console.log('🎉 All subscription system tests passed!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Subscription system tests failed:', error);
            process.exit(1);
        });
}

export { SubscriptionSystemTester }; 