# News Chatbot - RAG-based AI Assistant

A full-stack RAG (Retrieval-Augmented Generation) chatbot that answers questions about news articles using ChromaDB for vector search and Google Gemini for response generation.

![News Chatbot Demo](https://via.placeholder.com/800x400/4F46E5/FFFFFF?text=News+Chatbot+Demo)

## 🌟 Features

- **Smart RAG Pipeline**: Combines vector search with LLM generation
- **Session Management**: Persistent chat sessions with Redis caching
- **Real-time Chat**: Modern React UI with real-time responses
- **Source Citations**: Provides sources for all answers
- **Performance Optimized**: Query caching and context management
- **Health Monitoring**: Built-in service health checks

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React UI      │    │   Express API   │    │   ChromaDB      │
│   (Frontend)    │◄──►│   (Backend)     │◄──►│   (Vector DB)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │     Redis       │    │   Gemini API    │
                       │   (Sessions)    │    │     (LLM)       │
                       └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.8+
- Redis server
- Google Gemini API key

### 1. Clone and Setup
```bash
git clone <your-repo>
cd News-Chatbot
./setup.sh
```

### 2. Configure Environment
```bash
# Edit backend/.env with your Gemini API key
cd backend
cp .env.example .env
# Add your GEMINI_API_KEY
```

### 3. Prepare News Data
```bash
cd backend/scripts
python ingest.py  # Crawls news and creates vector database
```

### 4. Start Services
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend  
cd frontend
npm run dev
```

### 5. Open Application
- Frontend: http://localhost:5173
- Backend API: http://localhost:4000
- Health Check: http://localhost:4000/api/health

## 📁 Project Structure

```
News-Chatbot/
├── backend/                 # Node.js Express API
│   ├── src/
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── config/         # Configuration
│   │   └── index.js        # Server entry point
│   ├── scripts/            # Data ingestion scripts
│   └── package.json
├── frontend/               # React application
│   ├── src/
│   │   ├── services/       # API clients
│   │   ├── App.jsx         # Main component
│   │   └── main.jsx        # Entry point
│   └── package.json
└── README.md
```

## 🔧 API Endpoints

### Chat
- `POST /api/chat` - Send message and get AI response
- `POST /api/session/new` - Create new chat session
- `GET /api/session/:id/history` - Get session history
- `DELETE /api/session/:id` - Clear session

### Health
- `GET /api/health` - Service health status

## 💡 Usage Examples

### Start a conversation:
```bash
curl -X POST http://localhost:4000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What are the latest developments in AI?",
    "sessionId": "optional-session-id"
  }'
```

### Response format:
```json
{
  "sessionId": "uuid-here",
  "response": "Based on recent news articles...",
  "sources": [
    {
      "title": "AI Breakthrough in 2024",
      "source": "TechNews",
      "url": "https://example.com/article"
    }
  ],
  "metadata": {
    "tokensUsed": 150,
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

## ⚙️ Configuration

### Environment Variables

**Backend (.env):**
```env
PORT=4000
FRONTEND_URL=http://localhost:5173
GEMINI_API_KEY=your_api_key_here
REDIS_URL=redis://localhost:6379
SESSION_TTL=86400
TOP_K_RESULTS=5
MAX_CONTEXT_LENGTH=4000
```

**Frontend (.env):**
```env
VITE_API_URL=http://localhost:4000
```

## 🔍 How It Works

### RAG Pipeline:
1. **User Query** → Generate embeddings using Jina model
2. **Vector Search** → Find similar articles in ChromaDB
3. **Context Building** → Format top-k results as context
4. **LLM Generation** → Gemini generates response with context
5. **Response** → Return answer with source citations

### Session Management:
- Each user gets a unique session ID
- Chat history stored in Redis with TTL
- Context window maintains conversation flow
- Automatic cleanup prevents memory issues

### Caching Strategy:
- **Query Results**: 1-hour cache for vector searches
- **Session Data**: 24-hour TTL with auto-cleanup
- **Embeddings**: Loaded once and kept in memory

## 🚀 Deployment

### Docker Compose:
```yaml
version: '3.8'
services:
  backend:
    build: ./backend
    ports:
      - "4000:4000"
    environment:
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
  
  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
  
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
```

### Production Checklist:
- [ ] Set `NODE_ENV=production`
- [ ] Configure Redis persistence
- [ ] Set up reverse proxy (nginx)
- [ ] Enable SSL certificates
- [ ] Configure monitoring and logging
- [ ] Set up backup strategy for ChromaDB

## 🔧 Development

### Adding New Features:
1. **New API Routes**: Add to `backend/src/routes/`
2. **Business Logic**: Add to `backend/src/services/`
3. **Frontend Components**: Add to `frontend/src/components/`

### Testing:
```bash
# Backend tests
cd backend
npm test

# Frontend tests  
cd frontend
npm test
```

### Debugging:
- Backend logs: Check console output
- Redis data: Use `redis-cli` to inspect sessions
- ChromaDB: Check `backend/scripts/news_output/`

## 🐛 Troubleshooting

### Common Issues:

**Redis Connection Failed:**
```bash
# Check if Redis is running
redis-cli ping
# Should return: PONG
```

**ChromaDB Not Found:**
```bash
# Re-run ingestion script
cd backend/scripts
python ingest.py
```

**Gemini API Errors:**
- Check API key in `.env`
- Verify API quotas and billing
- Check network connectivity

**Memory Issues:**
- Reduce `MAX_CONTEXT_LENGTH`
- Lower `TOP_K_RESULTS`
- Implement session cleanup

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [ChromaDB](https://www.trychroma.com/) for vector database
- [Google Gemini](https://ai.google.dev/) for language model
- [Jina AI](https://jina.ai/) for embeddings
- [React](https://reactjs.org/) and [Tailwind CSS](https://tailwindcss.com/) for UI

---

**Built with ❤️ for the developer community**