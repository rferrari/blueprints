#!/bin/bash

# This script prepares OpenClaw to be packaged with the blueprints worker.
# It should be run from the root of the blueprints monorepo.

set -e

OPENCLAW_VERSION="main" # Or a specific tag like "v1.0.0"
TARGET_DIR="./packages/worker/openclaw"

echo "🚀 Preparing OpenClaw for packaging..."

# 1. Clean up existing target
if [ -d "$TARGET_DIR" ]; then
    echo "⚠️ Removing existing OpenClaw directory..."
    rm -rf "$TARGET_DIR"
fi

# 2. Clone OpenClaw
echo "📥 Cloning OpenClaw ($OPENCLAW_VERSION)..."
git clone --depth 1 -b $OPENCLAW_VERSION https://github.com/openclaw/openclaw.git "$TARGET_DIR"

# 3. Build OpenClaw
echo "📦 Building OpenClaw..."
cd "$TARGET_DIR"

# Ensure pnpm is available
if ! command -v pnpm &> /dev/null; then
    echo "📦 Installing pnpm..."
    npm install -g pnpm || sudo npm install -g pnpm
fi

# Detect Bun path for sudo environments
BUN_BIN=$(command -v bun || echo "$HOME/.bun/bin/bun")

if [ ! -f "$BUN_BIN" ]; then
    echo "🛑 Bun not found! Please install Bun first."
    exit 1
fi

echo "Using pnpm for installation..."
pnpm install
pnpm run build

# 4. Build Docker Image
echo "🐳 Building Docker image openclaw:local..."
docker build -t openclaw:local .

echo "✅ OpenClaw image is ready!"
echo "You can now run 'docker compose up -d' and the worker will be able to start agents."
