# Adding a New AI Framework

The Blueprints system is designed to be extensible. Follow this guide to integrate a new AI agent framework (e.g., "MegaAgent").

## 1. Shared Infrastructure

### `packages/shared/src/index.ts`
Add your framework to the `SUPPORTED_FRAMEWORKS` constant and update the `CreateAgentSchema`.

```typescript
export const SUPPORTED_FRAMEWORKS = ['elizaos', 'openclaw', 'picoclaw', 'megaagent'] as const;
```

## 2. Worker Implementation

### `packages/worker/src/handlers/megaagent.ts`
Create a new handler file that implements the `AgentHandler` logic:

```typescript
import { logger } from '../lib/logger';
import { docker } from '../lib/docker';
import { getAgentContainerName, ensureAgentDirectory } from '../lib/utils';
import path from 'path';
import fs from 'fs/promises';

export async function startMegaAgent(agentId: string, config: any, metadata: any, forceRestart = false) {
    const containerName = getAgentContainerName(agentId, 'megaagent');
    // Implement container startup logic...
}

export async function stopMegaAgent(agentId: string) {
    // Implement container stop logic...
}
```

### `packages/worker/src/handlers/index.ts`
Register your new handler in the `FRAMEWORK_HANDLERS` map.

```typescript
import { startMegaAgent, stopMegaAgent } from './megaagent';

export const FRAMEWORK_HANDLERS: Record<string, AgentHandler> = {
    // ... existing handlers
    'megaagent': {
        start: startMegaAgent,
        stop: stopMegaAgent
    }
};
```

## 3. Setup Script

### `scripts/2.x-megaagent.sh`
Create a setup script to build the Docker image for your framework. It should:
1. Clone the framework repository.
2. Build a Docker image named `megaagent:local`.
3. Register the framework version using `scripts/supabase-utils/sync-framework.ts`.

Then add this script to the `SCRIPTS` array in `scripts/0-setup.sh`.

## 4. Frontend Integration

### `packages/frontend/src/components/megaagent-wizard.tsx`
Create a configuration wizard component specific to your framework's required settings (model, API keys, etc.).

### `packages/frontend/src/components/project-view.tsx`
1. Update `newAgentFramework` state type.
2. Add a selection button in the "Install New Intelligence" modal.
3. Conditionally render your wizard in the `editingAgent` block.

## 5. Deployment
- Run `scripts/2.x-megaagent.sh` to build the image.
- Restart the worker to pick up the new handler code.
- Reload the frontend.
