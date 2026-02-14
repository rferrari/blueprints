#!/bin/bash

# ElizaOS Multi-Agent Debugging Helper
# Usage: ./scripts/debug-eliza.sh [projectId]

PROJECT_ID=$1

if [ -z "$PROJECT_ID" ]; then
    echo "Usage: ./scripts/debug-eliza.sh [projectId]"
    echo "Available ElizaOS containers:"
    docker ps --format '{{.Names}}' | grep elizaos-
    exit 1
fi

CONTAINER="elizaos-$PROJECT_ID"

echo "=== Diagnostics for $CONTAINER ==="

echo -e "\n[1] Container Status:"
docker inspect "$CONTAINER" --format 'Status: {{.State.Status}}, Error: {{.State.Error}}'

echo -e "\n[2] Active Agents (CLI List):"
docker exec "$CONTAINER" /bin/bash -c 'export PATH="/root/.bun/bin:$PATH"; elizaos agent list'

echo -e "\n[3] Process List (ps aux):"
docker exec "$CONTAINER" ps aux | grep elizaos

echo -e "\n[4] Character Files in /agent-home:"
docker exec "$CONTAINER" ls -la /agent-home/*.json

echo -e "\n[5] Recent Logs (tail 20):"
docker logs "$CONTAINER" --tail 20
