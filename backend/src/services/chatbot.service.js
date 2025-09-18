const { pipeline } = require("@xenova/transformers");
const { ChromaClient } = require("chromadb");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const crypto = require('crypto');
const redisService = require('./redis.service');
const path = require('path');

// ---------- CONFIG ----------
const CHROMA_PATH = path.join(__dirname, "../../scripts/news_output/chroma_db");
const COLLECTION_NAME = "news_articles";
const EMBED_MODEL = "Xenova/jina-embeddings-v2-base-en";
const TOP_K = parseInt(process.env.TOP_K_RESULTS) || 5;
const MAX_CONTEXT_LENGTH = parseInt(process.env.MAX_CONTEXT_LENGTH) || 4000;

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

// ---------- Init ----------
let embedder;
let chromaClient;

const loadEmbedder = async () => {
  if (!embedder) {
    console.log('🔄 Loading embedding model...');
    embedder = await pipeline("feature-extraction", EMBED_MODEL);
    console.log('✅ Embedding model loaded');
  }
  return embedder;
};

const getCollection = async () => {
  if (!chromaClient) {
    chromaClient = new ChromaClient({ path: CHROMA_PATH });
  }
  return await chromaClient.getCollection({ name: COLLECTION_NAME });
};

// ---------- Core RAG Functions ----------

const searchChroma = async (query) => {
  try {
    // Generate query hash for caching
    const queryHash = crypto.createHash('md5').update(query).digest('hex');
    
    // Check cache first
    const cached = await redisService.getCachedQuery(queryHash);
    if (cached) {
      console.log('📦 Using cached search results');
      return cached;
    }

    console.log('🔍 Searching ChromaDB...');
    
    // Generate embedding for query
    const emb = await (await loadEmbedder())(query, { 
      pooling: "mean", 
      normalize: true 
    });
    const queryEmbedding = Array.from(emb.data);

    // Search ChromaDB
    const collection = await getCollection();
    const results = await collection.query({
      query_embeddings: [queryEmbedding],
      n_results: TOP_K,
    });

    // Cache results
    await redisService.cacheQuery(queryHash, results, 3600); // 1 hour cache

    return results;
  } catch (error) {
    console.error('❌ Error searching ChromaDB:', error);
    throw new Error('Failed to search knowledge base');
  }
};

const buildContext = (searchResults, maxLength = MAX_CONTEXT_LENGTH) => {
  const docs = searchResults.documents?.[0] || [];
  const metadatas = searchResults.metadatas?.[0] || [];
  const distances = searchResults.distances?.[0] || [];

  let context = '';
  let currentLength = 0;

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    const meta = metadatas[i];
    const distance = distances[i];

    // Skip if relevance score is too low (distance too high)
    if (distance > 0.8) continue;

    const docContext = `
Title: ${meta.title || 'Unknown'}
Source: ${meta.source || 'Unknown'}
URL: ${meta.url || 'N/A'}
Content: ${doc}
---`;

    if (currentLength + docContext.length > maxLength) {
      break;
    }

    context += docContext;
    currentLength += docContext.length;
  }

  return context.trim();
};

const generateResponse = async (query, context, conversationHistory = []) => {
  try {
    // Build conversation context
    let conversationContext = '';
    if (conversationHistory.length > 0) {
      conversationContext = '\n\nPrevious conversation:\n' + 
        conversationHistory.slice(-3).map(msg => 
          `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
        ).join('\n');
    }

    const prompt = `You are a helpful news assistant. Answer the user's question using ONLY the provided news context. Be accurate, concise, and cite sources when possible.

News Context:
${context}
${conversationContext}

User Question: ${query}

Instructions:
- Only use information from the provided context
- If the context doesn't contain relevant information, say so clearly
- Cite sources (title/source) when referencing specific articles
- Be conversational but informative
- Keep responses focused and relevant`;

    console.log('🤖 Generating response with Gemini...');
    
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    return {
      content: text,
      sources: extractSources(context),
      tokensUsed: response.usageMetadata || null
    };
  } catch (error) {
    console.error('❌ Error generating response:', error);
    throw new Error('Failed to generate response');
  }
};

const extractSources = (context) => {
  const sources = [];
  const lines = context.split('\n');
  
  let currentSource = {};
  for (const line of lines) {
    if (line.startsWith('Title: ')) {
      currentSource.title = line.replace('Title: ', '');
    } else if (line.startsWith('Source: ')) {
      currentSource.source = line.replace('Source: ', '');
    } else if (line.startsWith('URL: ')) {
      currentSource.url = line.replace('URL: ', '');
      if (currentSource.title && currentSource.source) {
        sources.push({ ...currentSource });
      }
      currentSource = {};
    }
  }
  
  return sources;
};

// ---------- Main Chat Function ----------
const processQuery = async (query, conversationHistory = []) => {
  try {
    console.log(`📝 Processing query: "${query}"`);
    
    // Step 1: Search relevant documents
    const searchResults = await searchChroma(query);
    
    if (!searchResults.documents?.[0]?.length) {
      return {
        content: "I couldn't find any relevant information in the news database to answer your question. Please try rephrasing your query or ask about different topics.",
        sources: [],
        tokensUsed: null
      };
    }

    // Step 2: Build context from search results
    const context = buildContext(searchResults);
    
    if (!context) {
      return {
        content: "I found some potentially relevant articles, but they don't seem closely related to your question. Could you try asking about something more specific?",
        sources: [],
        tokensUsed: null
      };
    }

    // Step 3: Generate response using Gemini
    const response = await generateResponse(query, context, conversationHistory);
    
    console.log('✅ Response generated successfully');
    return response;

  } catch (error) {
    console.error('❌ Error processing query:', error);
    throw error;
  }
};

// ---------- Health Check ----------
const healthCheck = async () => {
  try {
    await loadEmbedder();
    await getCollection();
    return { status: 'healthy', timestamp: new Date().toISOString() };
  } catch (error) {
    return { 
      status: 'unhealthy', 
      error: error.message, 
      timestamp: new Date().toISOString() 
    };
  }
};

module.exports = {
  processQuery,
  searchChroma,
  healthCheck,
  loadEmbedder,
  getCollection
};
