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

# 3. Build OpenClaw (optional but recommended here so it's ready in the layer)
echo "📦 Building OpenClaw..."
cd "$TARGET_DIR"
# Ensure pnpm is available as some OpenClaw scripts might need it
if ! command -v pnpm &> /dev/null; then
    echo "📦 Installing pnpm..."
    npm install -g pnpm
fi
bun install
bun run build

# 4. Remove development bloat to keep image small
echo "🧹 Cleaning up..."
rm -rf .git
rm -rf src
# Keep node_modules and dist

echo "✅ OpenClaw is ready at $TARGET_DIR"
echo "You can now build the worker Docker image, and it will include OpenClaw."
