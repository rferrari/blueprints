#!/bin/bash

# WARNING:
# This script is for FIRST VPS SETUP ONLY.
# Not used in production runtime.

# Blueprints Network Setup Script
# Ensures the internal Docker network exists for agent isolation.

NETWORK_NAME="blueprints-network"

echo "🌐 Setting up Blueprints Docker network..."

if docker network inspect "$NETWORK_NAME" >/dev/null 2>&1; then
    echo "✅ Network '$NETWORK_NAME' already exists."
else
    echo "🏗️  Creating network '$NETWORK_NAME'..."
    docker network create "$NETWORK_NAME"
    echo "✅ Network '$NETWORK_NAME' created."
fi

echo ""
echo "Detail of network:"
docker network inspect "$NETWORK_NAME" | grep -E "Name|Subnet|Gateway|IPv4Address"
