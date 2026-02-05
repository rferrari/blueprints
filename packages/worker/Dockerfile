FROM oven/bun:1.1.0

WORKDIR /app

COPY package.json bun.lock ./
COPY packages ./packages

RUN bun install --frozen-lockfile

CMD ["bun", "run", "--cwd", "packages/worker", "start"]
