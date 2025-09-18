const { v4: uuidv4 } = require('uuid');
const redisService = require('./redis.service');

class SessionService {
  // Generate new session ID
  generateSessionId() {
    return uuidv4();
  }

  // Get session history
  async getHistory(sessionId) {
    if (!sessionId) {
      throw new Error('Session ID is required');
    }
    return await redisService.getSessionHistory(sessionId);
  }

  // Add message to session
  async addMessage(sessionId, role, content, metadata = {}) {
    if (!sessionId) {
      throw new Error('Session ID is required');
    }

    const message = {
      role, // 'user' or 'assistant'
      content,
      metadata,
      id: uuidv4()
    };

    return await redisService.addToSessionHistory(sessionId, message);
  }

  // Clear session
  async clearSession(sessionId) {
    if (!sessionId) {
      throw new Error('Session ID is required');
    }
    return await redisService.clearSession(sessionId);
  }

  // Get session context for RAG (last N messages)
  async getContextForRAG(sessionId, maxMessages = 5) {
    const history = await this.getHistory(sessionId);

    // Get last N messages for context
    const recentMessages = history.slice(-maxMessages);

    // Format for context
    return recentMessages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  }

  // Validate session exists
  async sessionExists(sessionId) {
    const history = await this.getHistory(sessionId);
    return history.length > 0;
  }
}

module.exports = new SessionService();