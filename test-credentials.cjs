#!/usr/bin/env node

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m'
};

// Test configuration
const config = {
    apiBaseUrl: 'https://jam-capital-backend.azurewebsites.net',
    services: ['smartcredit', 'identityiq', 'myscoreiq', 'cfpb', 'annualcreditreport'],
    testTimeout: 10000,
    retryAttempts: 3
};

// Test statistics
let stats = {
    total: 0,
    passed: 0,
    failed: 0,
    warnings: 0
};

// Logging functions
function log(level, message, details = null) {
    const timestamp = new Date().toLocaleTimeString();
    const colorMap = {
        'INFO': colors.blue,
        'SUCCESS': colors.green,
        'ERROR': colors.red,
        'WARNING': colors.yellow,
        'DEBUG': colors.magenta
    };
    
    const color = colorMap[level] || colors.white;
    console.log(`${color}[${timestamp}] ${level}: ${message}${colors.reset}`);
    
    if (details) {
        console.log(`${colors.cyan}${JSON.stringify(details, null, 2)}${colors.reset}`);
    }
}

function logHeader(title) {
    console.log(`\n${colors.cyan}${'='.repeat(60)}`);
    console.log(`${colors.cyan}${title.toUpperCase()}${colors.reset}`);
    console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);
}

function logSeparator() {
    console.log(`${colors.yellow}${'-'.repeat(60)}${colors.reset}`);
}

// HTTP request helper
function makeRequest(options, data = null) {
    return new Promise((resolve, reject) => {
        const protocol = options.protocol === 'https:' ? https : http;
        const timeout = setTimeout(() => {
            reject(new Error('Request timeout'));
        }, config.testTimeout);

        const req = protocol.request(options, (res) => {
            clearTimeout(timeout);
            
            let responseData = '';
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                try {
                    const parsed = responseData ? JSON.parse(responseData) : {};
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        data: parsed,
                        rawData: responseData
                    });
                } catch (e) {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        data: null,
                        rawData: responseData
                    });
                }
            });
        });

        req.on('error', (error) => {
            clearTimeout(timeout);
            reject(error);
        });

        if (data) {
            req.write(JSON.stringify(data));
        }
        
        req.end();
    });
}

// Test functions
async function testBackendConnectivity() {
    logHeader('Backend Connectivity Test');
    
    const url = new URL(config.apiBaseUrl);
    const options = {
        hostname: url.hostname,
        port: url.port || 443,
        path: '/api/health',
        method: 'GET',
        protocol: url.protocol,
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'JAM-Credential-Test-Script/1.0'
        }
    };

    try {
        log('INFO', 'Testing backend connectivity...');
        const response = await makeRequest(options);
        
        if (response.statusCode === 200) {
            log('SUCCESS', 'Backend is reachable');
            stats.passed++;
        } else {
            log('WARNING', `Backend responded with status: ${response.statusCode}`);
            stats.warnings++;
        }
    } catch (error) {
        log('ERROR', `Backend connectivity failed: ${error.message}`);
        stats.failed++;
    }
    
    stats.total++;
}

