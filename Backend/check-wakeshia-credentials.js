#!/usr/bin/env node

/**
 * Check Wakeshia Davis Credentials Script
 * 
 * This script will check if Wakeshia's IdentityIQ credentials 
 * are stored in the database (bypassing GHL issues)
 */

import { CosmosService } from './services/cosmosService.js';
import { UserCredentials } from './models/UserCredentials.js';

class WakeshiaCredentialChecker {
    constructor() {
        this.userData = {
            id: "user_1752482986995_cjw35ylmk",
            name: "Wakeshia Davis",
            email: "wakeshiad@gmail.com"
        };
        
        this.cosmosService = null;
        this.userCredentials = null;
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const icons = {
            info: 'ℹ️',
            success: '✅',
            error: '❌',
            warning: '⚠️',
            header: '🚀',
            step: '📝'
        };
        
        console.log(`${icons[type]} [${timestamp}] ${message}`);
    }

    async initialize() {
        this.log('Initializing database services...', 'header');
        
        try {
            // Initialize CosmosDB
            this.cosmosService = new CosmosService();
            await this.cosmosService.initialize();
            this.log('✅ CosmosDB service initialized', 'success');

            // Initialize UserCredentials
            this.userCredentials = new UserCredentials(this.cosmosService);
            this.log('✅ UserCredentials service initialized', 'success');

        } catch (error) {
            this.log(`❌ Service initialization failed: ${error.message}`, 'error');
            throw error;
        }
    }

    async checkAllUserCredentials() {
        this.log('Checking ALL credential services for Wakeshia...', 'header');
        
        try {
            const credentialStatus = await this.userCredentials.getUserCredentialStatus(this.userData.id);
            
            this.log('📊 Complete Credential Status:', 'info');
            
            const services = ['smartcredit', 'identityiq', 'myscoreiq', 'cfpb', 'annualcreditreport'];
            let hasAnyCredentials = false;
            let credentialCount = 0;
            
            for (const service of services) {
                if (credentialStatus[service]) {
                    this.log(`   ✅ ${service.toUpperCase()}: Has credentials (${credentialStatus[service].status})`, 'success');
                    this.log(`      📅 Created: ${credentialStatus[service].createdAt}`, 'info');
                    this.log(`      📅 Last Accessed: ${credentialStatus[service].lastAccessedAt || 'Never'}`, 'info');
                    hasAnyCredentials = true;
                    credentialCount++;
                } else {
                    this.log(`   ❌ ${service.toUpperCase()}: No credentials`, 'error');
                }
            }
            
            this.log(`\n📊 SUMMARY: Wakeshia has credentials for ${credentialCount}/5 services`, 'info');
            
            if (!hasAnyCredentials) {
                this.log('💡 User has NO credentials stored - this confirms the JWT token issue prevented all uploads', 'warning');
                this.log('🔧 After fixing the JWT token issue, user will need to re-upload credentials', 'info');
            } else {
                this.log(`✅ User has ${credentialCount} credential service(s) stored`, 'success');
                if (credentialStatus.identityiq) {
                    this.log('🎯 IdentityIQ credentials ARE stored - tagging should have worked', 'success');
                } else {
                    this.log('❌ IdentityIQ credentials NOT stored - upload likely failed', 'error');
                }
            }
            
            return {
                credentialStatus,
                hasAnyCredentials,
                credentialCount,
                hasIdentityIQ: !!credentialStatus.identityiq
            };
        } catch (error) {
            this.log(`❌ Error checking credentials: ${error.message}`, 'error');
            return { credentialStatus: {}, hasAnyCredentials: false, credentialCount: 0, hasIdentityIQ: false };
        }
    }

    async checkSpecificCredential(service) {
        this.log(`Checking specific ${service.toUpperCase()} credentials...`, 'header');
        
        try {
            const credentials = await this.userCredentials.getCredentials(
                this.userData.id, 
                service
            );

            if (credentials) {
                this.log(`✅ ${service.toUpperCase()} credentials found`, 'success');
                this.log(`📊 Credential ID: ${credentials.id}`, 'info');
                this.log(`📅 Created: ${credentials.createdAt}`, 'info');
                this.log(`📅 Last Accessed: ${credentials.lastAccessedAt || 'Never'}`, 'info');
                this.log(`📊 Status: ${credentials.status}`, 'info');
                return credentials;
            } else {
                this.log(`❌ No ${service.toUpperCase()} credentials found`, 'error');
                return null;
            }
        } catch (error) {
            this.log(`❌ Error checking ${service} credentials: ${error.message}`, 'error');
            return null;
        }
    }

    async runCheck() {
        this.log('\n🚀 ===== WAKESHIA DAVIS CREDENTIAL CHECK =====\n', 'header');
        this.log(`Checking credentials for: ${this.userData.name} (${this.userData.email})`, 'info');
        this.log(`User ID: ${this.userData.id}`, 'info');
        this.log('\n' + '-'.repeat(60) + '\n', 'info');

        try {
            // Step 1: Initialize services
            await this.initialize();

            // Step 2: Check all stored credentials
            const results = await this.checkAllUserCredentials();

            // Step 3: Specific IdentityIQ check (the one mentioned in the issue)
            if (results.hasIdentityIQ) {
                await this.checkSpecificCredential('identityiq');
            }

            // Step 4: Conclusion
            this.log('\n📋 CONCLUSIONS:', 'header');
            
            if (results.hasAnyCredentials) {
                this.log('✅ Wakeshia HAS credentials stored in database', 'success');
                if (results.hasIdentityIQ) {
                    this.log('🎯 IdentityIQ credentials are present - GHL tagging failure is due to expired refresh token', 'info');
                    this.log('💡 Once GHL token is refreshed, tagging should work automatically', 'info');
                } else {
                    this.log('❌ IdentityIQ credentials missing - user needs to re-upload', 'warning');
                }
            } else {
                this.log('❌ Wakeshia has NO credentials stored - JWT token issue prevented uploads', 'error');
                this.log('🔧 Fix JWT token issue first, then have user re-upload ALL credentials', 'warning');
            }

            this.log('\n✅ Wakeshia Davis credential check completed!', 'success');

        } catch (error) {
            this.log(`💥 Check failed: ${error.message}`, 'error');
            console.error(error.stack);
        }
    }
}

// Run the check if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const checker = new WakeshiaCredentialChecker();
    checker.runCheck().catch(error => {
        console.error('❌ Credential check failed:', error);
        process.exit(1);
    });
}

export default WakeshiaCredentialChecker; 