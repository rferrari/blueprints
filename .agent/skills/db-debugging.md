---
name: Database Debugging
description: Instructions for debugging and interacting with the clouded Supabase database using the provided script.
---

## 🛠️ Using Supabase MCP Server

This project integrates with the **Supabase MCP Server** to provide direct access to the database and project resources.

### 1. Verification & Enabling

Ensure the **supabase-mcp-server** is installed and enabled in your MCP settings. You can verify its availability by checking if tools like `mcp_supabase-mcp-server_list_projects` are available.

### 2. Connection Details

Connect to the **Blueprints** project using the following details:

- **Project Name**: `Blueprints`
- **Project ID**: `btxpmhkqmbqcfbcicwmk`
- **Region**: `us-west-2`
- **Organization ID**: `oaaiemwrorgjyuonlotw`

### 3. Usage

Use the MCP tools to interact with the database directly from your agent interface:
- **Execute SQL**: `mcp_supabase-mcp-server_execute_sql`
- **List Tables**: `mcp_supabase-mcp-server_list_tables`
- **Inspect Schema**: `mcp_supabase-mcp-server_get_project`

This allows for direct query execution and schema inspection without needing local scripts for simple tasks.

# Database Debugging Skill

This project uses a **cloud-hosted Supabase database**. You cannot connect to it using local `psql` or `localhost` connections unless you have the specific cloud credentials and are whitelisted.

Instead, use the provided helper script `scripts/supabase-utils/debug-db.ts` and others support scripts in the same directory to interact with the database safely using the environment configuration.

## ⛔ What NOT To Do

- **DO NOT** try to connect via `psql -h localhost ...` (This will fail or connect to a wrong local instance).
- **DO NOT** try to guess database credentials.
- **DO NOT** run complex raw SQL queries without verifying the schema first.

## ✅ How To Debug Database Issues

Use the `scripts/supabase-utils/debug-db.ts` script to query tables.

### Usage

```bash
bun run scripts/supabase-utils/debug-db.ts <table_name> [filter_json] [limit]
```

### Examples

**1. Inspect the 10 most recent agents:**
```bash
bun run scripts/supabase-utils/debug-db.ts agents
```

**2. Find a specific agent by ID:**
```bash
bun run scripts/supabase-utils/debug-db.ts agents '{"id": "123-abc-456"}'
```

**3. Check `agent_desired_state` for a specific agent:**
```bash
bun run scripts/supabase-utils/debug-db.ts agent_desired_state '{"agent_id": "123-abc-456"}'
```

**4. Check `agent_actual_state` for a specific agent:**
```bash
bun run scripts/supabase-utils/debug-db.ts agent_actual_state '{"agent_id": "123-abc-456"}'
```

## Advanced Usage

For more complex needs (like updates), you can create a temporary script based on `scripts/supabase-utils/debug-db.ts` that initializes the Supabase client:

```typescript
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env from backend
dotenv.config({ path: path.resolve(__dirname, '../packages/backend/.env') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// ... your logic here ...
```
