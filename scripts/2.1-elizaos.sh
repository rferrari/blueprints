#!/bin/bash

# WARNING:
# This script is for FIRST VPS SETUP ONLY.
# Not used in production runtime.

set -e

# Configuration
ELIZA_REPO="https://github.com/elizaos/eliza.git"
ELIZA_BRANCH="main"
TARGET_DIR="./external/elizaos"
DOCKERFILE="./scripts/elizaos.dockerfile"

echo "🚀 Setting up ElizaOS Framework..."

# 1. Clean up existing target
if [ -d "$TARGET_DIR" ]; then
    echo "⚠️ Removing existing ElizaOS source directory..."
    rm -rf "$TARGET_DIR"
fi

# 2. Clone Eliza
echo "📥 Cloning ElizaOS ($ELIZA_BRANCH)..."
git clone --depth 1 -b $ELIZA_BRANCH $ELIZA_REPO "$TARGET_DIR"

# 3. Build Docker Image
echo "🐳 Building Docker image elizaos:local..."
# Copy Dockerfile to target directory for build context
cp "$DOCKERFILE" "$TARGET_DIR/Dockerfile"
cp "./scripts/elizaos.entrypoint.sh" "$TARGET_DIR/entrypoint.sh"

cd "$TARGET_DIR"
docker build -t elizaos:local .

# Extract version from the Source (avoiding docker run hang)
echo "🔍 Extracting ElizaOS version..."
if [ -f "$TARGET_DIR/packages/cli/package.json" ]; then
    ELIZA_VERSION=$(grep '"version":' "$TARGET_DIR/packages/cli/package.json" | head -n 1 | awk -F: '{ print $2 }' | sed 's/[", ]//g')
else
    ELIZA_VERSION="unknown"
fi
echo "Found version: $ELIZA_VERSION"

# 4. Sync with database
echo "🔄 Updating database registry..."
cd ../..
bun run scripts/supabase-utils/sync-framework.ts elizaos "$ELIZA_VERSION" success "Modular setup-frameworks build"

# 5. Clean up
echo "🧹 Cleaning up..."
rm -rf "$TARGET_DIR"

echo "✅ ElizaOS image is ready and registered!"
