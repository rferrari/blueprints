#!/bin/bash

# WARNING:
# This script is for FIRST VPS SETUP ONLY.
# Not used in production runtime.

# Blueprints VPS Quick Setup Script
# This script installs Docker and prepares the environment for hard isolation.

set -e

echo "🚀 Starting Blueprints VPS Setup..."

# 1. Update system
sudo apt-get update
sudo apt-get upgrade -y

# 2. Install Docker
if ! command -v docker &> /dev/null; then
    echo "📥 Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
else
    echo "✅ Docker already installed."
fi

# 3. Install Node.js (v22)
if ! command -v node &> /dev/null || [ "$(node -v | cut -d. -f1 | tr -d 'v')" -lt 20 ]; then
    echo "📥 Installing Node.js 22..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "✅ Node.js $(node -v) already installed."
fi

# 3. Install Docker Compose (v2)
if ! docker compose version &> /dev/null; then
    echo "📥 Installing Docker Compose..."
    sudo apt-get install -y docker-compose-plugin
else
    echo "✅ Docker Compose already installed."
fi

# 4. Success
echo ""
echo "Next steps:"
echo "1. Create a .env file with your SUPABASE and ENCRYPTION_KEY variables."
