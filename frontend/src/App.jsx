import { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Loader2, RefreshCw, ExternalLink, MessageSquare, Clock, Trash2 } from 'lucide-react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:4000/api';

const App = () => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [error, setError] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [sessionStats, setSessionStats] = useState({ messageCount: 0, startTime: null });
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize session on component mount
  useEffect(() => {
    createNewSession();
    checkBackendConnection();
  }, []);

  const checkBackendConnection = async () => {
    try {
      await axios.get(`${API_BASE_URL}/health`, { timeout: 5000 });
      setConnectionStatus('connected');
    } catch (error) {
      console.error('Backend connection failed:', error);
      setConnectionStatus('disconnected');
      setError('Cannot connect to backend server. Please ensure the backend is running.');
    }
  };

  const createNewSession = async () => {
    try {
      setConnectionStatus('connecting');
      const response = await axios.post(`${API_BASE_URL}/session/new`);
      setSessionId(response.data.sessionId);
      setMessages([]);
      setError(null);
      setSessionStats({ messageCount: 0, startTime: new Date() });
      setConnectionStatus('connected');
      console.log('New session created:', response.data.sessionId);
      
      // Add welcome message
      const welcomeMessage = {
        id: 'welcome',
        role: 'assistant',
        content: "Hello! I'm your news assistant. I can help you find information about recent news articles. Ask me anything about current events, technology, politics, or other topics covered in the news.",
        timestamp: new Date().toISOString(),
        isWelcome: true
      };
      setMessages([welcomeMessage]);
      
    } catch (error) {
      console.error('Failed to create session:', error);
      setConnectionStatus('disconnected');
      setError('Failed to create new session. Please check if the backend server is running.');
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading || !sessionId || connectionStatus !== 'connected') return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);
    setError(null);

    // Add user message to UI immediately
    const newUserMessage = {
      id: Date.now(),
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, newUserMessage]);

    try {
      // Simulate typing effect
      setIsTyping(true);
      
      const response = await axios.post(`${API_BASE_URL}/chat`, {
        message: userMessage,
        sessionId: sessionId
      }, {
        timeout: 30000 // 30 second timeout for RAG processing
      });

      setIsTyping(false);
      
      // Add assistant response to UI
      const assistantMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: response.data.response,
        sources: response.data.sources || [],
        metadata: response.data.metadata,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Update session stats
      setSessionStats(prev => ({ 
        ...prev, 
        messageCount: prev.messageCount + 1 
      }));

    } catch (error) {
      console.error('Failed to send message:', error);
      setIsTyping(false);
      
      let errorMessage = 'Sorry, I encountered an error processing your message. Please try again.';
      
      if (error.code === 'ECONNABORTED') {
        errorMessage = 'Request timed out. The query might be too complex. Please try a simpler question.';
      } else if (error.response?.status === 500) {
        errorMessage = 'Server error occurred. Please try again or rephrase your question.';
      }
      
      setError(`Failed to send message: ${error.message}`);
      
      // Add error message to UI
      const errorMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: errorMessage,
        isError: true,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    createNewSession();
  };

  const formatSessionDuration = () => {
    if (!sessionStats.startTime) return '';
    const duration = Math.floor((new Date() - sessionStats.startTime) / 1000 / 60);
    return duration > 0 ? `${duration}m` : '<1m';
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-green-600';
      case 'connecting': return 'text-yellow-600';
      case 'disconnected': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting...';
      case 'disconnected': return 'Disconnected';
      default: return 'Unknown';
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Bot className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-xl font-semibold text-gray-900">News Chatbot</h1>
              <div className="flex items-center space-x-4 text-sm text-gray-500">
                <span className={getConnectionStatusColor()}>
                  {getConnectionStatusText()}
                </span>
                {sessionStats.messageCount > 0 && connectionStatus === 'connected' && (
                  <>
                    <span className="flex items-center space-x-1">
                      <MessageSquare className="w-3 h-3" />
                      <span>{sessionStats.messageCount} messages</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatSessionDuration()}</span>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={clearChat}
            disabled={connectionStatus !== 'connected'}
            className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className="w-4 h-4" />
            <span>New Chat</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && connectionStatus === 'connected' && (
          <div className="text-center py-12">
            <Bot className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Welcome to News Chatbot</h3>
            <p className="text-gray-500 max-w-md mx-auto">
              I can help you find information about recent news. Ask me anything about current events, technology, politics, or other topics.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <button
                onClick={() => setInputMessage("What are the latest developments in AI?")}
                className="px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded-full hover:bg-blue-100 transition-colors"
              >
                AI developments
              </button>
              <button
                onClick={() => setInputMessage("Tell me about recent climate change news")}
                className="px-3 py-1 text-sm bg-green-50 text-green-700 rounded-full hover:bg-green-100 transition-colors"
              >
                Climate news
              </button>
              <button
                onClick={() => setInputMessage("What's happening in technology?")}
                className="px-3 py-1 text-sm bg-purple-50 text-purple-700 rounded-full hover:bg-purple-100 transition-colors"
              >
                Tech updates
              </button>
            </div>
          </div>
        )}

        {connectionStatus === 'disconnected' && (
          <div className="text-center py-12">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bot className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Connection Error</h3>
            <p className="text-gray-500 max-w-md mx-auto mb-4">
              Cannot connect to the backend server. Please ensure the backend is running on port 4000.
            </p>
            <button
              onClick={checkBackendConnection}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Retry Connection
            </button>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex max-w-3xl ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              {/* Avatar */}
              <div className={`flex-shrink-0 ${message.role === 'user' ? 'ml-3' : 'mr-3'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  message.role === 'user' 
                    ? 'bg-blue-600 text-white' 
                    : message.isError 
                      ? 'bg-red-100 text-red-600'
                      : message.isWelcome
                        ? 'bg-green-100 text-green-600'
                        : 'bg-gray-100 text-gray-600'
                }`}>
                  {message.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
              </div>

              {/* Message Content */}
              <div className={`rounded-lg px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : message.isError
                    ? 'bg-red-50 text-red-900 border border-red-200'
                    : message.isWelcome
                      ? 'bg-green-50 text-green-900 border border-green-200'
                      : 'bg-white text-gray-900 shadow-sm border'
              }`}>
                <div className="whitespace-pre-wrap">{message.content}</div>
                
                {/* Sources */}
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-sm font-medium text-gray-700 mb-2">Sources:</p>
                    <div className="space-y-1">
                      {message.sources.map((source, index) => (
                        <div key={index} className="text-sm">
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 flex items-center space-x-1 hover:underline"
                          >
                            <span>{source.title} - {source.source}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Metadata */}
                {message.metadata && (
                  <div className="mt-2 text-xs text-gray-500">
                    {message.metadata.tokensUsed && (
                      <span>Tokens: {message.metadata.tokensUsed} • </span>
                    )}
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                )}

                {/* Timestamp for messages without metadata */}
                {!message.metadata && (
                  <div className={`text-xs mt-2 ${
                    message.role === 'user' ? 'text-blue-200' : 'text-gray-500'
                  }`}>
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {(isLoading || isTyping) && (
          <div className="flex justify-start">
            <div className="flex mr-3">
              <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
            </div>
            <div className="bg-white rounded-lg px-4 py-3 shadow-sm border">
              <div className="flex items-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                <span className="text-gray-500">
                  {isTyping ? 'Generating response...' : 'Searching news articles...'}
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mx-6 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
          <p className="text-red-800 text-sm">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-800"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input */}
      <div className="bg-white border-t px-6 py-4">
        <div className="flex space-x-4">
          <div className="flex-1">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                connectionStatus === 'connected' 
                  ? "Ask me about recent news..." 
                  : "Connecting to server..."
              }
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
              rows="1"
              disabled={isLoading || !sessionId || connectionStatus !== 'connected'}
            />
          </div>
          <button
            onClick={sendMessage}
            disabled={!inputMessage.trim() || isLoading || !sessionId || connectionStatus !== 'connected'}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        
        {sessionId && connectionStatus === 'connected' && (
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-gray-500">
              Session: {sessionId.slice(0, 8)}...
            </p>
            <p className="text-xs text-gray-500">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;