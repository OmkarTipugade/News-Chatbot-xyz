#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

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

function checkFile(filePath, description) {
    if (fs.existsSync(filePath)) {
        log('green', `✅ ${description}`);
        return true;
    } else {
        log('red', `❌ ${description} - File not found: ${filePath}`);
        return false;
    }
}

function checkEnvVar(varName, description) {
    const value = process.env[varName];
    if (value && value.trim() !== '') {
        log('green', `✅ ${description}`);
        return true;
    } else {
        log('red', `❌ ${description} - Environment variable ${varName} not set`);
        return false;
    }
}

async function checkRedis() {
    return new Promise((resolve) => {
        const redis = spawn('redis-cli', ['ping']);

        redis.on('close', (code) => {
            if (code === 0) {
                log('green', '✅ Redis server is running');
                resolve(true);
            } else {
                log('red', '❌ Redis server is not running');
                log('yellow', '   Start Redis with: brew services start redis (macOS) or sudo systemctl start redis-server (Linux)');
                resolve(false);
            }
        });

        redis.on('error', () => {
            log('red', '❌ Redis CLI not found or Redis server not running');
            resolve(false);
        });
    });
}

async function checkChromaDB() {
    const chromaPath = path.join(__dirname, 'scripts', 'news_output', 'chroma_db');
    const sqlitePath = path.join(chromaPath, 'chroma.sqlite3');

    if (fs.existsSync(chromaPath) && fs.existsSync(sqlitePath)) {
        log('green', '✅ ChromaDB database exists');
        return true;
    } else {
        log('red', '❌ ChromaDB database not found');
        log('yellow', '   Run: cd scripts && python ingest.py');
        return false;
    }
}

async function main() {
    log('blue', '🔍 Backend Setup Checklist\n');

    let allGood = true;

    // Check required files
    log('yellow', '📁 Checking Required Files:');
    allGood &= checkFile('.env', 'Environment file (.env)');
    allGood &= checkFile('src/index.js', 'Main server file');
    allGood &= checkFile('src/services/chatbot.service.js', 'Chatbot service');
    allGood &= checkFile('src/services/redis.service.js', 'Redis service');
    allGood &= checkFile('src/routes/chat.routes.js', 'Chat routes');

    // Load environment variables
    require('dotenv').config();

    // Check environment variables
    log('yellow', '\n🔧 Checking Environment Variables:');
    allGood &= checkEnvVar('GEMINI_API_KEY', 'Gemini API Key');
    allGood &= checkEnvVar('PORT', 'Server Port');
    allGood &= checkEnvVar('FRONTEND_URL', 'Frontend URL');
    allGood &= checkEnvVar('REDIS_URL', 'Redis URL');

    // Check external services
    log('yellow', '\n🔌 Checking External Services:');
    allGood &= await checkRedis();
    allGood &= await checkChromaDB();

    // Check Node modules
    log('yellow', '\n📦 Checking Dependencies:');
    const nodeModulesExists = fs.existsSync('node_modules');
    if (nodeModulesExists) {
        log('green', '✅ Node modules installed');
    } else {
        log('red', '❌ Node modules not installed');
        log('yellow', '   Run: npm install');
        allGood = false;
    }

    // Final result
    log('yellow', '\n📋 Setup Status:');
    if (allGood) {
        log('green', '🎉 All checks passed! Backend is ready to start.');
        log('blue', '\nTo start the backend:');
        log('blue', '   npm run dev    (development mode)');
        log('blue', '   npm start      (production mode)');
        log('blue', '   npm test       (run tests)');
    } else {
        log('red', '❌ Some checks failed. Please fix the issues above before starting the backend.');
    }

    return allGood;
}

if (require.main === module) {
    main().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = { main };