#!/usr/bin/env node

/**
 * JAM Capital Consultants - System Health Check Script
 * 
 * This script performs comprehensive health checks for your JAM Capital system
 * tailored to your current configuration (without OpenAI integration).
 * 
 * Usage:
 *   node scripts/health-check.js
 *   NODE_ENV=development node scripts/health-check.js
 */

import dotenv from 'dotenv';
import { performance } from 'perf_hooks';

// Load environment variables
const environment = process.env.NODE_ENV || 'development';
dotenv.config({ path: `.env.${environment}` });

// Configuration based on environment
const config = {
    development: {
        apiBaseUrl: 'http://localhost:3000',
        timeout: 10000,
        expectedServices: ['cosmos', 'ghl', 'auth', 'storage']
    },
    testing: {
        apiBaseUrl: 'https://jam-capital-staging.azurewebsites.net',
        timeout: 15000,
        expectedServices: ['cosmos', 'ghl', 'auth', 'storage', 'appinsights']
    },
    production: {
        apiBaseUrl: 'https://jam-capital-backend.azurewebsites.net',
        timeout: 10000,
        expectedServices: ['cosmos', 'ghl', 'auth', 'storage', 'appinsights']
    }
};

const currentConfig = config[environment] || config.development;

class HealthChecker {
    constructor() {
        this.results = [];
        this.startTime = performance.now();
        this.criticalFailures = [];
        this.warnings = [];
        
        console.log(`🔍 JAM Capital Health Check - ${environment.toUpperCase()} Environment`);
        console.log('=' .repeat(70));
        console.log(`🌐 Target: ${currentConfig.apiBaseUrl}`);
        console.log(`⏱️  Timeout: ${currentConfig.timeout}ms`);
        console.log('');
    }

    async runHealthCheck() {
        try {
            // Run health checks based on your actual system
            await Promise.allSettled([
                this.checkHealthEndpoint(),
                this.checkAuthenticationSystem(),
                this.checkDatabaseConnectivity(),
                this.checkGoHighLevelIntegration(),
                this.checkAzureServices(),
                this.checkSecurityFeatures(),
                this.checkWebhookEndpoints(),
                this.checkSystemPerformance()
            ]);

            await this.generateReport();
            
        } catch (error) {
            console.error('❌ Critical error during health check:', error.message);
            process.exit(1);
        }
    }

    async checkHealthEndpoint() {
        const testName = 'Health Endpoint';
        const startTime = performance.now();
        
        try {
            console.log('🔍 Testing health endpoint...');
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), currentConfig.timeout);
            
            const response = await fetch(`${currentConfig.apiBaseUrl}/api/health`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'JAM-Health-Check/1.0'
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            const responseTime = performance.now() - startTime;

            if (response.ok) {
                const data = await response.json();
                this.addResult(testName, 'success', {
                    responseTime: Math.round(responseTime),
                    status: data.status,
                    uptime: data.uptime,
                    version: data.version
                });
                console.log(`   ✅ ${testName}: ${data.status} (${Math.round(responseTime)}ms)`);
            } else {
                this.addResult(testName, 'failed', {
                    responseTime: Math.round(responseTime),
                    httpStatus: response.status,
                    statusText: response.statusText
                });
                this.criticalFailures.push(`Health endpoint returned HTTP ${response.status}`);
                console.log(`   ❌ ${testName}: HTTP ${response.status} (${Math.round(responseTime)}ms)`);
            }
            
        } catch (error) {
            const responseTime = performance.now() - startTime;
            this.addResult(testName, 'failed', {
                responseTime: Math.round(responseTime),
                error: error.message
            });
            
            if (error.name === 'AbortError') {
                this.criticalFailures.push(`Health endpoint timeout (>${currentConfig.timeout}ms)`);
                console.log(`   ❌ ${testName}: Timeout after ${currentConfig.timeout}ms`);
            } else {
                this.criticalFailures.push(`Health endpoint connection failed: ${error.message}`);
                console.log(`   ❌ ${testName}: ${error.message}`);
            }
        }
    }

    addResult(testName, status, details) {
        this.results.push({
            test: testName,
            status,
            timestamp: new Date().toISOString(),
            ...details
        });
    }

    async generateReport() {
        const totalTime = performance.now() - this.startTime;
        
        console.log('\n\n📊 JAM CAPITAL HEALTH CHECK RESULTS');
        console.log('=' .repeat(50));

        // Calculate scores
        const totalTests = this.results.length;
        const successfulTests = this.results.filter(r => r.status === 'success').length;
        const warningTests = this.results.filter(r => r.status === 'warning').length;
        const failedTests = this.results.filter(r => r.status === 'failed').length;
        
        const healthScore = Math.round((successfulTests / totalTests) * 100);

        console.log(`📈 Health Score: ${healthScore}%`);
        console.log(`⏱️ Total Time: ${Math.round(totalTime)}ms`);
        console.log(`🧪 Tests: ${successfulTests} passed, ${warningTests} warnings, ${failedTests} failed`);
        console.log('');

        if (this.criticalFailures.length > 0) {
            console.log('❌ Health check failed - critical issues detected');
            process.exit(1);
        } else {
            console.log('✅ Health check completed');
            process.exit(0);
        }
    }
}

// Run the health check
const healthChecker = new HealthChecker();
healthChecker.runHealthCheck().catch(console.error);
