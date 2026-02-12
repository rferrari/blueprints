#!/bin/bash

# Blueprints VPS Debug Script
# Investigates Docker state, networking, and mounts for Blueprints Worker & Agents

# Colors and Formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Trap Ctrl+C
trap "echo -e '\n${RED}🛑 Diagnostics stopped by user.${NC}'; exit 0" SIGINT

function pause() {
    echo -e "\n${YELLOW}👉 Press [Enter] to continue to the next section or [Ctrl+C] to stop...${NC}"
    read -r
}

clear
echo -e "${CYAN}========================================================${NC}"
echo -e "${BOLD}🚀 BLUEPRINTS VPS DIAGNOSTICS${NC}"
echo -e "${CYAN}========================================================${NC}"
echo -e "${BLUE}📅 Date:${NC} $(date)"
echo ""

echo -e "${BOLD}🔹 1. Docker Version${NC}"
docker version --format '{{.Server.Version}}' || echo -e "${RED}❌ Docker not found or not running!${NC}"

pause

echo -e "${BOLD}🌐 2. Network Check${NC}"
echo "Listing all networks (looking for 'blueprints'...)"
docker network ls | grep blueprints || echo -e "${YELLOW}⚠️ WARNING: No 'blueprints' network found!${NC}"
echo ""

NETWORK_NAME=$(docker network ls --filter name=blueprints --format "{{.Name}}" | head -n 1)
if [ -z "$NETWORK_NAME" ]; then
    NETWORK_NAME="blueprints-network" 
fi

echo -e "Detail inspection of network: ${BOLD}$NETWORK_NAME${NC}"
docker network inspect $NETWORK_NAME | grep -E "Name|Subnet|Gateway|IPv4Address|Container" || echo -e "${RED}❌ Could not inspect network $NETWORK_NAME${NC}"

pause

echo -e "${BOLD}🗄️  3. Supabase Connection Check${NC}"
# Load Supabase credentials from worker .env if it exists
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DOTENV_PATH="$SCRIPT_DIR/../packages/worker/.env"
if [ -f "$DOTENV_PATH" ]; then
    S_URL=$(grep "SUPABASE_URL=" "$DOTENV_PATH" | cut -d'=' -f2)
    S_KEY=$(grep "SUPABASE_SERVICE_ROLE_KEY=" "$DOTENV_PATH" | cut -d'=' -f2)
    
    if [ ! -z "$S_URL" ] && [ ! -z "$S_KEY" ]; then
        echo -e "URL: ${BLUE}$S_URL${NC}"
        # Mask the key for safety
        MASKED_KEY="${S_KEY:0:10}...${S_KEY: -10}"
        echo -e "Key: $MASKED_KEY"
        
        # Test connection
        echo "Testing reachability..."
        HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -m 5 "$S_URL/rest/v1/" \
            -H "apikey: $S_KEY" \
            -H "Authorization: Bearer $S_KEY")
            
        if [ "$HTTP_STATUS" == "200" ]; then
            echo -e "${GREEN}✅ Supabase API is reachable and credentials are valid (Status: $HTTP_STATUS)${NC}"
        else
            echo -e "${RED}❌ Supabase connection failed! (Status: $HTTP_STATUS)${NC}"
        fi
    else
        echo -e "${RED}❌ Supabase credentials not found in $DOTENV_PATH${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  $DOTENV_PATH not found. Skipping Supabase check.${NC}"
fi

echo -e "\n${BOLD}🗃️  3.1 Database Schema Integrity Check${NC}"
echo -e "${BLUE}Comparing live schema with migrations/schema.sql...${NC}"
# Use the same bun run command but make sure we have the context
if [ -f "$DOTENV_PATH" ]; then
    bun run "$SCRIPT_DIR/db-integrity-check.ts" || echo -e "${RED}❌ Schema mismatch detected!${NC}"
else
    echo -e "${YELLOW}⚠️  Skipping schema check (no worker .env for credentials).${NC}"
fi

pause

