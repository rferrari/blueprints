#!/bin/bash
set -e

# Agent is pre-installed in the image at /app/agent
echo "Starting ElizaOS agent..."
exec elizaos start
