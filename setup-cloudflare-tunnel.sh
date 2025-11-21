#!/bin/bash

# Cloudflare Tunnel Setup Script
# This will expose your local dev server to the internet

echo "🌐 Setting up Cloudflare Tunnel to expose your local server..."
echo ""

# Check if cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
    echo "📦 Installing cloudflared..."
    if command -v brew &> /dev/null; then
        brew install cloudflare/cloudflare/cloudflared
    else
        echo "❌ Homebrew not found. Please install cloudflared manually:"
        echo "   Visit: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/"
        exit 1
    fi
fi

echo "✅ cloudflared is installed"
echo ""
echo "🔐 To expose your server, you have two options:"
echo ""
echo "Option 1: Quick temporary tunnel (no login required)"
echo "   Run: cloudflared tunnel --url http://localhost:4000"
echo "   This will give you a temporary URL like: https://xxxxx.trycloudflare.com"
echo ""
echo "Option 2: Permanent tunnel with your domain (requires Cloudflare account)"
echo "   1. Login: cloudflared tunnel login"
echo "   2. Create tunnel: cloudflared tunnel create sos-dev"
echo "   3. Run: cloudflared tunnel --url http://localhost:4000"
echo ""
echo "🚀 Starting quick tunnel now..."
echo "   Your public URL will appear below:"
echo ""

# Start the tunnel
cloudflared tunnel --url http://localhost:4000

