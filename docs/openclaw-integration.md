# OpenClaw Integration Walkthrough

This document outlines how the **OpenClaw** framework was integrated into the blueprints monorepo. The system now supports deploying both ElizaOS and OpenClaw agents, with OpenClaw agents running in isolated Docker containers managed by the worker.

## Architecture Overview

### 1. Multi-Framework Worker
The worker (`packages/worker/src/index.ts`) has been refactored to handle different frameworks based on the `framework` field in the database.
-   **ElizaOS**: Uses the existing API-based runtime logic.
-   **OpenClaw**: Uses the `dockerode` library to manage Docker containers locally. Each agent runs in its own container named `openclaw-<agentId>`.

### 2. Full-Stack API Updates
-   **Database**: Added `framework` column to the `agents` table (defaulting to 'eliza').
-   **Backend**: Updated the agent creation endpoint (`packages/backend/src/routes/agents.ts`) to accept and store the framework choice.
-   **Shared**: Added Zod schemas for validated agent creation in `packages/shared/src/index.ts`.

### 3. Responsive UI & Onboarding
-   **Framework Selection**: When deploying a new agent in `ProjectView`, users can choose between ElizaOS and OpenClaw.
-   **Onboarding Wizard**: A dedicated `OpenClawWizard` guides users through complex configurations (Providers, Credentials, Gateway, and Channels) immediately after deployment.
-   **Framework Display**: Agent cards now clearly display which framework the agent is running on.

## Configuration Management

### 1. Structured Schema
The system uses a shared Zod schema (`OpenClawConfigSchema`) to validate configurations. This schema covers:
-   **Auth**: Multi-provider support (Anthropic, OpenAI) with API key or session token modes.
-   **Gateway**: Token-based security for worker-to-agent communication.
-   **Channels**: Initial support for Telegram bot integration.

### 2. Automatic Persistence
Configuring an agent via the Wizard or Editor triggers the following flow:
1.  **Frontend**: Wizard collects UI data and transforms it into the OpenClaw JSON structure.
2.  **Supabase**: The configuration is stored in the `agent_desired_state` table.
3.  **Worker**: The worker detects the change, writes a physical `openclaw.json` file to the agent's workspace directory (`workspaces/<agentId>/`), and restarts the container if necessary.
4.  **Docker**: The container uses a **Host Bind Mount** to access the config. The worker maps the local `workspaces/<agentId>` directory to the container's `/home/node/.openclaw` directory. This allows the agent to read and write state in real-time.

## Communication & Networking

### 1. Deterministic Port Mapping
To allow the backend to communicate with multiple agents concurrently without port conflicts, the worker calculates a unique host port for each agent using a hash of its UUID:
`HostPort = 19000 + (hash(agentId) % 1000)`

### 2. Backend Proxy
The backend's `/agents/:agentId/chat` route acts as a proxy. It fetches the `endpoint_url` (mapped to the deterministic port) and the Gateway Token from the database, then forwards the OpenAI-compatible request to the agent container.

## Robust Reconciliation & Safety

### 1. Docker State Verification
The worker doesn't just trust the database. On every reconciliation loop, it lists active Docker containers. If an agent is marked as `running` in the DB but the container is missing, the worker will:
1.  Immediately sync the DB status back to `stopped`.
2.  Attempt to restart the container if the agent is still `enabled`.

### 2. CPU Safety (Retry Limit)
To prevent infinite restart loops (e.g., if a Docker image is missing or a config is corrupt), the worker tracks consecutive start failures:
-   **Max Retries**: 3
-   **Action**: After 3 failures, the worker automatically sets `enabled: false` in the `agent_desired_state` and stops retrying.

1.  **Build the OpenClaw Image**:
    ```bash
    cd external/openclaw && docker build -t openclaw:local .
    ```

2.  **Start the Services**:
    ```bash
    bun run dev:backend
    bun run dev:frontend
    bun run dev:worker
    ```

3.  **Deploy & Configure**:
    - Open the dashboard and click "Deploy Agent".
    - Select **OpenClaw** and click "Create Agent Instance".
    - **Wizard**: Complete the 4-step wizard that appears.
    - **Verify**: Check `workspaces/<id>/openclaw.json` to confirm it matches your wizard input.

4.  **Verify Runtime**:
    - Run `docker ps` to see the new `openclaw-<agentId>` container.
    - Check the container logs: `docker logs -f openclaw-<agentId>`.

## Future Plans

-   **Log Streaming**: Implement a way to stream Docker logs back to the frontend UI's "Neural Logs" tab.
-   **Expanded Channels**: Add Discord, Slack, and X (Twitter) support to the onboarding wizard.
-   **Production Path**: Adapt Docker logic for Kubernetes or Cloud APIs.