echo -e "${BOLD}🖥️  4. Blueprints Backend Inspection${NC}"
BACKEND_CONTAINER=$(docker ps -q -f name=backend)
if [ -z "$BACKEND_CONTAINER" ]; then
    echo -e "${YELLOW}⚠️  Backend container NOT currently running. Checking for native process...${NC}"
    
    # Try reaching it via localhost (assuming default port 4000)
    BACKEND_PORT=${PORT:-4000}
    BACKEND_HEALTH=$(curl -s -m 2 http://localhost:$BACKEND_PORT/health || echo "fail")
    
    if [ "$BACKEND_HEALTH" != "fail" ]; then
        echo -e "${GREEN}✅ Backend is running natively on port $BACKEND_PORT${NC}"
        echo -e "${BLUE}Health Status:${NC} $BACKEND_HEALTH"
    else
        echo -e "${RED}❌ Backend is NOT running on port $BACKEND_PORT${NC}"
        echo -e "\n${YELLOW}❓ Would you like to test a custom backend API URL? (e.g. your Render URL) [y/N]${NC}"
        read -r TEST_CUSTOM
        if [[ "$TEST_CUSTOM" =~ ^[Yy]$ ]]; then
            echo -n "Enter URL (including http/https): "
            read -r CUSTOM_URL
            echo -e "Testing ${BLUE}$CUSTOM_URL/health${NC}..."
            CUSTOM_HEALTH=$(curl -s -m 5 "$CUSTOM_URL/health" || echo "fail")
            if [ "$CUSTOM_HEALTH" != "fail" ]; then
                echo -e "${GREEN}✅ Custom Backend is reachable!${NC}"
                echo -e "${BLUE}Health Status:${NC} $CUSTOM_HEALTH"
            else
                echo -e "${RED}❌ Custom Backend at $CUSTOM_URL/health is NOT reachable.${NC}"
            fi
        else
            echo "Continuing diagnostics..."
        fi
    fi
else
    echo -e "${GREEN}✅ Backend is running in Docker (ID: $BACKEND_CONTAINER)${NC}"
    echo -e "${BLUE}Detected Networks:${NC}"
    docker inspect $BACKEND_CONTAINER --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}: {{.IPAddress}}{{end}}'
fi

pause

echo -e "${BOLD}🏗️  5. Blueprints Worker Inspection${NC}"
WORKER_CONTAINER=$(docker ps -q -f name=worker)
if [ -z "$WORKER_CONTAINER" ]; then
    echo -e "${YELLOW}⚠️  Worker container NOT currently running. Checking for native process...${NC}"
    
    # Try reaching it via localhost (assuming default port 5000)
    WORKER_PORT=${PORT:-5000}
    HEALTH_CHECK=$(curl -s -m 2 http://localhost:$WORKER_PORT/health || echo "fail")
    
    if [ "$HEALTH_CHECK" != "fail" ]; then
        echo -e "${GREEN}✅ Worker is running natively on port $WORKER_PORT${NC}"
        echo -e "${BLUE}Health Status:${NC} $HEALTH_CHECK"
    else
        echo -e "${RED}❌ Worker is NOT running (neither in Docker nor natively on port $WORKER_PORT)${NC}"
    fi
else
    echo -e "${GREEN}✅ Worker is running in Docker (ID: $WORKER_CONTAINER)${NC}"
    echo -e "${BLUE}Detected Networks:${NC}"
    docker inspect $WORKER_CONTAINER --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}: {{.IPAddress}}{{end}}'
    echo -e "${BLUE}Key Environment Variables:${NC}"
    docker inspect $WORKER_CONTAINER --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -E "AGENTS_DATA_|DOCKER_NETWORK_NAME|OPENCLAW"
    echo -e "${BLUE}Agents Data Mounts:${NC}"
    docker inspect $WORKER_CONTAINER --format '{{range .Mounts}}SRC: {{.Source}} -> DST: {{.Destination}} (RW: {{.RW}}){{println}}{{end}}' | grep agents-data
fi

pause

echo -e "${BOLD}🤖 6. OpenClaw Agent Inspection${NC}"
AGENT_CONTAINERS=$(docker ps -q -f name=openclaw)
if [ -z "$AGENT_CONTAINERS" ]; then
    echo -e "${YELLOW}⚠️ No OpenClaw agents currently running.${NC}"
else
    for AGENT in $AGENT_CONTAINERS; do
        NAME=$(docker inspect $AGENT --format '{{.Name}}')
        echo -e "🔎 ${BOLD}Agent:${NC} ${CYAN}$NAME${NC} (ID: $AGENT)"
        echo -e "   ${BLUE}Networks & IP:${NC}"
        docker inspect $AGENT --format '   {{range $k, $v := .NetworkSettings.Networks}}{{$k}}: {{.IPAddress}}{{end}}'
        echo -e "   ${BLUE}Mounts:${NC}"
        docker inspect $AGENT --format '{{range .Mounts}}   SRC: {{.Source}} -> DST: {{.Destination}}{{println}}{{end}}'
    done
fi

pause

pause

echo -e "${BOLD}📜 7. Recent Logs (Last 20 lines)${NC}"
if [ ! -z "$BACKEND_CONTAINER" ]; then
    echo -e "--- ${BOLD}BACKEND LOGS${NC} ---"
    docker logs --tail 20 $BACKEND_CONTAINER
fi

if [ ! -z "$WORKER_CONTAINER" ]; then
    echo -e "--- ${BOLD}WORKER LOGS${NC} ---"
    docker logs --tail 20 $WORKER_CONTAINER
fi

if [ ! -z "$AGENT_CONTAINERS" ]; then
    for AGENT in $AGENT_CONTAINERS; do
        NAME=$(docker inspect $AGENT --format '{{.Name}}')
        echo -e "\n--- ${BOLD}AGENT LOGS ($NAME)${NC} ---"
        docker logs --tail 20 $AGENT
    done
fi

echo -e "\n${CYAN}========================================================${NC}"
echo -e "${BOLD}🏁 END OF REPORT${NC}"
echo -e "${CYAN}========================================================${NC}"

