FROM node:20-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y curl ffmpeg git python3 && \
    rm -rf /var/lib/apt/lists/*

# Install Bun
RUN npm install -g bun

# Set up Bun environment
ENV PATH="/root/.bun/bin:$PATH"

# Install ElizaOS CLI globally
RUN bun add -g @elizaos/cli

# Pre-install ElizaOS agent during build for faster startup
RUN elizaos create agent -y --type project && \
    cd agent && \
    echo "ElizaOS agent pre-installed in image"

# Set working directory to the agent
WORKDIR /app/agent

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose port for the agent
EXPOSE 3000

# Run as node user for security
RUN chown -R node:node /app
USER node

ENTRYPOINT ["/entrypoint.sh"]
