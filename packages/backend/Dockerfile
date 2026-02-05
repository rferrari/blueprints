FROM oven/bun:1.1.0

WORKDIR /app

# Copy monorepo files needed for build
COPY package.json bun.lock ./
COPY packages ./packages

# Install deps
RUN bun install --frozen-lockfile

# Expose Fastify port
EXPOSE 3000

# Run backend
CMD ["bun", "run", "--cwd", "packages/backend", "start"]
