#!/bin/bash

# WARNING:
# This script is for FIRST VPS SETUP ONLY.
# Not used in production runtime.

# Blueprints Master Setup Script
# Orchestrates the setup process for scripts 1, 2, 3, and 5.

set -e

# Ensure we are in the root of the monorepo
if [ ! -d "scripts" ]; then
    echo "🛑 Error: Please run this script from the root of the blueprints monorepo."
    exit 1
fi

SCRIPTS=(
    "1-setup-vps.sh"
    "2-setup-eliza.sh"
    "3-setup-openclaw.sh"
    "4-setup-network.sh"
    "5-vps-diagnostics.sh"
    "6-setup-auto-deploy.sh"
)

echo "========================================================"
echo "   BLUEPRINTS MASTER SETUP   "
echo "========================================================"
echo ""

for SCRIPT in "${SCRIPTS[@]}"; do
    SCRIPT_PATH="scripts/$SCRIPT"
    
    if [ ! -f "$SCRIPT_PATH" ]; then
        echo "⚠️ Warning: Script $SCRIPT_PATH not found, skipping..."
        continue
    fi

    echo "--------------------------------------------------------"
    echo "Next step: $SCRIPT"
    
    while true; do
        # Prompt for user input
        read -p "Continue, sKip, or Stop? [c/k/s]: " choice
        case $choice in
            [Cc]* ) 
                echo "🚀 Running $SCRIPT..."
                chmod +x "$SCRIPT_PATH"
                ./"$SCRIPT_PATH"
                break;;
            [Kk]* ) 
                echo "⏭️  Skipping $SCRIPT."
                break;;
            [Ss]* ) 
                echo "🛑 Stopping setup."
                exit 0;;
            * ) 
                echo "Please answer C, K, or S.";;
        esac
    done
done

echo ""
echo "========================================================"
echo "✅ Blueprints setup process completed!"
echo "You can now run:
echo "'docker compose up -d'"
echo " and the worker will be able to start agents."
echo "========================================================"
