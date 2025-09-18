const { createRedisClient } = require('../config/redis.config');

class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      this.client = createRedisClient();
      await this.client.connect();
      this.isConnected = true;
      
      // Test connection
      await this.client.ping();
      console.log('✅ Redis connection established and tested');
      
      return this.client;
    } catch (error) {
      console.error('❌ Failed to connect to Redis:', error);
      this.isConnected = false;
      throw error;
    }
  }

  async disconnect() {
    if (this.client && this.isConnected) {
      try {
        await this.client.disconnect();
        this.isConnected = false;
        console.log('✅ Redis disconnected gracefully');
      } catch (error) {
        console.error('❌ Error disconnecting from Redis:', error);
      }
    }
  }

  // Session management methods
  async getSessionHistory(sessionId) {
    try {
      if (!this.isConnected) {
        console.warn('⚠️ Redis not connected, returning empty history');
        return [];
      }
      
      const history = await this.client.get(`session:${sessionId}`);
      return history ? JSON.parse(history) : [];
    } catch (error) {
      console.error('❌ Error getting session history:', error);
      return [];
    }
  }

  async addToSessionHistory(sessionId, message) {
    try {
      if (!this.isConnected) {
        console.warn('⚠️ Redis not connected, cannot save message');
        return [];
      }

      const history = await this.getSessionHistory(sessionId);
      const messageWithTimestamp = {
        ...message,
        timestamp: new Date().toISOString()
      };
      
      history.push(messageWithTimestamp);

      // Keep only last 50 messages to prevent memory issues
      const trimmedHistory = history.slice(-50);

      const ttl = parseInt(process.env.SESSION_TTL) || 86400; // 24 hours default
      await this.client.setEx(
        `session:${sessionId}`,
        ttl,
        JSON.stringify(trimmedHistory)
      );

      console.log(`💾 Added message to session ${sessionId.slice(0, 8)}... (${trimmedHistory.length} total messages)`);
      return trimmedHistory;
    } catch (error) {
      console.error('❌ Error adding to session history:', error);
      throw error;
    }
  }

  async clearSession(sessionId) {
    try {
      if (!this.isConnected) {
        console.warn('⚠️ Redis not connected, cannot clear session');
        return false;
      }
      
      const result = await this.client.del(`session:${sessionId}`);
      console.log(`🗑️ Cleared session ${sessionId.slice(0, 8)}...`);
      return result > 0;
    } catch (error) {
      console.error('❌ Error clearing session:', error);
      return false;
    }
  }

  // Cache management for query results
  async cacheQuery(queryHash, results, ttl = 3600) {
    try {
      if (!this.isConnected) {
        console.warn('⚠️ Redis not connected, cannot cache query');
        return;
      }
      
      await this.client.setEx(
        `query:${queryHash}`,
        ttl,
        JSON.stringify(results)
      );
      console.log(`📦 Cached query result for ${ttl}s`);
    } catch (error) {
      console.error('❌ Error caching query:', error);
    }
  }

  async getCachedQuery(queryHash) {
    try {
      if (!this.isConnected) {
        return null;
      }
      
      const cached = await this.client.get(`query:${queryHash}`);
      if (cached) {
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      console.error('❌ Error getting cached query:', error);
      return null;
    }
  }

  // Performance monitoring
  async getCacheStats() {
    try {
      if (!this.isConnected) {
        return null;
      }
      
      const info = await this.client.info('memory');
      const keyspace = await this.client.info('keyspace');
      
      return {
        memory: info,
        keyspace: keyspace,
        connected: this.isHealthy()
      };
    } catch (error) {
      console.error('❌ Error getting cache stats:', error);
      return null;
    }
  }

  isHealthy() {
    return this.isConnected && this.client && this.client.isReady;
  }

  // Get session count for monitoring
  async getSessionCount() {
    try {
      if (!this.isConnected) return 0;
      
      const keys = await this.client.keys('session:*');
      return keys.length;
    } catch (error) {
      console.error('❌ Error getting session count:', error);
      return 0;
    }
  }

  // Get query cache count for monitoring
  async getQueryCacheCount() {
    try {
      if (!this.isConnected) return 0;
      
      const keys = await this.client.keys('query:*');
      return keys.length;
    } catch (error) {
      console.error('❌ Error getting query cache count:', error);
      return 0;
    }
  }
}

// Export singleton instance
const redisService = new RedisService();
module.exports = redisService;