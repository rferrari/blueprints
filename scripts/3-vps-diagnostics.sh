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
        ID_CLEAN=${NAME#"/openclaw-"}
        echo "🔎 Agent: $NAME (ID: $AGENT)"
        echo "   Networks & IP:"
        docker inspect $AGENT --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}: {{.IPAddress}}{{end}}'
        echo "   Mounts:"
        docker inspect $AGENT --format '{{range .Mounts}}   SRC: {{.Source}} -> DST: {{.Destination}}{{println}}{{end}}'
        
        # New Config Audit
        echo "   Config Audit (.openclaw/openclaw.json):"
        CONFIG_FILE="/opt/blueprints/workspaces/$ID_CLEAN/.openclaw/openclaw.json"
        if [ -f "$CONFIG_FILE" ]; then
            TOKEN=$(cat "$CONFIG_FILE" | grep -A 5 '"gateway"' | grep '"token"' | cut -d'"' -f4)
            if [ ! -z "$TOKEN" ]; then
                echo "      ✅ Gateway Token Found: ${TOKEN:0:4}...${TOKEN: -4}"
            else
                echo "      ❌ Gateway Token MISSING in config!"
            fi
            BIND=$(cat "$CONFIG_FILE" | grep -A 5 '"gateway"' | grep '"bind"' | cut -d'"' -f4)
            echo "      ✅ Bind Mode: $BIND"
        else
            echo "      ⚠️ Config file not found at $CONFIG_FILE"
        fi
        
        # Connectivity Test from Worker
        if [ ! -z "$WORKER_CONTAINER" ]; then
            IP=$(docker inspect $AGENT --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}')
            echo "   Worker -> Agent Connectivity Test ($IP:18789):"
            
            # Check for curl or wget inside the container using sh -c
            TEST_RESULT=$(docker exec $WORKER_CONTAINER sh -c "
                if command -v curl >/dev/null 2>&1; then
                    curl -s -o /dev/null -w '%{http_code}' http://$IP:18789/v1/chat/completions -H 'Authorization: Bearer $TOKEN'
                elif command -v wget >/dev/null 2>&1; then
                    wget --spider --server-response --header='Authorization: Bearer $TOKEN' http://$IP:18789/v1/chat/completions 2>&1 | awk '/HTTP\// {print \$2}' | tail -1
                else
                    echo 'MISSING'
                fi
            " 2>/dev/null)

            if [ "$TEST_RESULT" == "403" ]; then
                echo "      ⚠️ Connectivity test returned 403 (Unauthorized - check token/agent-id)"
            elif [ "$TEST_RESULT" == "401" ]; then
                echo "      ❌ Connectivity test returned 401 (Unauthorized - check token scope)"
            elif [ "$TEST_RESULT" == "200" ] || [ "$TEST_RESULT" == "405" ]; then
                echo "      ✅ Connectivity test returned: $TEST_RESULT (Success/Reachable)"
            elif [ "$TEST_RESULT" == "MISSING" ]; then
                echo "      ❌ Connectivity test FAILED (Neither curl nor wget found inside worker container)"
            elif [ -z "$TEST_RESULT" ]; then
                echo "      ❌ Connectivity test FAILED (OCI Error or empty response)"
            else
                echo "      ❌ Connectivity test returned: $TEST_RESULT"
            fi
        fi
        echo ""
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
