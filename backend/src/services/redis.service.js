const { createClient } = require('redis');

class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      this.client = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      });

      this.client.on('error', (err) => {
        console.error('Redis Client Error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('✅ Connected to Redis');
        this.isConnected = true;
      });

      await this.client.connect();
      return this.client;
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      throw error;
    }
  }
  

  async disconnect() {
    if (this.client) {
      await this.client.disconnect();
      this.isConnected = false;
    }
  }

  // Session management methods
  async getSessionHistory(sessionId) {
    try {
      const history = await this.client.get(`session:${sessionId}`);
      return history ? JSON.parse(history) : [];
    } catch (error) {
      console.error('Error getting session history:', error);
      return [];
    }
  }

  async addToSessionHistory(sessionId, message) {
    try {
      const history = await this.getSessionHistory(sessionId);
      history.push({
        ...message,
        timestamp: new Date().toISOString()
      });

      // Keep only last 50 messages to prevent memory issues
      const trimmedHistory = history.slice(-50);

      await this.client.setEx(
        `session:${sessionId}`,
        parseInt(process.env.SESSION_TTL) || 86400, // 24 hours default
        JSON.stringify(trimmedHistory)
      );

      return trimmedHistory;
    } catch (error) {
      console.error('Error adding to session history:', error);
      throw error;
    }
  }

  async clearSession(sessionId) {
    try {
      await this.client.del(`session:${sessionId}`);
      return true;
    } catch (error) {
      console.error('Error clearing session:', error);
      return false;
    }
  }

  // Cache management for embeddings/results
  async cacheQuery(queryHash, results, ttl = 3600) {
    try {
      await this.client.setEx(
        `query:${queryHash}`,
        ttl,
        JSON.stringify(results)
      );
      console.log(`📦 Cached query result for ${ttl}s`);
    } catch (error) {
      console.error('Error caching query:', error);
    }
  }

  async getCachedQuery(queryHash) {
    try {
      const cached = await this.client.get(`query:${queryHash}`);
      if (cached) {
        console.log('📦 Retrieved cached query result');
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      console.error('Error getting cached query:', error);
      return null;
    }
  }

  // Performance monitoring
  async getCacheStats() {
    try {
      const info = await this.client.info('memory');
      const keyspace = await this.client.info('keyspace');
      
      return {
        memory: info,
        keyspace: keyspace,
        connected: this.isHealthy()
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return null;
    }
  }

  isHealthy() {
    return this.isConnected && this.client && this.client.isReady;
  }
}

// Export singleton instance
const redisService = new RedisService();
module.exports = redisService;