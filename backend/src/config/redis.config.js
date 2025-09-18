const { createClient } = require('redis');

const createRedisClient = () => {
    const client = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    
    client.on('error', (err) => {
        console.error('❌ Redis Client Error:', err);
    });
    
    client.on('connect', () => {
        console.log('✅ Connected to Redis');
    });
    
    client.on('ready', () => {
        console.log('✅ Redis client ready');
    });
    
    client.on('end', () => {
        console.log('🔌 Redis connection closed');
    });
    
    return client;
};

module.exports = { createRedisClient };