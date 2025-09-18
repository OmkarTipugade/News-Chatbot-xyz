# News Chatbot Backend

A RAG-based chatbot backend that answers questions about news articles using ChromaDB for vector search and Gemini for response generation.

## Features

- **RAG Pipeline**: Retrieval-Augmented Generation using ChromaDB + Gemini
- **Session Management**: Unique sessions with Redis-based chat history
- **Caching**: Query result caching with TTL for performance
- **Real-time**: WebSocket support for live chat
- **Health Monitoring**: Built-in health checks for all services

## Tech Stack

- **Backend**: Node.js + Express
- **Vector Database**: ChromaDB
- **Embeddings**: Jina embeddings (via Transformers.js)
- **LLM**: Google Gemini 2.0 Flash
- **Cache**: Redis
- **WebSockets**: Socket.IO

## Prerequisites

1. **Node.js** (v18+)
2. **Redis** server running on localhost:6379
3. **Python** (for ChromaDB and embedding scripts)
4. **Google Gemini API Key**

### Installing Redis

**macOS (Homebrew):**
```bash
brew install redis
brew services start redis
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis-server
```

**Docker:**
```bash
docker run -d -p 6379:6379 redis:alpine
```

## Setup

1. **Install dependencies:**
```bash
npm install
```

2. **Configure environment:**
```bash
cp .env.example .env
# Edit .env with your configurations
```

3. **Prepare news data:**
```bash
cd scripts
python ingest.py  # This should create ChromaDB with news articles
```

4. **Start the server:**
```bash
# Development
npm run dev

# Production
npm start
```

## Environment Variables

```env
# Server Configuration
PORT=4000
FRONTEND_URL=http://localhost:5173

# Google Gemini API
GEMINI_API_KEY=your_gemini_api_key_here

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_TTL=3600

# Session Configuration
SESSION_TTL=86400

# RAG Configuration
TOP_K_RESULTS=5
MAX_CONTEXT_LENGTH=4000
```

## API Endpoints

### Chat
- **POST** `/api/chat`
  - Send a message and get AI response
  - Body: `{ "message": "your question", "sessionId": "optional-session-id" }`
  - Returns: `{ "sessionId", "response", "sources", "metadata" }`

### Session Management
- **POST** `/api/session/new` - Create new session
- **GET** `/api/session/:id/history` - Get session history
- **DELETE** `/api/session/:id` - Clear session

### Health Check
- **GET** `/api/health` - Service health status

## Usage Examples

### Start a new chat session:
```bash
curl -X POST http://localhost:4000/api/session/new
```

### Send a message:
```bash
curl -X POST http://localhost:4000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What are the latest developments in climate change?",
    "sessionId": "your-session-id"
  }'
```

### Get chat history:
```bash
curl http://localhost:4000/api/session/your-session-id/history
```

## Architecture

### RAG Pipeline Flow:
1. **User Query** → Embedding generation (Jina)
2. **Vector Search** → ChromaDB retrieval (top-k similar articles)
3. **Context Building** → Format retrieved articles
4. **Response Generation** → Gemini with context + conversation history
5. **Session Storage** → Redis cache with TTL

### Caching Strategy:
- **Query Results**: 1 hour TTL for vector search results
- **Session History**: 24 hour TTL, max 50 messages per session
- **Embeddings**: Loaded once and kept in memory

### Session Management:
- Each user gets a unique UUID session
- Chat history stored in Redis with automatic expiration
- Context window of last 5 messages for conversation continuity

## Performance Optimizations

1. **Embedding Model Caching**: Loaded once at startup
2. **Query Result Caching**: Identical queries return cached results
3. **Context Truncation**: Limits context length to prevent token overflow
4. **Relevance Filtering**: Skips low-relevance search results
5. **Session Trimming**: Keeps only last 50 messages per session

## Monitoring & Health Checks

The `/api/health` endpoint provides status for:
- ChromaDB connection
- Redis connection
- Embedding model loading
- Overall service health

## Error Handling

- Graceful degradation when services are unavailable
- Detailed error logging with timestamps
- User-friendly error messages
- Automatic retry logic for transient failures

## Development

### Running in development mode:
```bash
npm run dev  # Uses nodemon for auto-restart
```

### Testing the RAG pipeline:
```bash
# Test ChromaDB connection
curl http://localhost:4000/api/health

# Test with a sample query
curl -X POST http://localhost:4000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Tell me about recent tech news"}'
```

## Deployment

### Production checklist:
- [ ] Set `NODE_ENV=production`
- [ ] Configure Redis with persistence
- [ ] Set up proper logging
- [ ] Configure reverse proxy (nginx)
- [ ] Set up SSL certificates
- [ ] Monitor resource usage

### Docker deployment:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 4000
CMD ["npm", "start"]
```

## Troubleshooting

### Common Issues:

1. **Redis connection failed**
   - Ensure Redis is running: `redis-cli ping`
   - Check REDIS_URL in .env

2. **ChromaDB not found**
   - Run the ingestion script: `python scripts/ingest.py`
   - Check ChromaDB path in chatbot.service.js

3. **Gemini API errors**
   - Verify API key in .env
   - Check API quotas and limits

4. **Memory issues**
   - Reduce MAX_CONTEXT_LENGTH
   - Lower TOP_K_RESULTS
   - Implement session cleanup

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details