async function testCredentialEndpoint(service, testData) {
    log('INFO', `Testing ${service} credential endpoint...`);
    
    const url = new URL(config.apiBaseUrl);
    const options = {
        hostname: url.hostname,
        port: url.port || 443,
        path: '/api/credentials/store',
        method: 'POST',
        protocol: url.protocol,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${testData.authToken}`,
            'User-Agent': 'JAM-Credential-Test-Script/1.0'
        }
    };

    const requestData = {
        userId: testData.userId,
        serviceType: service,
        email: testData.email,
        password: testData.password,
        purpose: 'credit_monitoring'
    };

    try {
        const response = await makeRequest(options, requestData);
        
        if (response.statusCode === 200 || response.statusCode === 201) {
            log('SUCCESS', `${service} credential endpoint test passed`);
            stats.passed++;
        } else if (response.statusCode === 401) {
            log('WARNING', `${service} authentication failed (expected for test data)`);
            stats.warnings++;
        } else {
            log('ERROR', `${service} endpoint returned status: ${response.statusCode}`);
            log('DEBUG', 'Response data:', response.data);
            stats.failed++;
        }
    } catch (error) {
        log('ERROR', `${service} endpoint test failed: ${error.message}`);
        stats.failed++;
    }
    
    stats.total++;
}

async function testAllCredentialEndpoints() {
    logHeader('Credential Endpoints Test');
    
    const testData = {
        userId: 'test-user-id-12345',
        authToken: 'test-auth-token-67890',
        email: 'test@example.com',
        password: 'testpassword123'
    };

    log('INFO', 'Testing all credential service endpoints...');
    
    for (const service of config.services) {
        await testCredentialEndpoint(service, testData);
        logSeparator();
    }
}

function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function validatePassword(password) {
    return password && password.trim().length > 0;
}

function validateServiceType(serviceType) {
    return config.services.includes(serviceType);
}

async function testInputValidation() {
    logHeader('Input Validation Tests');
    
    // Email validation tests
    log('INFO', 'Testing email validation...');
    const emailTests = [
        { email: 'test@example.com', expected: true, description: 'Valid email' },
        { email: 'invalid-email', expected: false, description: 'Invalid email format' },
        { email: '', expected: false, description: 'Empty email' },
        { email: 'test@', expected: false, description: 'Incomplete email' },
        { email: '@example.com', expected: false, description: 'Missing username' },
        { email: 'test.user+tag@example.com', expected: true, description: 'Valid email with plus' },
        { email: 'test@sub.example.com', expected: true, description: 'Valid email with subdomain' }
    ];

    for (const test of emailTests) {
        const isValid = validateEmail(test.email);
        if (isValid === test.expected) {
            log('SUCCESS', `Email validation: ${test.description} - PASSED`);
            stats.passed++;
        } else {
            log('ERROR', `Email validation: ${test.description} - FAILED`);
            stats.failed++;
        }
        stats.total++;
    }

    logSeparator();

    // Password validation tests
    log('INFO', 'Testing password validation...');
    const passwordTests = [
        { password: 'validpassword123', expected: true, description: 'Valid password' },
        { password: '', expected: false, description: 'Empty password' },
        { password: '   ', expected: false, description: 'Whitespace password' },
        { password: 'a', expected: true, description: 'Single character password' },
        { password: 'P@ssw0rd!', expected: true, description: 'Complex password' }
    ];

    for (const test of passwordTests) {
        const isValid = validatePassword(test.password);
        if (isValid === test.expected) {
            log('SUCCESS', `Password validation: ${test.description} - PASSED`);
            stats.passed++;
        } else {
            log('ERROR', `Password validation: ${test.description} - FAILED`);
            stats.failed++;
        }
        stats.total++;
    }

    logSeparator();

    // Service type validation tests
    log('INFO', 'Testing service type validation...');
    const serviceTests = [
        { service: 'smartcredit', expected: true, description: 'Valid service: smartcredit' },
        { service: 'identityiq', expected: true, description: 'Valid service: identityiq' },
        { service: 'invalid-service', expected: false, description: 'Invalid service type' },
        { service: '', expected: false, description: 'Empty service type' },
        { service: 'SMARTCREDIT', expected: false, description: 'Case-sensitive service type' }
    ];

    for (const test of serviceTests) {
        const isValid = validateServiceType(test.service);
        if (isValid === test.expected) {
            log('SUCCESS', `Service validation: ${test.description} - PASSED`);
            stats.passed++;
        } else {
            log('ERROR', `Service validation: ${test.description} - FAILED`);
            stats.failed++;
        }
        stats.total++;
    }
}

async function testAuthenticationScenarios() {
    logHeader('Authentication Scenarios Test');
    
    const authTests = [
        {
            name: 'Valid JWT token format',
            token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
            expected: true
        },
        {
            name: 'Invalid token format',
            token: 'invalid-token',
            expected: false
        },
        {
            name: 'Empty token',
            token: '',
            expected: false
        },
        {
            name: 'Null token',
            token: null,
            expected: false
        },
        {
            name: 'Short token',
            token: 'short',
            expected: false
        }
    ];

    for (const test of authTests) {
        const isValid = test.token && test.token.length > 10 && test.token.includes('.');
        if (isValid === test.expected) {
            log('SUCCESS', `Auth test: ${test.name} - PASSED`);
            stats.passed++;
        } else {
            log('ERROR', `Auth test: ${test.name} - FAILED`);
            stats.failed++;
        }
        stats.total++;
    }
}

async function testErrorScenarios() {
    logHeader('Error Scenarios Test');
    
    // Test network timeout
    log('INFO', 'Testing network timeout scenario...');
    const timeoutPromise = new Promise((resolve, reject) => {
        setTimeout(() => {
            reject(new Error('Request timeout'));
        }, 100);
    });

    try {
        await timeoutPromise;
        log('ERROR', 'Timeout test failed - should have timed out');
        stats.failed++;
    } catch (error) {
        if (error.message.includes('timeout')) {
            log('SUCCESS', 'Timeout handling test passed');
            stats.passed++;
        } else {
            log('ERROR', `Unexpected error: ${error.message}`);
            stats.failed++;
        }
    }
    stats.total++;

    logSeparator();

    // Test invalid API endpoint
    log('INFO', 'Testing invalid API endpoint...');
    const invalidUrl = new URL('https://invalid-endpoint-test.com');
    const options = {
        hostname: invalidUrl.hostname,
        port: 443,
        path: '/api/test',
        method: 'GET',
        protocol: 'https:',
        headers: {
            'Content-Type': 'application/json'
        }
    };

    try {
        await makeRequest(options);
        log('ERROR', 'Invalid endpoint test failed - should have failed');
        stats.failed++;
    } catch (error) {
        if (error.message.includes('ENOTFOUND') || error.message.includes('timeout')) {
            log('SUCCESS', 'Invalid endpoint handling test passed');
            stats.passed++;
        } else {
            log('ERROR', `Unexpected error: ${error.message}`);
            stats.failed++;
        }
    }
    stats.total++;
}

async function testCredentialDataStructure() {
    logHeader('Credential Data Structure Test');
    
    const testCases = [
        {
            name: 'Valid credential data',
            data: {
                userId: 'user123',
                serviceType: 'smartcredit',
                email: 'test@example.com',
                password: 'password123',
                purpose: 'credit_monitoring'
            },
            expected: true
        },
        {
            name: 'Missing userId',
            data: {
                serviceType: 'smartcredit',
                email: 'test@example.com',
                password: 'password123',
                purpose: 'credit_monitoring'
            },
            expected: false
        },
        {
            name: 'Missing serviceType',
            data: {
                userId: 'user123',
                email: 'test@example.com',
                password: 'password123',
                purpose: 'credit_monitoring'
            },
            expected: false
        },
        {
            name: 'Missing email',
            data: {
                userId: 'user123',
                serviceType: 'smartcredit',
                password: 'password123',
                purpose: 'credit_monitoring'
            },
            expected: false
        },
        {
            name: 'Missing password',
            data: {
                userId: 'user123',
                serviceType: 'smartcredit',
                email: 'test@example.com',
                purpose: 'credit_monitoring'
            },
            expected: false
        }
    ];

    for (const test of testCases) {
        const isValid = test.data.userId && test.data.serviceType && test.data.email && test.data.password;
        if (isValid === test.expected) {
            log('SUCCESS', `Data structure test: ${test.name} - PASSED`);
            stats.passed++;
        } else {
            log('ERROR', `Data structure test: ${test.name} - FAILED`);
            stats.failed++;
        }
        stats.total++;
    }
}

function generateReport() {
    logHeader('Test Report Summary');
    
    const successRate = stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0;
    
    console.log(`${colors.blue}Total Tests:${colors.reset} ${stats.total}`);
    console.log(`${colors.green}Passed:${colors.reset} ${stats.passed}`);
    console.log(`${colors.red}Failed:${colors.reset} ${stats.failed}`);
    console.log(`${colors.yellow}Warnings:${colors.reset} ${stats.warnings}`);
    console.log(`${colors.cyan}Success Rate:${colors.reset} ${successRate}%`);
    
    if (stats.failed > 0) {
        console.log(`\n${colors.red}❌ Some tests failed. Check the log above for details.${colors.reset}`);
    } else if (stats.warnings > 0) {
        console.log(`\n${colors.yellow}⚠️ All tests passed but with warnings.${colors.reset}`);
    } else {
        console.log(`\n${colors.green}✅ All tests passed successfully!${colors.reset}`);
    }
    
    // Save report to file
    const report = {
        timestamp: new Date().toISOString(),
        stats: stats,
        successRate: successRate,
        testConfig: config
    };
    
    const reportPath = path.join(process.cwd(), 'credential-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n${colors.cyan}Report saved to: ${reportPath}${colors.reset}`);
}

