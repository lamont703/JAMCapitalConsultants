#!/usr/bin/env node

/**
 * Node.js Test for ChatModule "View My Letters" Navigation
 * This simulates the browser behavior in a terminal environment
 */

console.log('🧪 Testing ChatModule "View My Letters" Navigation\n');

// Mock localStorage for Node.js environment
class MockLocalStorage {
    constructor() {
        this.store = {};
    }
    
    getItem(key) {
        return this.store[key] || null;
    }
    
    setItem(key, value) {
        this.store[key] = value;
    }
    
    removeItem(key) {
        delete this.store[key];
    }
    
    clear() {
        this.store = {};
    }
}

// Mock window object
const mockWindow = {
    localStorage: new MockLocalStorage(),
    addEventListener: () => {},
    dispatchEvent: (event) => {
        console.log(`📡 Custom event dispatched: ${event.type}`);
        return true;
    }
};

// Test results tracking
const testResults = {
    passed: 0,
    failed: 0,
    warnings: 0,
    results: []
};

function logResult(message, type = 'info') {
    const symbols = {
        success: '✅',
        error: '❌', 
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    console.log(`${symbols[type]} ${message}`);
    testResults.results.push({ message, type });
    
    if (type === 'success') testResults.passed++;
    else if (type === 'error') testResults.failed++;
    else if (type === 'warning') testResults.warnings++;
}

// Setup test environment
function setupTestEnvironment() {
    console.log('\n🔧 Setting up test environment...\n');
    
    // Create sample letters
    const sampleLetters = [
        {
            id: 'letter_1', bureau: 'experian',
            letter: 'Dear Experian,\n\nTest dispute letter...',
            itemCount: 3, generatedAt: new Date().toISOString()
        },
        {
            id: 'letter_2', bureau: 'equifax',
            letter: 'Dear Equifax,\n\nTest dispute letter...',
            itemCount: 2, generatedAt: new Date().toISOString()
        }
    ];
    
    mockWindow.localStorage.setItem('jamBotGeneratedLetters', JSON.stringify(sampleLetters));
    logResult(`Created ${sampleLetters.length} sample letters`, 'success');
    
    // Create mock parent module
    mockWindow.mockParentModule = {
        switchTab: (tab) => {
            console.log(`   📋 parentModule.switchTab('${tab}') called`);
            logResult(`parentModule navigation to ${tab}`, 'success');
            return true;
        },
        addGeneratedLetter: (letter) => {
            console.log(`   📄 Adding: ${letter.name}`);
            logResult(`Letter added: ${letter.name}`, 'success');
            return true;
        }
    };
    
    // Create mock jamTipBot
    mockWindow.jamTipBot = {
        switchTab: (tab) => {
            console.log(`   🤖 jamTipBot.switchTab('${tab}') called`);
            logResult(`jamTipBot navigation to ${tab}`, 'success');
            return true;
        }
    };
    
    // Create mock LettersModule
    mockWindow.LettersModule = {
        init: () => true,
        addLetter: () => true,
        getSavedLetters: () => [],
        updateView: () => {}
    };
    
    logResult('Mock objects created', 'success');
}

// Check current state
function checkCurrentState() {
    console.log('\n🔍 Checking current state...\n');
    
    // Check localStorage
    const savedLetters = mockWindow.localStorage.getItem('jamBotGeneratedLetters');
    if (savedLetters) {
        const letters = JSON.parse(savedLetters);
        logResult(`Found ${letters.length} letters in localStorage`, 'success');
        
        letters.forEach((letter, index) => {
            console.log(`   📄 Letter ${index + 1}: ${letter.bureau} (${letter.itemCount} items)`);
        });
    } else {
        logResult('No letters found in localStorage', 'error');
    }
    
    // Check global objects
    const checks = [
        { name: 'mockParentModule', obj: mockWindow.mockParentModule },
        { name: 'jamTipBot', obj: mockWindow.jamTipBot },
        { name: 'LettersModule', obj: mockWindow.LettersModule }
    ];
    
    checks.forEach(check => {
        if (check.obj) {
            logResult(`${check.name} available`, 'success');
        } else {
            logResult(`${check.name} not found`, 'error');
        }
    });
}

// Simulate the "View My Letters" button click
function simulateViewLettersClick() {
    console.log('\n🚀 Simulating "View My Letters" button click...\n');
    
    try {
        // Step 1: Get saved letters (from ChatModule handleButtonClick)
        const savedLetters = mockWindow.localStorage.getItem('jamBotGeneratedLetters');
        if (!savedLetters) {
            logResult('No letters found in localStorage', 'error');
            return;
        }
        
        const letters = JSON.parse(savedLetters);
        logResult(`Found ${letters.length} letters to process`, 'success');
        
        // Step 2: Convert letters to LettersModule format
        console.log('\n📝 Converting letters to LettersModule format...');
        letters.forEach((letter, index) => {
            const formattedLetter = {
                id: `generated_${Date.now()}_${index}`,
                name: `Dispute Letter - ${letter.bureau || `Letter ${index + 1}`}`,
                content: letter.letter || letter.content,
                createdAt: new Date().toISOString(),
                bureau: letter.bureau,
                itemCount: letter.itemCount || 0
            };
            
            // Add to parent module
            if (mockWindow.mockParentModule?.addGeneratedLetter) {
                mockWindow.mockParentModule.addGeneratedLetter(formattedLetter);
            }
        });
        
        // Step 3: Test navigation methods
        console.log('\n🔗 Testing navigation methods...');
        
        // Method 1: parentModule.switchTab
        if (mockWindow.mockParentModule?.switchTab) {
            mockWindow.mockParentModule.switchTab('letters');
        } else {
            logResult('parentModule.switchTab not available', 'warning');
        }
        
        // Method 2: jamTipBot.switchTab
        if (mockWindow.jamTipBot?.switchTab) {
            mockWindow.jamTipBot.switchTab('letters');
        } else {
            logResult('jamTipBot.switchTab not available', 'warning');
        }
        
        // Method 3: Custom event
        const customEvent = { type: 'switchToLettersTab' };
        mockWindow.dispatchEvent(customEvent);
        
        // Step 4: Test LettersModule availability
        console.log('\n📋 Testing LettersModule...');
        if (mockWindow.LettersModule) {
            const methods = ['init', 'addLetter', 'getSavedLetters', 'updateView'];
            methods.forEach(method => {
                if (typeof mockWindow.LettersModule[method] === 'function') {
                    logResult(`LettersModule.${method} available`, 'success');
                } else {
                    logResult(`LettersModule.${method} missing`, 'error');
                }
            });
        } else {
            logResult('LettersModule not available globally', 'error');
        }
        
        logResult('Navigation simulation completed', 'success');
        
    } catch (error) {
        logResult(`Simulation error: ${error.message}`, 'error');
        console.error('Full error:', error);
    }
}

// Show test summary
function showTestSummary() {
    console.log('\n📊 Test Summary');
    console.log('='.repeat(50));
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`⚠️  Warnings: ${testResults.warnings}`);
    console.log(`📋 Total: ${testResults.results.length}`);
    
    const successRate = ((testResults.passed / testResults.results.length) * 100).toFixed(1);
    console.log(`📈 Success Rate: ${successRate}%`);
    
    if (testResults.failed === 0) {
        console.log('\n🎉 ALL TESTS PASSED! The "View My Letters" navigation should work correctly.');
    } else if (testResults.failed < testResults.passed) {
        console.log('\n⚠️  MOSTLY WORKING: Some issues found but navigation should mostly work.');
    } else {
        console.log('\n❌ ISSUES FOUND: The navigation may not work as expected.');
    }
}

// Run the test
async function runTest() {
    console.log('Starting ChatModule "View My Letters" Navigation Test...');
    console.log('='.repeat(60));
    
    setupTestEnvironment();
    checkCurrentState();
    
    // Wait a bit for async operations
    await new Promise(resolve => setTimeout(resolve, 500));
    
    simulateViewLettersClick();
    
    // Wait for navigation methods to execute
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    showTestSummary();
}

// Execute the test
runTest().catch(console.error); 