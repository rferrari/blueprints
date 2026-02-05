#!/bin/bash

# Blueprints VPS Debug Script
# Investigates Docker state, networking, and mounts for Blueprints Worker & Agents

echo "========================================================"
echo "   BLUEPRINTS VPS DIAGNOSTICS   "
echo "========================================================"
date
echo ""

echo "--- 1. Docker Version ---"
docker version --format '{{.Server.Version}}'
echo ""

echo "--- 2. Network Check ---"
echo "Listing all networks (looking for 'blueprints'...)"
docker network ls | grep blueprints || echo "WARNING: No 'blueprints' network found!"
echo ""
echo "Detail inspection of default/blueprints network:"
NETWORK_NAME=$(docker network ls --filter name=blueprints --format "{{.Name}}" | head -n 1)
if [ -z "$NETWORK_NAME" ]; then
    NETWORK_NAME="blueprints-network" 
fi
echo "Inspecting network: $NETWORK_NAME"
docker network inspect $NETWORK_NAME | grep -E "Name|Subnet|Gateway|IPv4Address|Container"
echo ""

echo "--- 3. Blueprints Worker Inspection ---"
WORKER_CONTAINER=$(docker ps -q -f name=worker)
if [ -z "$WORKER_CONTAINER" ]; then
    echo "❌ Worker container NOT currently running!"
else
    echo "✅ Worker is running (ID: $WORKER_CONTAINER)"
    echo "Detected Networks:"
    docker inspect $WORKER_CONTAINER --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}: {{.IPAddress}}{{end}}'
    echo "Environment Variables (HOST_WORKSPACES_PATH & NETWORK):"
    docker inspect $WORKER_CONTAINER --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -E "HOST_WORKSPACES_PATH|DOCKER_NETWORK_NAME|OPENCLAW"
    echo "Mounts:"
    docker inspect $WORKER_CONTAINER --format '{{range .Mounts}}SRC: {{.Source}} -> DST: {{.Destination}} (RW: {{.RW}}){{println}}{{end}}' | grep workspaces
fi
echo ""

echo "--- 4. OpenClaw Agent Inspection ---"
AGENT_CONTAINERS=$(docker ps -q -f name=openclaw)
if [ -z "$AGENT_CONTAINERS" ]; then
    echo "⚠️ No OpenClaw agents currently running."
else
    for AGENT in $AGENT_CONTAINERS; do
        NAME=$(docker inspect $AGENT --format '{{.Name}}')
        echo "🔎 Agent: $NAME (ID: $AGENT)"
        echo "   Networks & IP:"
        docker inspect $AGENT --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}: {{.IPAddress}}{{end}}'
        echo "   Mounts:"
        docker inspect $AGENT --format '{{range .Mounts}}   SRC: {{.Source}} -> DST: {{.Destination}}{{println}}{{end}}'
    done
fi
echo ""

echo "--- 5. Recent Logs (Last 20 lines) ---"
if [ ! -z "$WORKER_CONTAINER" ]; then
    echo ">>> WORKER LOGS:"
    docker logs --tail 20 $WORKER_CONTAINER
fi
echo ""
if [ ! -z "$AGENT_CONTAINERS" ]; then
    for AGENT in $AGENT_CONTAINERS; do
        NAME=$(docker inspect $AGENT --format '{{.Name}}')
        echo ">>> AGENT LOGS ($NAME):"
        docker logs --tail 20 $AGENT
    done
fi
echo ""
echo "========================================================"
echo "   END REPORT   "
echo "========================================================"
