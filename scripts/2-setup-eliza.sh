#!/bin/bash
set -e

echo "🚀 Preparing ElizaOS image..."

TARGET_DIR="./external/elizaos"
rm -rf "$TARGET_DIR"
mkdir -p "$TARGET_DIR"

# Copy Docker assets
cp ./scripts/eliza.dockerfile "$TARGET_DIR/Dockerfile"
cp ./scripts/eliza.entrypoint.sh "$TARGET_DIR/entrypoint.sh"
chmod +x "$TARGET_DIR/entrypoint.sh"

echo "🐳 Building Docker image eliza:local..."
cd "$TARGET_DIR"
docker build -t eliza:local .
cd -

echo "✅ ElizaOS image is ready!"
