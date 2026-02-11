# Encryption Configuration

## Environment Variables

### ENCRYPTION_KEY

**Required for production**. A 32-character secret key used for AES-256-CBC encryption of sensitive configuration data.

```bash
# Generate a secure key
ENCRYPTION_KEY=$(openssl rand -base64 32)
```

**Important**: Both `worker` and `backend` packages must use the **same** `ENCRYPTION_KEY` value.

### ENCRYPT_MODE

Controls which fields are encrypted in agent configurations. Defaults to `sensitive`.

#### Options

| Mode | Description | Use Case |
|------|-------------|----------|
| `sensitive` | Only encrypt keys matching sensitive patterns | **Production (default)** |
| `all` | Encrypt all string values in configs | Testing encryption coverage |
| `none` | No encryption (plain text) | **Local debugging only** |

#### Sensitive Key Patterns

When `ENCRYPT_MODE=sensitive`, the following key patterns are encrypted:

- Ends with: `APIKEY`, `KEY`, `API`, `_KEY`, `_TOKEN`
- Equals: `TOKEN`
- Contains: `SECRET`, `PASSWORD`

Examples:
- ✅ `apiKey`, `api_key`, `API_KEY`, `openaiApiKey`
- ✅ `token`, `auth_token`, `gateway_token`
- ✅ `password`, `secret`, `client_secret`
- ❌ `model`, `name`, `workspace` (not encrypted)

## Setup

