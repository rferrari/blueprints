# Blueprints MCP Server Skill

This skill allows agents to interact with the Blueprints backend programmatically via the Model Context Protocol (MCP).

## Connectivity
- **Transport**: Direct JSON over HTTP POST
- **Messages URL**: `${BASE_URL}/mcp/messages`
- **Authentication**: Bearer Token (`bp_sk_...`) in the `Authorization` header.

## Protocol Workflow (CRITICAL)

The MCP server uses a robust **Direct JSON over POST** transport. Results are returned directly in the HTTP response body.

### 1. Initialize Session (POST)
You **MUST** initialize via POST before calling any tools.
```bash
curl -i -X POST "${BASE_URL}/mcp/messages" \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -d '{
       "jsonrpc": "2.0",
       "id": 1,
       "method": "initialize",
       "params": {
         "protocolVersion": "2024-11-05",
         "capabilities": {},
         "clientInfo": { "name": "agent-client", "version": "1.0.0" }
       }
     }'
```
The server will respond with JSON. **Capture the `mcp-session-id` header from the response.**

### 2. Complete Handshake (Mandatory)
After receiving the initialization response, you **MUST** send an `initialized` notification. For this and all subsequent calls, you must provide the session ID in **BOTH** the `mcp-session-id` header and the `sessionId` query parameter.

```bash
curl -X POST "${BASE_URL}/mcp/messages?sessionId=YOUR_SESSION_ID" \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -H "mcp-session-id: YOUR_SESSION_ID" \
     -d '{
       "jsonrpc": "2.0",
       "method": "notifications/initialized"
     }'
```

### 3. Call Tools (Direct JSON)
Once the handshake is complete, you can call tools.
```bash
curl -X POST "${BASE_URL}/mcp/messages?sessionId=YOUR_SESSION_ID" \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -H "mcp-session-id: YOUR_SESSION_ID" \
     -d '{
       "jsonrpc": "2.0",
       "id": 2,
       "method": "tools/call",
       "params": { "name": "list_agents", "arguments": {} }
     }'
```

## Security Scopes (RBAC)

Every MCP tool requires a specific scope. When creating an API key, ensure you grant the necessary permissions:

| Operation | Scope Required | Description |
| :--- | :--- | :--- |
| `list_agents` | `read` | View the list of agents in your account. |
| `agent_status` | `read` | Get detailed health and stats for an agent. |
| `create_agent` | `write` | Provision a new agent. |
| `edit_agent_config` | `write` | Update agent brain configuration. |
| `remove_agent` | `write` | Permanently delete an agent. |
| `send_message` | `write` | Post a chat message to an agent. |
| `start_agent` | `execute` | Power on an agent container. |
| `stop_agent` | `execute` | Power off an agent container. |
| `send_terminal` | `terminal` | Execute raw shell commands in the container. |
| **All Tools** | `admin` | Grant all of the above permissions. |

> [!CAUTION]
> **Terminal Security**: The `terminal` scope allows raw shell access to the agent container. Use this scope only with highly trusted agents and secure API keys.

## Available Tools

### Agent Management
- `list_agents()`: Returns a list of all agents owned by the user.
- `create_agent(project_id?, name, framework, config?)`: Creates a new agent.
- `start_agent(agent_id)`: Triggers an agent to start.
- `stop_agent(agent_id)`: Triggers an agent to stop.
- `edit_agent_config(agent_id, config)`: Updates agent parameters.
- `remove_agent(agent_id)`: Deletes an agent.

### Messaging & Terminal
- `send_message(agent_id, content)`: Posts a message to the agent's interaction log.
- `send_terminal(agent_id, command)`: Executes a command directly in the agent's shell terminal.

### Account & Help
- `agent_status(agent_id)`: Get detailed health/stats for an agent.
- `account_register(email)`: Information on signing up.
- `pay_upgrade(tier)`: Information on upgrading.

## Available Resources
- `agent://{id}/state`: Current status and health of the agent.
- `agent://{id}/config`: Decrypted configuration of the agent.

## Usage Guidelines
1. **Always list agents first** to get the correct UUIDs.
2. **Session Cleanup**: Sessions expire after prolonged inactivity. If you receive a 404, re-initialize.
3. **Audit Trails**: Every tool call is logged to the user's `mcp_audit_logs`.
