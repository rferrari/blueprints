#!/bin/bash

# Auto-Deploy Script for Blueprints Worker
# Checks for git updates and rebuilds the worker container if changes are found.

# Configuration
REPO_DIR="/opt/blueprints"
SERVICE_NAME="worker"
LOG_FILE="/var/log/blueprints-deploy.log"

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

# Fetch latest changes
git fetch origin main

# Check if local is behind remote
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" != "$REMOTE" ]; then
    log "Updates detected. Pulling changes..."
    
    # Pull changes
    if git pull origin main; then
        log "Code updated successfully."
        
        log "Rebuilding and restarting $SERVICE_NAME..."
        # Rebuild only the specified service
        if docker compose up "$SERVICE_NAME" --build -d; then
            log "Deployment successful!"
        else
            log "Error: Docker compose failed."
        fi
    else
        log "Error: Git pull failed."
    fi
else
    # Uncomment to log "no changes" checks, otherwise keep silent to avoid log spam
    # log "No updates found. System is up to date."
    :
fi
