import { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Loader2, RefreshCw, ExternalLink, MessageSquare, Clock } from 'lucide-react';
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
  }, []);

  const createNewSession = async () => {
    try {
      const response = await axios.post(`${API_BASE_URL}/session/new`);
      setSessionId(response.data.sessionId);
      setMessages([]);
      setError(null);
      setSessionStats({ messageCount: 0, startTime: new Date() });
      console.log('New session created:', response.data.sessionId);
    } catch (error) {
      console.error('Failed to create session:', error);
      setError('Failed to create new session');
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading || !sessionId) return;

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
      setError('Failed to send message. Please try again.');
      
      // Add error message to UI
      const errorMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your message. Please try again.',
        isError: true,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
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
                <span>Ask me about recent news</span>
                {sessionStats.messageCount > 0 && (
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
            className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>New Chat</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <Bot className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Welcome to News Chatbot</h3>
            <p className="text-gray-500 max-w-md mx-auto">
              I can help you find information about recent news. Ask me anything about current events, technology, politics, or other topics.
            </p>
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
                            className="text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                          >
                            <span>{source.title} - {source.source}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Timestamp */}
                <div className={`text-xs mt-2 ${
                  message.role === 'user' ? 'text-blue-200' : 'text-gray-500'
                }`}>
                  {new Date(message.timestamp).toLocaleTimeString()}
                </div>
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
                  {isTyping ? 'Typing...' : 'Thinking...'}
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mx-6 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 text-sm">{error}</p>
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
              placeholder="Ask me about recent news..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows="1"
              disabled={isLoading || !sessionId}
            />
          </div>
          <button
            onClick={sendMessage}
            disabled={!inputMessage.trim() || isLoading || !sessionId}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        
        {sessionId && (
          <p className="text-xs text-gray-500 mt-2">
            Session: {sessionId.slice(0, 8)}...
          </p>
        )}
      </div>
    </div>
  );
};

export default App;