#!/bin/bash

# Start Cloudflare Tunnel to expose your local server
# This will show you a public URL you can access from anywhere

echo "🌐 Starting Cloudflare Tunnel..."
echo "📡 Exposing http://localhost:4000 to the internet"
echo ""
echo "⏳ Connecting... Your public URL will appear below:"
echo ""

# Start tunnel and show the URL
cloudflared tunnel --url http://localhost:4000

