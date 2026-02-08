#!/bin/bash

# Auto-Deploy Script for Blueprints Worker
# Checks for git updates and rebuilds the worker container if changes are found.

# Configuration
REPO_DIR="/opt/blueprints"
SERVICE_NAME="worker"
LOG_FILE="/var/log/blueprints-deploy.log"

# Ensure Bun is in PATH (common locations)
export PATH=$PATH:/root/.bun/bin:/usr/local/bin:/home/ubuntu/.bun/bin:/home/debian/.bun/bin:/home/ricardo/.bun/bin:/home/adam/.bun/bin

# function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Ensure log file exists and is writable
touch "$LOG_FILE" || { echo "Cannot write to $LOG_FILE"; exit 1; }

# Navigate to repo directory
if [ -d "$REPO_DIR" ]; then
    cd "$REPO_DIR" || { log "Failed to cd into $REPO_DIR"; exit 1; }
else
    # Fallback to current directory if REPO_DIR doesn't exist (useful for testing)
    REPO_DIR=$(pwd)
    log "Warning: $REPO_DIR not found, using current directory: $(pwd)"
fi

# Fetch latest changes - use "origin" to ensure tracking branch is updated
git fetch origin

# Check if local is behind remote
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" != "$REMOTE" ]; then
    log "Updates detected. Pulling changes..."

    # Capture details for recording
    COMMIT_HASH=$(git rev-parse HEAD)
    BRANCH=$(git rev-parse --abbrev-ref HEAD)
    MESSAGE=$(git log -1 --pretty=%B)

    # Record Start
    # We use bun to run the ts script. Ensure bun is in path or use absolute path if needed.
    # Assuming running as root via systemd, bun might need full path or environment setup.
    # For now relying on PATH being set or adding it.
    DEPLOYMENT_ID=$(bun run scripts/record-deployment.ts start "$COMMIT_HASH" "$BRANCH" "$MESSAGE")
    log "Deployment ID: $DEPLOYMENT_ID"

    # Pull changes
    if git pull origin main; then
        log "Code updated successfully."
        
        log "Rebuilding and restarting $SERVICE_NAME..."
        # Rebuild only the specified service
        if docker compose up "$SERVICE_NAME" --build -d; then
            log "Deployment successful!"
            bun run scripts/record-deployment.ts finish "$DEPLOYMENT_ID" "success"
        else
            log "Error: Docker compose failed."
            bun run scripts/record-deployment.ts finish "$DEPLOYMENT_ID" "failed"
        fi
    else
        log "Error: Git pull failed."
        bun run scripts/record-deployment.ts finish "$DEPLOYMENT_ID" "failed"
    fi
else
    # Uncomment to log "no changes" checks, otherwise keep silent to avoid log spam
    # log "No updates found. System is up to date."
    :
fi
