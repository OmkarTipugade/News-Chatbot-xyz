const express = require('express');
const { v4: uuidv4 } = require('uuid');
const chatbotService = require('../services/chatbot.service');
const sessionService = require('../services/session.service');

const router = express.Router();

// Middleware to validate session ID
const validateSession = (req, res, next) => {
  const sessionId = req.params.id || req.body.sessionId;
  if (!sessionId) {
    return res.status(400).json({
      error: 'Session ID is required',
      code: 'MISSING_SESSION_ID'
    });
  }
  req.sessionId = sessionId;
  next();
};

// POST /api/chat - Handle new chat messages
router.post('/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        error: 'Message is required',
        code: 'MISSING_MESSAGE'
      });
    }

    // Generate session ID if not provided
    const currentSessionId = sessionId || uuidv4();

    // Get conversation history for context
    const conversationHistory = await sessionService.getContextForRAG(currentSessionId, 5);

    // Add user message to session
    await sessionService.addMessage(currentSessionId, 'user', message.trim());

    // Process query with RAG pipeline
    const response = await chatbotService.processQuery(message.trim(), conversationHistory);

    // Add assistant response to session
    await sessionService.addMessage(currentSessionId, 'assistant', response.content, {
      sources: response.sources,
      tokensUsed: response.tokensUsed
    });

    res.json({
      sessionId: currentSessionId,
      response: response.content,
      sources: response.sources,
      metadata: {
        tokensUsed: response.tokensUsed,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Chat error:', error);
    res.status(500).json({
      error: 'Failed to process message',
      code: 'PROCESSING_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/session/:id/history - Get session history
router.get('/session/:id/history', validateSession, async (req, res) => {
  try {
    const history = await sessionService.getHistory(req.sessionId);
    const stats = await sessionService.getSessionStats(req.sessionId);

    res.json({
      sessionId: req.sessionId,
      history,
      count: history.length,
      stats
    });

  } catch (error) {
    console.error('❌ History retrieval error:', error);
    res.status(500).json({
      error: 'Failed to retrieve session history',
      code: 'HISTORY_ERROR'
    });
  }
});

// DELETE /api/session/:id - Clear session
router.delete('/session/:id', validateSession, async (req, res) => {
  try {
    const success = await sessionService.clearSession(req.sessionId);

    if (success) {
      res.json({
        message: 'Session cleared successfully',
        sessionId: req.sessionId
      });
    } else {
      res.status(404).json({
        error: 'Session not found or already cleared',
        code: 'SESSION_NOT_FOUND'
      });
    }

  } catch (error) {
    console.error('❌ Session clear error:', error);
    res.status(500).json({
      error: 'Failed to clear session',
      code: 'CLEAR_ERROR'
    });
  }
});

// POST /api/session/new - Create new session
router.post('/session/new', (req, res) => {
  const sessionId = sessionService.generateSessionId();
  res.json({
    sessionId,
    message: 'New session created',
    timestamp: new Date().toISOString()
  });
});

// GET /api/health - Health check
router.get('/health', async (req, res) => {
  try {
    const chatbotHealth = await chatbotService.healthCheck();
    const redisService = require('../services/redis.service');

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        chatbot: chatbotHealth,
        redis: {
          status: redisService.isHealthy() ? 'healthy' : 'unhealthy'
        }
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;