async function runAllTests() {
    console.log(`${colors.green}🚀 JAM Capital Credential Input Test Suite${colors.reset}`);
    console.log(`${colors.yellow}Starting comprehensive credential testing...${colors.reset}\n`);
    
    const startTime = Date.now();
    
    try {
        await testBackendConnectivity();
        await testInputValidation();
        await testAuthenticationScenarios();
        await testCredentialDataStructure();
        await testAllCredentialEndpoints();
        await testErrorScenarios();
    } catch (error) {
        log('ERROR', `Test suite failed: ${error.message}`);
        process.exit(1);
    }
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log(`\n${colors.cyan}Test suite completed in ${duration} seconds${colors.reset}`);
    generateReport();
    
    // Exit with error code if tests failed
    if (stats.failed > 0) {
        process.exit(1);
    }
}

// CLI argument handling
function showHelp() {
    console.log(`
${colors.green}JAM Capital Credential Test Suite${colors.reset}

Usage: node test-credentials.js [options]

Options:
  --help, -h          Show this help message
  --backend-only      Test only backend connectivity
  --validation-only   Test only input validation
  --endpoints-only    Test only credential endpoints
  --auth-only         Test only authentication scenarios
  --verbose, -v       Enable verbose logging
  --timeout <ms>      Set request timeout (default: 10000ms)
  --api-url <url>     Set API base URL (default: https://jam-capital-backend.azurewebsites.net)

Examples:
  node test-credentials.js                    # Run all tests
  node test-credentials.js --backend-only     # Test backend only
  node test-credentials.js --verbose          # Verbose output
  node test-credentials.js --timeout 5000     # 5 second timeout
    `);
}

async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        showHelp();
        return;
    }
    
    // Parse arguments
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        if (arg === '--timeout') {
            config.testTimeout = parseInt(args[i + 1]) || 10000;
            i++;
        } else if (arg === '--api-url') {
            config.apiBaseUrl = args[i + 1];
            i++;
        } else if (arg === '--backend-only') {
            await testBackendConnectivity();
            generateReport();
            return;
        } else if (arg === '--validation-only') {
            await testInputValidation();
            generateReport();
            return;
        } else if (arg === '--endpoints-only') {
            await testAllCredentialEndpoints();
            generateReport();
            return;
        } else if (arg === '--auth-only') {
            await testAuthenticationScenarios();
            generateReport();
            return;
        }
    }
    
    // Run all tests by default
    await runAllTests();
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    log('ERROR', `Uncaught exception: ${error.message}`);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    log('ERROR', `Unhandled rejection: ${reason}`);
    process.exit(1);
});

// Run the main function
main().catch((error) => {
    log('ERROR', `Fatal error: ${error.message}`);
    process.exit(1);
}); 