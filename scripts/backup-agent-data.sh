#!/bin/bash

# Blueprints Agent Data Backup Script
# Finds and backups all folders matching a specific Agent ID across common locations.
set -e # abort on errors.

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

AGENT_ID=$1
BACKUP_ROOT="$HOME/agents-data-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

if [ -z "$AGENT_ID" ]; then
    echo -e "${RED}Usage: $0 <agent_id>${NC}"
    echo "To backup all agents, use: $0 all"
    exit 1
fi

echo -e "${BLUE}🚀 Starting backup for Agent ID: ${YELLOW}$AGENT_ID${NC}"

# Define search locations
LOCATIONS=(
    "./workspaces"
    "./packages/worker/workspaces"
    "/var/lib/blueprints/agents-data"
    "/opt/blueprints/workspaces"
    "/app/workspaces"
)

# Target backup directory
TARGET_DIR="$BACKUP_ROOT/${AGENT_ID}_$TIMESTAMP"
mkdir -p "$TARGET_DIR"

FOUND_ANY=false

for LOC in "${LOCATIONS[@]}"; do
    if [ -d "$LOC" ]; then
        echo -e "Checking ${BLUE}$LOC${NC}..."

        if [ "$AGENT_ID" == "all" ]; then
            MATCHES=$(find "$LOC" -maxdepth 1 -mindepth 1 -type d)
        else
            MATCHES=$(find "$LOC" -maxdepth 1 -name "*$AGENT_ID*" -type d)
        fi

        for MATCH in $MATCHES; do
            BASENAME=$(basename "$MATCH")
            DEST="$TARGET_DIR/${BASENAME}_from_$(echo $LOC | sed 's/\//_/g')"

            echo -e "  Found: ${GREEN}$MATCH${NC} -> Backing up to ${YELLOW}$DEST${NC}"
            cp -r "$MATCH" "$DEST"
            FOUND_ANY=true
        done
    fi
done

if [ "$FOUND_ANY" = true ]; then
    echo -e "\n${GREEN}✅ Backup completed successfully!${NC}"
    echo -e "Files saved in: ${YELLOW}$TARGET_DIR${NC}"

    # Ask about zip
    echo
    read -p "Would you like to zip the backup? (y/N): " ZIP_CHOICE

    if [[ "$ZIP_CHOICE" =~ ^[Yy]$ ]]; then
        if ! command -v zip >/dev/null; then
            echo -e "${RED}❌ zip command not found. Install with:${NC}"
            echo "sudo apt install zip"
            echo -e "${YELLOW}Skipping compression.${NC}"
            exit 1
        fi

        ZIP_FILE="${TARGET_DIR}.zip"

        echo -e "${BLUE}📦 Creating zip: $ZIP_FILE${NC}"

        if zip -r "$ZIP_FILE" "$TARGET_DIR" >/dev/null; then
            echo -e "${GREEN}Zip created successfully.${NC}"
        else
            echo -e "${RED}Zip failed. Keeping original folder.${NC}"
            exit 1
        fi

        read -p "Keep unzipped folders as well? (y/N): " KEEP_CHOICE

        if [[ ! "$KEEP_CHOICE" =~ ^[Yy]$ ]]; then
            rm -rf "$TARGET_DIR"
            echo -e "${YELLOW}🧹 Removed unzipped folder. Keeping only zip.${NC}"
        else
            echo -e "${GREEN}📂 Keeping both zip and folders.${NC}"
        fi
    fi

else
    echo -e "\n${YELLOW}⚠️  No matching directories found for Agent ID: $AGENT_ID${NC}"
    rmdir "$TARGET_DIR" 2>/dev/null
fi
