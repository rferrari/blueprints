#!/bin/bash
set -e

# Make sure Bun binaries are in PATH (if accessible)
export PATH="/root/.bun/bin:$PATH"

# If arguments are provided, execute them
if [ "$#" -gt 0 ]; then
    exec "$@"
else
    # Default to starting elizaos
    echo "Starting ElizaOS agent..."
    exec elizaos start
fi
