#!/usr/bin/env node

/**
 * Tag Wakeshia Davis for Credit Monitoring Script
 * 
 * This script applies the correct credit monitoring tags to Wakeshia's
 * GoHighLevel contact based on her stored IdentityIQ credentials.
 * 
 * User: Wakeshia Davis (wakeshiad@gmail.com)
 * User ID: user_1752482986995_cjw35ylmk
 * GHL Contact ID: MCl9HySl7fQ3nxNWOfpl
 * Has: IdentityIQ credentials (active)
 */

import { CosmosService } from './services/cosmosService.js';
import { GoHighLevelService } from './services/ghlService.js';
import { UserCredentials } from './models/UserCredentials.js';

class WakeshiaMonitoringTagger {
    constructor() {
        this.userData = {
            id: "user_1752482986995_cjw35ylmk",
            name: "Wakeshia Davis",
            email: "wakeshiad@gmail.com",
            ghlContactId: "MCl9HySl7fQ3nxNWOfpl"
        };
        
        this.cosmosService = null;
        this.ghlService = null;
        this.userCredentials = null;
        this.ghlWorking = false;
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const icons = {
            info: 'ℹ️',
            success: '✅',
            error: '❌',
            warning: '⚠️',
            header: '🚀',
            step: '📝',
            tag: '🏷️'
        };
        
        console.log(`${icons[type]} [${timestamp}] ${message}`);
    }

    async initializeServices() {
        this.log('Initializing services...', 'header');
        
        try {
            // Initialize CosmosDB
            this.cosmosService = new CosmosService();
            await this.cosmosService.initialize();
            this.log('✅ CosmosDB service initialized', 'success');

            // Initialize UserCredentials
            this.userCredentials = new UserCredentials(this.cosmosService);
            this.log('✅ UserCredentials service initialized', 'success');

            // Try to initialize GoHighLevel (handle gracefully if it fails)
            try {
                this.ghlService = new GoHighLevelService();
                await this.ghlService.initialize();
                
                const testResult = await this.ghlService.testConnection();
                if (testResult.success) {
                    this.log('✅ GoHighLevel service initialized and working', 'success');
                    this.ghlWorking = true;
                } else {
                    throw new Error(testResult.error);
                }
            } catch (ghlError) {
                this.log(`⚠️ GoHighLevel service failed: ${ghlError.message}`, 'warning');
                this.log('📝 Will provide manual tagging instructions instead', 'info');
                this.ghlWorking = false;
            }

        } catch (error) {
            this.log(`❌ Service initialization failed: ${error.message}`, 'error');
            throw error;
        }
    }

    async verifyCredentials() {
        this.log('Verifying Wakeshia\'s credentials...', 'header');
        
        try {
            const credentialStatus = await this.userCredentials.getUserCredentialStatus(this.userData.id);
            
            const hasIdentityIQ = !!credentialStatus.identityiq;
            const hasSmartCredit = !!credentialStatus.smartcredit;
            const hasMyScoreIQ = !!credentialStatus.myscoreiq;
            
            this.log('📊 Current Credential Status:', 'info');
            this.log(`   IdentityIQ: ${hasIdentityIQ ? '✅ Active' : '❌ None'}`, hasIdentityIQ ? 'success' : 'error');
            this.log(`   SmartCredit: ${hasSmartCredit ? '✅ Active' : '❌ None'}`, hasSmartCredit ? 'success' : 'error');
            this.log(`   MyScoreIQ: ${hasMyScoreIQ ? '✅ Active' : '❌ None'}`, hasMyScoreIQ ? 'success' : 'error');
            
            return {
                identityiq: hasIdentityIQ,
                smartcredit: hasSmartCredit,
                myscoreiq: hasMyScoreIQ
            };
        } catch (error) {
            this.log(`❌ Error verifying credentials: ${error.message}`, 'error');
            return { identityiq: false, smartcredit: false, myscoreiq: false };
        }
    }

    getExpectedTags(credentialStatus) {
        const tags = [];
        
        // Base monitoring tag
        if (credentialStatus.identityiq || credentialStatus.smartcredit || credentialStatus.myscoreiq) {
            tags.push('Credit Monitoring - Active');
        }
        
        // Service-specific tags
        if (credentialStatus.identityiq) {
            tags.push('Credentials: IdentityIQ Complete');
        }
        if (credentialStatus.smartcredit) {
            tags.push('Credentials: SmartCredit Complete');
        }
        if (credentialStatus.myscoreiq) {
            tags.push('Credentials: MyScoreIQ Complete');
        }
        
        // Additional monitoring tags
        if (credentialStatus.identityiq) {
            tags.push('Credit Report Access - IdentityIQ');
            tags.push('Monitoring Service - Connected');
        }
        
        return tags;
    }

    async applyTagsAutomatically(credentialStatus) {
        this.log('Applying tags automatically via GHL API...', 'header');
        
        try {
            const result = await this.ghlService.updateCredentialTags(
                this.userData.ghlContactId, 
                credentialStatus
            );

            if (result.success) {
                this.log('✅ Tags applied successfully!', 'success');
                this.log('🏷️ Applied tags:', 'tag');
                result.tags.forEach(tag => {
                    this.log(`   ✨ ${tag}`, 'success');
                });
                return true;
            } else {
                this.log(`❌ Failed to apply tags: ${result.error}`, 'error');
                return false;
            }
        } catch (error) {
            this.log(`❌ Error applying tags: ${error.message}`, 'error');
            return false;
        }
    }

