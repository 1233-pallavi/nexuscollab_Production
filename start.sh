#!/bin/bash

# NexusCollab – Start both backend and frontend

echo "⚡ Starting NexusCollab..."

# Check for .env
if [ ! -f "./backend/.env" ]; then
  echo "⚠️  No backend/.env found. Copying from .env.example..."
  cp ./backend/.env.example ./backend/.env
  echo "✅ Created backend/.env — please update JWT_SECRET and MONGODB_URI before production!"
fi

# Install dependencies if needed
if [ ! -d "./backend/node_modules" ]; then
  echo "📦 Installing backend dependencies..."
  cd backend && npm install && cd ..
fi

if [ ! -d "./frontend/node_modules" ]; then
  echo "📦 Installing frontend dependencies..."
  cd frontend && npm install && cd ..
fi

echo ""
echo "🚀 Starting backend on http://localhost:5000"
echo "🌐 Starting frontend on http://localhost:3000"
echo ""

# Start both concurrently
cd backend && npm run dev &
BACKEND_PID=$!

cd ../frontend && npm start &
FRONTEND_PID=$!

# Wait for both
wait $BACKEND_PID $FRONTEND_PID
