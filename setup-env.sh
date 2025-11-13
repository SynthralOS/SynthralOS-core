#!/bin/bash

# Setup script for environment variables
# This script creates .env files with your Supabase credentials

echo "Setting up environment variables..."

# Backend .env
cat > backend/.env << 'EOF'
# Server Configuration
NODE_ENV=development
PORT=4000

# Supabase Configuration
SUPABASE_URL=https://qgfutvkhhsjbjthkammv.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZnV0dmtoaHNqYmp0aGthbW12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0Mzg2MTcsImV4cCI6MjA3ODAxNDYxN30.hhNH7orytoDzR7STQi9Zu3_e2FN_-pY0Rx6oavtH0ds
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZnV0dmtoaHNqYmp0aGthbW12Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjQzODYxNywiZXhwIjoyMDc4MDE0NjE3fQ.XaJ20gARmftwE6Sqvju42D-XJEeqFryD7BWIGr6M1P8

# Database (Supabase PostgreSQL connection string)
# Replace [YOUR-PASSWORD] with your database password from Supabase Settings → Database
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.qgfutvkhhsjbjthkammv.supabase.co:5432/postgres

# Redis (local for development)
REDIS_URL=redis://localhost:6379

# CORS
CORS_ORIGIN=http://localhost:3000

# AI Providers (optional)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# App Configuration
APP_URL=http://localhost:3000
API_URL=http://localhost:4000
EOF

# Frontend .env
cat > frontend/.env << 'EOF'
# API URL
VITE_API_URL=http://localhost:4000

# Supabase
VITE_SUPABASE_URL=https://qgfutvkhhsjbjthkammv.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZnV0dmtoaHNqYmp0aGthbW12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0Mzg2MTcsImV4cCI6MjA3ODAxNDYxN30.hhNH7orytoDzR7STQi9Zu3_e2FN_-pY0Rx6oavtH0ds
EOF

echo "✅ Environment files created!"
echo ""
echo "⚠️  IMPORTANT: You need to update the DATABASE_URL in backend/.env"
echo "   Replace [YOUR-PASSWORD] with your Supabase database password"
echo ""
echo "   To find your password:"
echo "   1. Go to https://app.supabase.com/project/qgfutvkhhsjbjthkammv"
echo "   2. Settings → Database"
echo "   3. Copy the connection string (URI format)"
echo "   4. Replace [YOUR-PASSWORD] in backend/.env"
echo ""

