# 1. Base Image: We start with a lightweight version of Node.js 20.
# 'slim' means it only contains the bare essentials to run Node, keeping the image small.
FROM node:20-slim

# 2. Working Directory: Define where our app files will live inside the container.
# All subsequent commands (RUN, COPY) will happen inside this folder.
WORKDIR /app

# 3. System Utilities: Install external libraries needed for the agent to function.
# - curl: To download files or check network health.
# - ffmpeg: Necessary for processing audio/video (voice chat features).
# - git: Needed if the agent needs to clone plugins or repositories.
# - python3: Often required for building native Node.js addons (like sqlite or crypto).
# We clean up the cache (rm -rf) after install to keep the final image size small.
RUN apt-get update && \
  apt-get install -y curl ffmpeg git python3 && \
  rm -rf /var/lib/apt/lists/*

# 4. Bun Manager: Install 'Bun' globally using npm.
# Bun is a faster alternative to npm/yarn and is the preferred runner for ElizaOS.
RUN npm install -g bun

# 5. Environment Paths: Tell the system where Bun's binary files are located.
# This allows us to run 'bun' or 'elizaos' from any folder inside the container.
ENV PATH="/root/.bun/bin:$PATH"

# 6. ElizaOS CLI: Use Bun to install the ElizaOS command-line interface globally.
# This gives the container the 'elizaos' command.
RUN bun add -g @elizaos/cli

# 7. Global Access Fix: Move the 'elizaos' tool to a directory that all users can access.
# By default, bun installs to /root/, but we want the 'node' user to be able to run it.
RUN cp /root/.bun/bin/elizaos /usr/local/bin/elizaos && \
  chmod +x /usr/local/bin/elizaos

# 8. Pre-installation: Run the 'create agent' command DURING the build.
# This downloads all dependencies once so the agent starts up instantly when the container is run.
# Without this, every restart would take minutes to "build" the agent.
RUN elizaos create agent -y --type project && \
  cd agent && \
  echo "ElizaOS agent pre-installed in image"

# 9. Security Hardening: Change ownership of the /app folder from root to the 'node' user.
# User ID 1000 is the default 'node' user. We do this so the agent can write its own
# logs and knowledge files without needing 'root' (admin) privileges.
RUN chown -R 1000:1000 /app

# 10. Final Working Dir: Set the starting point to the newly created agent folder.
WORKDIR /app/agent

# 11. Entrypoint Script: Copy our startup script into the root of the container.
# This script handles the final 'elizaos start' command when the container launches.
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# 12. Networking: Inform Docker that the agent listens on port 3000.
# This allows us to map this port to a real VPS port (like 19001) later.
EXPOSE 3000

# Start! Execute the entrypoint script.
ENTRYPOINT ["/entrypoint.sh"]
