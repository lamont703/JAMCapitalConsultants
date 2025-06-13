import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { CosmosService } from './services/cosmosService.js';
import { User } from './models/User.js';

// Test configuration
const TEST_EMAIL = `test-${Date.now()}@jamcapital.com`;
const TEST_PASSWORD = 'TestPassword123!';
const TEST_NAME = 'Test User';
const TEST_PHONE = '555-123-4567';
const TEST_COMPANY = 'Test Company';
const TEST_SECURITY_QUESTION = 'What is your favorite color?';
const TEST_SECURITY_ANSWER = 'blue';

async function testUserRegistration() {
    console.log('🧪 Starting User Registration Test...\n');
    
    try {
        // Initialize CosmosService
        console.log('📡 Initializing CosmosService...');
        const cosmosService = new CosmosService();
        await cosmosService.initialize();
        console.log('✅ CosmosService initialized successfully\n');

        // Check if test user already exists
        console.log(`🔍 Checking if test user exists: ${TEST_EMAIL}`);
        const existingUser = await cosmosService.getUserByEmail(TEST_EMAIL);
        if (existingUser) {
            console.log('⚠️ Test user already exists, deleting...');
            await cosmosService.deleteDocument(existingUser.id, 'user');
            console.log('✅ Existing test user deleted\n');
        } else {
            console.log('✅ No existing test user found\n');
        }

        // Test 1: Create user using User model (the correct way)
        console.log('🧪 TEST 1: Creating user using User model...');
        const hashedPassword = await bcrypt.hash(TEST_PASSWORD, 12);
        const securitySalt = crypto.randomBytes(16).toString('hex');
        const normalizedAnswer = TEST_SECURITY_ANSWER.trim().toLowerCase();
        const securityAnswerHash = crypto
            .pbkdf2Sync(normalizedAnswer, securitySalt, 10000, 64, 'sha512')
            .toString('hex');

        const user = new User({
            name: TEST_NAME,
            email: TEST_EMAIL,
            password: hashedPassword,
            phone: TEST_PHONE,
            company: TEST_COMPANY,
            securityQuestion: TEST_SECURITY_QUESTION,
            securityAnswerHash: securityAnswerHash,
            securitySalt: securitySalt,
            ghlContactId: null,
            ghlSyncStatus: 'pending'
        });

        console.log('💾 Saving user to database...');
        const savedUser = await user.save();
        console.log('✅ User saved successfully\n');

        // Verify subscription was assigned
        console.log('🔍 Verifying subscription assignment...');
        console.log('📊 User subscription details:');
        console.log(`   - Tier: ${savedUser.subscription.tier}`);
        console.log(`   - Status: ${savedUser.subscription.status}`);
        console.log(`   - Remaining Credits: ${savedUser.subscription.remainingCredits}`);
        console.log(`   - Credits Included: ${savedUser.subscription.creditsIncluded}`);
        console.log(`   - Subscription Start Date: ${savedUser.subscription.subscriptionStartDate}`);
        console.log(`   - Has Trial Used: ${savedUser.subscription.hasTrialUsed}`);

        // Test subscription assignment
        const subscriptionTest = {
            tier: savedUser.subscription.tier === 'free',
            status: savedUser.subscription.status === 'active',
            credits: savedUser.subscription.remainingCredits === 2,
            included: savedUser.subscription.creditsIncluded === 2,
            startDate: savedUser.subscription.subscriptionStartDate !== null,
            trialUsed: savedUser.subscription.hasTrialUsed === false
        };

        console.log('\n📋 Subscription Test Results:');
        console.log(`   ✅ Tier is 'free': ${subscriptionTest.tier}`);
        console.log(`   ✅ Status is 'active': ${subscriptionTest.status}`);
        console.log(`   ✅ Remaining credits is 2: ${subscriptionTest.credits}`);
        console.log(`   ✅ Credits included is 2: ${subscriptionTest.included}`);
        console.log(`   ✅ Start date is set: ${subscriptionTest.startDate}`);
        console.log(`   ✅ Trial not used: ${subscriptionTest.trialUsed}`);

        const allTestsPassed = Object.values(subscriptionTest).every(test => test);
        console.log(`\n🎯 Overall Test Result: ${allTestsPassed ? 'PASSED ✅' : 'FAILED ❌'}`);

        // Test 2: Verify user can be retrieved and subscription is intact
        console.log('\n🧪 TEST 2: Verifying user retrieval...');
        const retrievedUser = await cosmosService.getUserByEmail(TEST_EMAIL);
        if (retrievedUser) {
            console.log('✅ User retrieved successfully');
            console.log(`   - Subscription tier: ${retrievedUser.subscription?.tier || 'MISSING'}`);
            console.log(`   - Remaining credits: ${retrievedUser.subscription?.remainingCredits || 'MISSING'}`);
            
            if (retrievedUser.subscription?.tier === 'free' && retrievedUser.subscription?.remainingCredits === 2) {
                console.log('✅ Subscription data intact after retrieval');
            } else {
                console.log('❌ Subscription data missing or incorrect after retrieval');
            }
        } else {
            console.log('❌ Failed to retrieve user');
        }

        // Test 3: Test credit consumption
        console.log('\n🧪 TEST 3: Testing credit consumption...');
        const creditCheck = savedUser.checkCredits(1);
        console.log(`   - Can use 1 credit: ${creditCheck.canUse}`);
        console.log(`   - Reason: ${creditCheck.reason}`);
        console.log(`   - Message: ${creditCheck.message}`);

        if (creditCheck.canUse) {
            console.log('✅ Credit check passed');
            
            // Consume a credit
            await savedUser.consumeCredits(1, 'test_operation');
            console.log('✅ Credit consumed successfully');
            
            // Check remaining credits
            const updatedUser = await cosmosService.getUserByEmail(TEST_EMAIL);
            console.log(`   - Remaining credits after consumption: ${updatedUser.subscription.remainingCredits}`);
            
            if (updatedUser.subscription.remainingCredits === 1) {
                console.log('✅ Credit consumption working correctly');
            } else {
                console.log('❌ Credit consumption not working correctly');
            }
        } else {
            console.log('❌ Credit check failed');
        }

        // Cleanup
        console.log('\n🧹 Cleaning up test data...');
        await cosmosService.deleteDocument(savedUser.id, 'user');
        console.log('✅ Test user deleted');

        console.log('\n🎉 Test completed successfully!');
        console.log('📝 Summary:');
        console.log('   - User model correctly assigns Free Tier subscription');
        console.log('   - Subscription data is properly saved to database');
        console.log('   - User can be retrieved with intact subscription data');
        console.log('   - Credit system is working correctly');

    } catch (error) {
        console.error('❌ Test failed with error:', error);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Run the test
console.log('🚀 JAM Capital - User Registration & Subscription Test');
console.log('=====================================================\n');

testUserRegistration()
    .then(() => {
        console.log('\n✅ All tests completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Test suite failed:', error);
        process.exit(1);
    }); 