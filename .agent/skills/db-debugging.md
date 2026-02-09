---
name: Database Debugging
description: Instructions for debugging and interacting with the clouded Supabase database using the provided script.
---

# Database Debugging Skill

This project uses a **cloud-hosted Supabase database**. You cannot connect to it using local `psql` or `localhost` connections unless you have the specific cloud credentials and are whitelisted.

Instead, use the provided helper script `scripts/debug-db/debug-db.ts` and others support scripts in the same directory to interact with the database safely using the environment configuration.

## ⛔ What NOT To Do

- **DO NOT** try to connect via `psql -h localhost ...` (This will fail or connect to a wrong local instance).
- **DO NOT** try to guess database credentials.
- **DO NOT** run complex raw SQL queries without verifying the schema first.

## ✅ How To Debug Database Issues

Use the `scripts/debug-db.ts` script to query tables.

### Usage

```bash
bun run scripts/debug-db.ts <table_name> [filter_json] [limit]
```

### Examples

**1. Inspect the 10 most recent agents:**
```bash
bun run scripts/debug-db.ts agents
```

**2. Find a specific agent by ID:**
```bash
bun run scripts/debug-db.ts agents '{"id": "123-abc-456"}'
```

**3. Check `agent_desired_state` for a specific agent:**
```bash
bun run scripts/debug-db.ts agent_desired_state '{"agent_id": "123-abc-456"}'
```

**4. Check `agent_actual_state` for a specific agent:**
```bash
bun run scripts/debug-db.ts agent_actual_state '{"agent_id": "123-abc-456"}'
```

## Advanced Usage

For more complex needs (like updates), you can create a temporary script based on `scripts/debug-db.ts` that initializes the Supabase client:

```typescript
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env from backend
dotenv.config({ path: path.resolve(__dirname, '../packages/backend/.env') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// ... your logic here ...
```
