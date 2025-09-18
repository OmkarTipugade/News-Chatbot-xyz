#!/bin/bash

echo "🚀 Starting News Chatbot Development Environment"

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "🔍 Checking prerequisites..."

# Check Node.js
if ! command_exists node; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Redis
if ! command_exists redis-cli; then
    echo "❌ Redis CLI is not found. Please install Redis first."
    exit 1
fi

# Check if Redis is running
if ! redis-cli ping > /dev/null 2>&1; then
    echo "❌ Redis is not running. Starting Redis..."
    if command_exists brew; then
        brew services start redis
    elif command_exists systemctl; then
        sudo systemctl start redis-server
    else
        echo "Please start Redis manually and run this script again."
        exit 1
    fi
    
    # Wait a moment for Redis to start
    sleep 2
    
    if ! redis-cli ping > /dev/null 2>&1; then
        echo "❌ Failed to start Redis. Please start it manually."
        exit 1
    fi
fi

echo "✅ Redis is running"

# Check if .env exists
if [ ! -f "backend/.env" ]; then
    echo "📝 Creating backend/.env file..."
    cp backend/.env.example backend/.env
    echo "⚠️  Please edit backend/.env with your Gemini API key before proceeding!"
    echo "   You can get a free API key from: https://ai.google.dev/"
    read -p "Press Enter after you've added your API key to continue..."
fi

# Install dependencies if needed
if [ ! -d "backend/node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    cd backend && npm install && cd ..
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd frontend && npm install && cd ..
fi

# Check if ChromaDB exists
if [ ! -f "backend/scripts/news_output/chroma_db/chroma.sqlite3" ]; then
    echo "🗄️ ChromaDB not found. You need to run the ingestion script first."
    echo "   Run: cd backend/scripts && python ingest.py"
    echo "   (Make sure you have Python 3.8+ installed)"
    read -p "Press Enter after running the ingestion script to continue..."
fi

echo "🎯 Starting development servers..."

# Function to start backend
start_backend() {
    echo "🔧 Starting backend server..."
    cd backend
    npm run dev
}

# Function to start frontend
start_frontend() {
    sleep 3  # Wait for backend to start
    echo "🎨 Starting frontend server..."
    cd frontend
    npm run dev
}

# Start both servers in parallel
start_backend &
BACKEND_PID=$!

start_frontend &
FRONTEND_PID=$!

# Function to cleanup on exit
cleanup() {
    echo "🛑 Shutting down servers..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM

echo "✅ Development environment started!"
echo "📊 Backend: http://localhost:4000"
echo "🌐 Frontend: http://localhost:5173"
echo "🏥 Health Check: http://localhost:4000/api/health"
echo ""
echo "Press Ctrl+C to stop all servers"

# Wait for background processes
wait