### Idempotent Encryption (Frontend Integration)
The [encryptConfig](file:///home/adam/Projects/blankspace/blueprints/packages/shared/src/crypto.ts#109-146) function is **idempotent**. It checks if a value is already in the valid ciphertext format (`IV:Ciphertext`) before encrypting.
- **Frontend Flow**: You can safely send encrypted configurations to the frontend.
- **No Double-Encryption**: If the frontend sends back the same encrypted string (e.g., user didn't change the API key), the backend detects it and keeps it as-is.
- **Updates**: If the frontend sends a new plain-text value, the backend detects it's not encrypted and encrypts it.

### Worker Package

```bash
# packages/worker/.env
ENCRYPTION_KEY=your-32-char-secret-key-here-1234
ENCRYPT_MODE=sensitive  # or 'all' or 'none'
```

### Backend Package

```bash
# packages/backend/.env
ENCRYPTION_KEY=your-32-char-secret-key-here-1234  # MUST match worker
ENCRYPT_MODE=sensitive  # or 'all' or 'none'
```

## Usage Examples

### Debugging with Plain Text

For local development when you need to inspect configs in the database:

```bash
# .env
ENCRYPT_MODE=none
```

⚠️ **Never use `none` in production!**

### Testing Encryption Coverage

To verify all strings are being encrypted:

```bash
# .env
ENCRYPT_MODE=all
```

### Production (Default)

```bash
# .env
ENCRYPT_MODE=sensitive  # or omit entirely
ENCRYPTION_KEY=<your-production-key>
```

## How It Works

1. **Backend writes**: Configs are encrypted before being written to `agent_desired_state.config`
2. **Database storage**: Encrypted strings stored as `{iv_hex}:{encrypted_hex}`
3. **Worker reads**: Configs are decrypted before being used by agents
4. **Worker writes**: Re-encrypted when sanitized configs are saved back

## Migration

Existing plain-text configs in the database will be automatically encrypted the next time they are updated through the backend API.

To manually encrypt existing data, update each agent's config through the API:

```bash
# This will trigger encryption
PATCH /agents/:agentId/config
```




---


# Crypto Library Review

## Current Implementation

### How It Works

The [crypto.ts](file:///home/adam/Projects/blankspace/blueprints/packages/worker/src/lib/crypto.ts) library provides AES-256-CBC encryption for sensitive configuration data:

#### Core Encryption Functions

1. **[encrypt(text: string)](file:///home/adam/Projects/blankspace/blueprints/packages/worker/src/lib/crypto.ts#7-14)** - Lines 7-13
   - Generates a random 16-byte IV (initialization vector)
   - Uses AES-256-CBC cipher with the encryption key
   - Returns format: `{iv_hex}:{encrypted_hex}`

2. **[decrypt(text: string)](file:///home/adam/Projects/blankspace/blueprints/packages/worker/src/lib/crypto.ts#15-28)** - Lines 15-27
   - Splits the encrypted string by `:` to extract IV and ciphertext
   - Decrypts using the same key
   - **Gracefully fails**: Returns original text if decryption fails (for backward compatibility)

3. **[encryptConfig(config: any)](file:///home/adam/Projects/blankspace/blueprints/packages/worker/src/lib/crypto.ts#64-85)** - Lines 64-84
   - Recursively walks through config objects/arrays
   - **Selective encryption**: Only encrypts string values where the key name matches patterns:
     - Ends with: `_KEY`, `_TOKEN`, `APIKEY`, `KEY`, `API`
     - Equals: `TOKEN`
     - Contains: `SECRET`, `PASSWORD`

4. **[decryptConfig(config: any)](file:///home/adam/Projects/blankspace/blueprints/packages/worker/src/lib/crypto.ts#29-63)** - Lines 29-62
   - Mirrors [encryptConfig](file:///home/adam/Projects/blankspace/blueprints/packages/worker/src/lib/crypto.ts#64-85) logic
   - Handles JSON-stringified configs
   - Uses the **same key pattern matching** as encryption

#### Key Management

- **Key source**: `process.env.ENCRYPTION_KEY` (line 3)
- **Fallback**: `'default-key-32-chars-long-12345'` for development
- **Key buffer**: Padded/truncated to exactly 32 bytes (line 4)

---

## Current Usage

### Worker Package ✅

The crypto library is **actively used** in the worker:

1. **[openclaw.ts](file:///home/adam/Projects/blankspace/blueprints/packages/worker/src/handlers/openclaw.ts)** (lines 69, 75)
   - Decrypts config before writing to container filesystem
   - Re-encrypts sanitized config back to database

2. **[eliza.ts](file:///home/adam/Projects/blankspace/blueprints/packages/worker/src/handlers/eliza.ts)** (lines 39, 96)
   - Decrypts config before use

3. **[message-bus.ts](file:///home/adam/Projects/blankspace/blueprints/packages/worker/src/message-bus.ts)** (line 97)
   - Decrypts config when syncing agent state

### Backend Package ❌

**No crypto library usage found** in the backend. The backend only uses Node's `crypto` module for:
- SHA-256 hashing IP addresses in [support.ts](file:///home/adam/Projects/blankspace/blueprints/packages/backend/src/routes/support.ts#L11)

---

## Security Concerns

### 🚨 Critical Issues

1. **API Keys Visible in Database**
   - You mentioned: *"i can see all api keys raw text on the database"*
   - **Root cause**: The backend doesn't encrypt configs when writing to the database
   - **Impact**: Anyone with database access can read all API keys

2. **Backend Missing Encryption**
   - When the backend creates/updates agent configs, it writes them **unencrypted**
   - The worker encrypts on read/write, but if the backend bypasses this, data remains plain

3. **Inconsistent Key Patterns**
   - [encryptConfig](file:///home/adam/Projects/blankspace/blueprints/packages/worker/src/lib/crypto.ts#64-85) (line 70-74): Checks `_KEY`, `_TOKEN`, `TOKEN`, `SECRET`, `PASSWORD`
   - [decryptConfig](file:///home/adam/Projects/blankspace/blueprints/packages/worker/src/lib/crypto.ts#29-63) (line 45-52): **Also checks** `APIKEY`, `KEY`, `API`
   - **Your recent addition**: `apikey` and `api` fields
   - **Problem**: Asymmetry could cause decryption to fail if encryption doesn't match

---

## Recommendations

### 1. Fix Key Pattern Asymmetry

Update [encryptConfig](file:///home/adam/Projects/blankspace/blueprints/packages/worker/src/lib/crypto.ts#64-85) to match [decryptConfig](file:///home/adam/Projects/blankspace/blueprints/packages/worker/src/lib/crypto.ts#29-63):

```diff
  if (typeof value === 'string' && (
+     key.toUpperCase().endsWith('APIKEY') ||
+     key.toUpperCase().endsWith('KEY') ||
+     key.toUpperCase().endsWith('API') ||
      key.toUpperCase().endsWith('_KEY') ||
      key.toUpperCase().endsWith('_TOKEN') ||
      key.toUpperCase() === 'TOKEN' ||
      key.toUpperCase().includes('SECRET') ||
      key.toUpperCase().includes('PASSWORD')
  )) {
```

### 2. Add Crypto to Backend

Create a shared crypto utility or copy it to the backend package:

**Option A**: Move to `@eliza-manager/shared`
```bash
# Move crypto.ts to shared package
mv packages/worker/src/lib/crypto.ts packages/shared/src/crypto.ts

# Update imports in worker
# packages/worker/src/handlers/*.ts
- import { cryptoUtils } from '../lib/crypto';
+ import { cryptoUtils } from '@eliza-manager/shared';
```

**Option B**: Copy to backend
```bash
cp packages/worker/src/lib/crypto.ts packages/backend/src/lib/crypto.ts
```

Then use it in backend routes when writing configs to the database.

### 3. Implement Encryption Flag (Your Suggestion)

Add an environment variable to control encryption scope:

```typescript
// In crypto.ts
const ENCRYPT_MODE = process.env.ENCRYPT_MODE || 'sensitive'; // 'sensitive' | 'all' | 'none'

export const cryptoUtils = {
    encryptConfig(config: any): any {
        if (ENCRYPT_MODE === 'none') return config;
        
        const encrypted = Array.isArray(config) ? [] : {};
        for (const [key, value] of Object.entries(config)) {
            const shouldEncrypt = ENCRYPT_MODE === 'all' 
                ? typeof value === 'string'
                : this.isSensitiveKey(key);
            
            if (shouldEncrypt && typeof value === 'string') {
                (encrypted as any)[key] = this.encrypt(value);
            } else if (typeof value === 'object' && value !== null) {
                (encrypted as any)[key] = this.encryptConfig(value);
            } else {
                (encrypted as any)[key] = value;
            }
        }
        return encrypted;
    },
    
    isSensitiveKey(key: string): boolean {
        const upper = key.toUpperCase();
        return (
            upper.endsWith('APIKEY') ||
            upper.endsWith('KEY') ||
            upper.endsWith('API') ||
            upper.endsWith('_KEY') ||
            upper.endsWith('_TOKEN') ||
            upper === 'TOKEN' ||
            upper.includes('SECRET') ||
            upper.includes('PASSWORD')
        );
    }
};
```

**Environment configuration**:
```bash
# .env (default - only encrypt sensitive fields)
ENCRYPT_MODE=sensitive

# For debugging (encrypt everything)
ENCRYPT_MODE=all

# For local dev (no encryption)
ENCRYPT_MODE=none
```

### 4. Database Migration (Optional)

If you want to encrypt existing data:

```sql
-- Create a migration to encrypt existing configs
-- This would need to be done via a script that:
-- 1. Reads all agent_desired_state.config values
-- 2. Encrypts sensitive fields
-- 3. Updates the database
```

---

## Summary

| Aspect | Current State | Recommendation |
|--------|---------------|----------------|
| **Worker encryption** | ✅ Working | Keep as-is |
| **Backend encryption** | ❌ Missing | Add crypto library |
| **Key patterns** | ⚠️ Asymmetric | Sync encrypt/decrypt patterns |
| **Encryption scope** | 🔧 Hardcoded | Add `ENCRYPT_MODE` flag |
| **Database visibility** | 🚨 Plain text | Encrypt at write time |

### Immediate Actions

1. **Fix the asymmetry** in [encryptConfig](file:///home/adam/Projects/blankspace/blueprints/packages/worker/src/lib/crypto.ts#64-85) (lines 69-75)
2. **Add crypto to backend** to encrypt configs on write
3. **Add `ENCRYPT_MODE` flag** for debugging flexibility
4. **Default to `sensitive`** mode (current behavior)

This will ensure API keys are encrypted in the database while maintaining debugging capability when needed.
