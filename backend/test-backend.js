#!/usr/bin/env node

const axios = require('axios');
const { spawn } = require('child_process');

const API_BASE = 'http://localhost:4000';

// Colors for console output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

const log = (color, message) => {
    console.log(`${colors[color]}${message}${colors.reset}`);
};

async function testEndpoint(method, url, data = null, expectedStatus = 200) {
    try {
        const config = {
            method,
            url: `${API_BASE}${url}`,
            timeout: 10000
        };

        if (data) {
            config.data = data;
            config.headers = { 'Content-Type': 'application/json' };
        }

        const response = await axios(config);

        if (response.status === expectedStatus) {
            log('green', `✅ ${method} ${url} - Status: ${response.status}`);
            return { success: true, data: response.data };
        } else {
            log('red', `❌ ${method} ${url} - Expected: ${expectedStatus}, Got: ${response.status}`);
            return { success: false, error: `Unexpected status: ${response.status}` };
        }
    } catch (error) {
        log('red', `❌ ${method} ${url} - Error: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function runTests() {
    log('blue', '🧪 Starting Backend Tests...\n');

    // Test 1: Health Check
    log('yellow', '1. Testing Health Check...');
    const healthResult = await testEndpoint('GET', '/api/health');

    if (healthResult.success) {
        console.log('   Services:', JSON.stringify(healthResult.data.services, null, 2));
    }

    // Test 2: Root Endpoint
    log('yellow', '\n2. Testing Root Endpoint...');
    await testEndpoint('GET', '/');

    // Test 3: Create New Session
    log('yellow', '\n3. Testing Session Creation...');
    const sessionResult = await testEndpoint('POST', '/api/session/new');
    let sessionId = null;

    if (sessionResult.success) {
        sessionId = sessionResult.data.sessionId;
        console.log('   Session ID:', sessionId);
    }

    // Test 4: Send Chat Message (if session created)
    if (sessionId) {
        log('yellow', '\n4. Testing Chat Message...');
        const chatResult = await testEndpoint('POST', '/api/chat', {
            message: 'Hello, can you tell me about recent news?',
            sessionId: sessionId
        });

        if (chatResult.success) {
            console.log('   Response:', chatResult.data.response.substring(0, 100) + '...');
            console.log('   Sources:', chatResult.data.sources?.length || 0);
        }

        // Test 5: Get Session History
        log('yellow', '\n5. Testing Session History...');
        const historyResult = await testEndpoint('GET', `/api/session/${sessionId}/history`);

        if (historyResult.success) {
            console.log('   Messages in history:', historyResult.data.count);
        }

        // Test 6: Clear Session
        log('yellow', '\n6. Testing Session Clear...');
        await testEndpoint('DELETE', `/api/session/${sessionId}`);
    }

    // Test 7: Invalid Endpoints
    log('yellow', '\n7. Testing Invalid Endpoint...');
    await testEndpoint('GET', '/api/nonexistent', null, 404);

    log('blue', '\n🏁 Tests Complete!');
}

async function checkPrerequisites() {
    log('blue', '🔍 Checking Prerequisites...\n');

    // Check if server is running
    try {
        await axios.get(`${API_BASE}/`, { timeout: 5000 });
        log('green', '✅ Backend server is running');
        return true;
    } catch (error) {
        log('red', '❌ Backend server is not running');
        log('yellow', '   Please start the server with: npm run dev');
        return false;
    }
}

async function main() {
    const serverRunning = await checkPrerequisites();

    if (serverRunning) {
        await runTests();
    } else {
        process.exit(1);
    }
}

// Handle script execution
if (require.main === module) {
    main().catch(error => {
        log('red', `❌ Test failed: ${error.message}`);
        process.exit(1);
    });
}

module.exports = { testEndpoint, runTests };