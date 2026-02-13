# Blueprints MCP Server Skill

This skill allows agents to interact with the Blueprints backend programmatically via the Model Context Protocol (MCP).

## Connectivity
- **Transport**: SSE (Server-Sent Events)
- **SSE URL**: `${BACKEND_URL}/mcp/sse`
- **Messages URL**: `${BACKEND_URL}/mcp/messages`
- **Authentication**: Bearer Token (`bp_sk_...`) in the `Authorization` header.

## Available Tools

### Agent Management
- `list_agents()`: Returns a list of all agents owned by the user.
- `create_agent(project_id, name, framework, config?)`: Creates a new agent.
- `start_agent(agent_id)`: Triggers an agent to start.
- `stop_agent(agent_id)`: Triggers an agent to stop.
- `edit_agent_config(agent_id, config)`: Updates agent parameters.
- `remove_agent(agent_id)`: Deletes an agent.

### Messaging
- `send_message(agent_id, content)`: Posts a message to the agent's interaction log.

### Account (Redirects)
- `account_register(email)`: Information on signing up.
- `pay_upgrade(tier)`: Information on upgrading.

## Available Resources
- `agent://{id}/state`: JSON object containing the current status and health of the agent.
- `agent://{id}/config`: JSON object containing the decrypted configuration of the agent.

## Usage Guidelines
1. **Always list agents first** to get the correct UUIDs.
2. **Context Awareness**: Use the `agent_state` resource to verify if an agent is running before sending messages.
3. **Audit Trails**: Be aware that every tool call is logged to the user's `mcp_audit_logs`.
