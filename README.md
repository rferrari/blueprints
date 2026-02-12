# Blueprints

**Blueprints** is the alpha version of an **Agents Launchpad**. While it currently starts with support for `elizaos`, the vision is to support multiple agent frameworks in the near future.

This monorepo manages the deployment, state, and configuration of these AI Agents.

## Project Structure

This project is organized as a monorepo with the following packages:

- **`packages/frontend`**: A [Next.js](https://nextjs.org/) application providing the UI for managing projects and agents.
  - **Tech Stack**: React, Tailwind CSS, Supabase
- **`packages/backend`**: A [Fastify](https://fastify.dev/) server providing the REST API.
  - **Tech Stack**: Fastify, Supabase
- **`packages/worker`**: A worker process for handling background tasks and state synchronization.
- **`packages/shared`**: Shared code, type definitions, and [Zod](https://zod.dev/) validation schemas used across the monorepo.
- **`external/`**: External dependencies and agent frameworks.

## Key Features

### 🖥️ Integrated Agent Terminal
Blueprints features a professional-grade terminal integrated directly into the agent's chat interface. This allows for:
- **Direct Container Control**: Execute shell commands directly inside the agent's isolated environment.
- **Dual Routing System**: Seamlessly toggle between **Chat Mode** (Natural Language) and **Terminal Mode** (Shell Commands).
- **Advanced Diagnostics**: Access logs, file systems, and environment variables without leaving the dashboard.
- **Slash Commands**: Power users can use the `/terminal <command>` prefix to trigger shell execution even while in Chat Mode.

## Security Levels & Isolation Model

Blueprints ships with a tiered container security model designed to balance safety, power, and operational control.

### STANDARD (Default / Free Tier)

Workspace-only access.

- ✅ Only `/home/node` is writable  
- ✅ Non-root user  
- ✅ Root filesystem is read-only  
- ✅ No Linux capabilities  
- ✅ Cannot escalate privileges  

Effectively equivalent to a Google Colab–style sandbox.

Use case: hobby projects, experimentation, safe agents.

---

### PRO

Builder-grade observability with limited privileges.

- ✅ `SYS_ADMIN` capability  
- ✅ Still non-root  
- ✅ System filesystem remains read-only  
- ✅ Can inspect kernel / system state  
- ❌ Cannot modify system files  

Use case: power users, agent builders, diagnostics.

---

### ADVANCED (Enterprise)

Full container control.

- ✅ Runs as root  
- ✅ Read/write access to `/`  
- ✅ `SYS_ADMIN`  
- ✅ `NET_ADMIN`  

Still isolated from the host (no docker socket, no host filesystem).

Use case: enterprise automation, complex integrations.

---

### ADMIN (Internal / Hidden)

Host-level access used only by platform operators for debugging and recovery.

Not exposed to end users.

---

 The Communication Flow
The path of a message looks like this: 
User
 → Frontend → Database → Worker → OpenClaw Agent (Docker) → LLM (OpenAI/Venice/etc.)

Worker to OpenClaw Agent: This is where chatCompletions matters. We use the OpenAI-compatible API format to talk to the agent container. We do this because it's a standard way to send "messages" and get "responses" that include tool-use and planning logic.
OpenClaw Agent to LLM: The agent takes your message, thinks about it, and then talks to the actual LLM (like GPT-3.5 or a Venice model). It handles all the complex stuff (memory, tools, terminal commands).
2. What is chatCompletions?
When we set chatCompletions: { enabled: true } in the openclaw.json, we are telling the Agent's internal gateway to turn on its "OpenAI-compatible server."

Regardless of what LLM the agent is using (even if the LLM itself isn't OpenAI-compatible), the Agent acts as a translator. It presents itself to our Worker as an OpenAI-compatible endpoint. This allows our Worker to use a single, unified code path to talk to any OpenClaw agent.

3. "OpenAI Compatible" vs "Non-Compatible" Models
There are two types of compatibility to consider:

Provider Compatibility (The LLM):
If a model is OpenAI-compatible (like Venice models or GPT), OpenClaw talks to it using the standard openai provider.
If a model is NOT OpenAI-compatible (like Anthropic/Claude), OpenClaw has special "providers" built-in to handle the translation.
Agent Compatibility (How we talk to the container):
Because we enabled the chatCompletions endpoint, we can always talk to the agent using the worker's chat logic, even if the agent is using a non-OpenAI model as its brain.

### Architectural Model

STANDARD → jailed
PRO → observability
ADVANCED → power
ADMIN → host (hidden)


This maps cleanly to:

- hobby  
- builder  
- enterprise  
- ops  


## Prerequisites

- [Bun](https://bun.sh/) (Runtime & Package Manager)
- [Supabase](https://supabase.com/) (Database & Auth)

## Getting Started

1.  **Install dependencies:**

    ```bash
    bun install
    ```

2.  **Environment Setup:**

    Ensure you have the necessary environment variables set up for Supabase and other services. Check each package's directory for `env.sample` files if available.

    - The database schema is located in `schema.sql`.

## Running the Application

You can run each service individually using the following commands:

### Frontend

Start the Next.js development server:

```bash
bun run dev:frontend
# Runs: bun run --cwd packages/frontend dev
```

### Backend

Start the Fastify backend server:

```bash
bun run dev:backend
# Runs: bun run --cwd packages/backend dev
```

### Worker

Start the background worker process:

```bash
bun run dev:worker
# Runs: bun run --cwd packages/worker dev
```

## Building

To build all packages in the workspace:

```bash
bun run build
# Runs: bun run build --workspaces
```

## Linting

To run linting across all packages:

```bash
bun run lint
# Runs: bun run lint --workspaces
```
## Documentation

- [OpenClaw Integration Walkthrough](docs/openclaw-integration.md)



---

## System Maintenance & Rebuilding

After making changes to the source code or configurations, follow these steps to ensure all components are properly rebuilt and updated.

### 1. Rebuild the Worker
If you modify worker-specific logic (e.g., in `openclaw.ts` or `eliza.ts`), you must rebuild the worker container:

```bash
docker compose build worker
docker compose up -d worker
```

### 2. Rebuild Agent Images
If you modify the base agent Dockerfiles (e.g., `scripts/eliza.dockerfile`), trigger a fresh build of the agent image:

```bash
./scripts/2-setup-eliza.sh
```

### 3. Restart Agents
When the worker is updated, existing agents must be stopped and started via the UI or API to pick up the new logic. This ensures:
- The correct directory structures (like `.openclaw/`) are created.
- Correct volume permissions (`chown`) are applied.
- New environment variables and path mappings are active.

### 4. Migration & Permissions (First-time setup)
Ensure your `packages/worker/.env` contains the required path variables:

```env
AGENTS_DATA_HOST_PATH=/var/lib/blueprints/agents-data
AGENTS_DATA_CONTAINER_PATH=/mnt/agents-data
```

And verify the host directory exists with correct permissions:

```bash
sudo mkdir -p /var/lib/blueprints/agents-data
sudo chown -R 1000:1000 /var/lib/blueprints/agents-data
```

---

Once these steps are completed, your system is fully rebuilt and synchronized.
