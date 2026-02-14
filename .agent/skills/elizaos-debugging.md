---
name: elizaos-debugging
description: Troubleshooting and managing multi-agent ElizaOS containers
---

# ElizaOS Multi-Agent Debugging Skill

This skill provides instructions for debugging and managing project-scoped ElizaOS containers.

## 📦 Container Structure
- **Container Name**: `elizaos-{projectId}`
- **Volume**: `/agent-home` is mapped to `./workspaces/{projectId}/home`
- **User**: Runs as UID 1000

## 🛠️ Common Debugging Commands

### 1. Check Running Agents
List all agents registered within a project container:
```bash
docker exec elizaos-{projectId} /bin/bash -c 'export PATH="/root/.bun/bin:$PATH"; elizaos agent list'
```

### 2. Inspect Agent Process
Since `procps` is installed, you can see the active Node/Bun processes:
```bash
docker exec elizaos-{projectId} ps aux | grep elizaos
```

### 3. Verify Character Config
Check the sanitized JSON character file inside the container:
```bash
docker exec elizaos-{projectId} cat /agent-home/{agentId}.json
```

### 4. Manually Start an Agent
If an agent fails to start, try running the command manually to see validation errors:
```bash
docker exec elizaos-{projectId} /bin/bash -c 'export PATH="/root/.bun/bin:$PATH"; elizaos agent start --path /agent-home/{agentId}.json'
```

## 🧹 Error Patterns

### Character Validation Failed
- **Cause**: Invalid keys (e.g., `modelProvider`) or missing required fields.
- **Fix**: Check `elizaos.ts` sanitization logic or the base character schema.

### CLI Not Found
- **Cause**: `PATH` is not correctly exported in the `docker exec` session.
- **Fix**: Always prefix commands with `export PATH="/root/.bun/bin:$PATH";`.

### Volume Permissions
- **Cause**: Host directory owned by root.
- **Fix**: The worker attempts to `chown` but verify host side with `ls -la workspaces/{projectId}/home`.