    async getCurrentGHLTags() {
        if (!this.ghlWorking) {
            return null;
        }
        
        try {
            this.log('Checking current GHL tags...', 'step');
            const tags = await this.ghlService.getContactTags(this.userData.ghlContactId);
            
            this.log(`📊 Current tags (${tags.length} total):`, 'info');
            tags.forEach(tag => {
                this.log(`   🏷️ ${tag}`, 'info');
            });
            
            return tags;
        } catch (error) {
            this.log(`❌ Error getting current tags: ${error.message}`, 'error');
            return null;
        }
    }

    provideManualInstructions(credentialStatus) {
        this.log('Providing manual tagging instructions...', 'header');
        
        const expectedTags = this.getExpectedTags(credentialStatus);
        
        this.log('📋 MANUAL TAGGING INSTRUCTIONS:', 'info');
        this.log(`Contact: ${this.userData.name} (${this.userData.email})`, 'info');
        this.log(`GHL Contact ID: ${this.userData.ghlContactId}`, 'info');
        this.log('', 'info');
        
        this.log('🏷️ Tags to add manually in GoHighLevel:', 'tag');
        expectedTags.forEach((tag, index) => {
            this.log(`   ${index + 1}. ${tag}`, 'success');
        });
        
        this.log('', 'info');
        this.log('🔧 Steps to add tags manually:', 'step');
        this.log('   1. Log into GoHighLevel dashboard', 'info');
        this.log('   2. Go to Contacts section', 'info');
        this.log(`   3. Search for: ${this.userData.email}`, 'info');
        this.log('   4. Open Wakeshia Davis\'s contact profile', 'info');
        this.log('   5. Add the tags listed above', 'info');
        this.log('   6. Save the contact', 'info');
    }

    async verifyTagsApplied() {
        if (!this.ghlWorking) {
            this.log('⚠️ Cannot verify - GHL service not available', 'warning');
            return false;
        }
        
        this.log('Verifying tags were applied...', 'header');
        
        try {
            // Wait a moment for tags to propagate
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            const updatedTags = await this.ghlService.getContactTags(this.userData.ghlContactId);
            
            const credentialTags = updatedTags.filter(tag => 
                tag.toLowerCase().includes('monitoring') ||
                tag.toLowerCase().includes('identityiq') ||
                tag.toLowerCase().includes('credentials:') ||
                tag.toLowerCase().includes('complete')
            );
            
            this.log(`📊 Found ${credentialTags.length} credential/monitoring tags:`, 'info');
            credentialTags.forEach(tag => {
                this.log(`   🎯 ${tag}`, 'success');
            });
            
            if (credentialTags.length > 0) {
                this.log('✅ SUCCESS: Credit monitoring tags are now present!', 'success');
                return true;
            } else {
                this.log('❌ No monitoring tags found after update', 'error');
                return false;
            }
        } catch (error) {
            this.log(`❌ Error verifying tags: ${error.message}`, 'error');
            return false;
        }
    }

    async runTagging() {
        this.log('\n🚀 ===== WAKESHIA DAVIS CREDIT MONITORING TAGGING =====\n', 'header');
        this.log(`Adding credit monitoring tags for: ${this.userData.name} (${this.userData.email})`, 'info');
        this.log(`User ID: ${this.userData.id}`, 'info');
        this.log(`GHL Contact ID: ${this.userData.ghlContactId}`, 'info');
        this.log('\n' + '-'.repeat(60) + '\n', 'info');

        try {
            // Step 1: Initialize services
            await this.initializeServices();

            // Step 2: Verify credentials
            const credentialStatus = await this.verifyCredentials();

            // Step 3: Check current tags (if GHL is working)
            await this.getCurrentGHLTags();

            // Step 4: Apply tags or provide manual instructions
            if (this.ghlWorking) {
                this.log('🤖 Attempting automatic tag application...', 'step');
                const success = await this.applyTagsAutomatically(credentialStatus);
                
                if (success) {
                    // Step 5: Verify tags were applied  
                    await this.verifyTagsApplied();
                } else {
                    this.log('⚠️ Automatic tagging failed, providing manual instructions...', 'warning');
                    this.provideManualInstructions(credentialStatus);
                }
            } else {
                this.log('📋 GHL API unavailable, providing manual instructions...', 'info');
                this.provideManualInstructions(credentialStatus);
            }

            this.log('\n✅ Wakeshia Davis credit monitoring tagging completed!', 'success');

        } catch (error) {
            this.log(`💥 Tagging failed: ${error.message}`, 'error');
            console.error(error.stack);
        }
    }
}

// Run the tagging if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const tagger = new WakeshiaMonitoringTagger();
    tagger.runTagging().catch(error => {
        console.error('❌ Monitoring tagging failed:', error);
        process.exit(1);
    });
}

export default WakeshiaMonitoringTagger; 