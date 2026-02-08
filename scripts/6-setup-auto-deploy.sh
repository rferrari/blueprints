#!/bin/bash

# Setup Script for Auto-Deploy Service
# Creates a systemd service and timer to run the auto-deploy script periodically.

SERVICE_NAME="blueprints-auto-deploy"
SCRIPT_PATH="/opt/blueprints/scripts/auto-deploy.sh"

echo "Running Auto-Deploy Setup..."

# Ensure the auto-deploy script is executable
chmod +x "$SCRIPT_PATH"

# Create Service File
cat <<EOF > /etc/systemd/system/${SERVICE_NAME}.service
[Unit]
Description=Blueprints Auto-Deploy Service
After=network.target docker.service
Requires=docker.service

[Service]
Type=oneshot
ExecStart=$SCRIPT_PATH
User=root
WorkingDirectory=/opt/blueprints

[Install]
WantedBy=multi-user.target
EOF

# Create Timer File (Run every 5 minutes)
cat <<EOF > /etc/systemd/system/${SERVICE_NAME}.timer
[Unit]
Description=Run Blueprints Auto-Deploy every 5 minutes

[Timer]
OnBootSec=5min
OnUnitActiveSec=5min
Unit=${SERVICE_NAME}.service

[Install]
WantedBy=timers.target
EOF

# Reload Systemd and Enable Timer
systemctl daemon-reload
systemctl enable --now ${SERVICE_NAME}.timer

echo "✅ Auto-Deploy service installed and timer started."
echo "Check status with: systemctl status ${SERVICE_NAME}.timer"
