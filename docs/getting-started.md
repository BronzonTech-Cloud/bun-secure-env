---
title: Getting Started
order: 1
---

# Getting Started

## Installation

```bash
bun add bun-secure-env
```

`bun-secure-env` requires **Bun >= 1.1.0**. It uses Bun's native WebCrypto (`crypto.subtle`) and file system APIs — no Node.js shims required.

---

## Quickstart

### 1. Generate a Vault Key

```typescript
import { generateKey } from "bun-secure-env";

const key = generateKey();
console.log(key); // 44-character base64 string
```

Save this key securely. Set it in your environment as `VAULT_KEY`:

```bash
export VAULT_KEY="your-44-char-base64-key"
```

### 2. Encrypt Your `.env` File

Create a plaintext `.env` file:

```env
PORT=8080
DB_URL="mongodb://localhost:27017"
DEBUG=false
```

Then encrypt it:

```typescript
import { encryptEnv } from "bun-secure-env";

await encryptEnv({
  input: ".env",
  key: process.env.VAULT_KEY!,
});
// Creates .env.vault in the same directory
```

Commit `.env.vault` to git. **Never commit `.env` or `VAULT_KEY`.**

### 3. Load & Validate at Startup

```typescript
import { createEnv, z } from "bun-secure-env";

const env = await createEnv({
  schema: {
    PORT: z.preprocess((val) => Number(val), z.number().int()),
    DB_URL: z.string().url(),
    DEBUG: z.preprocess((val) => val === "true", z.boolean().default(false)),
  },
});

console.log(env.PORT);   // 8080
console.log(env.DB_URL); // "mongodb://localhost:27017"
console.log(env.DEBUG);  // false
```

---

## Environment Profiles

Use `BUN_ENV` to load environment-specific overrides:

1. Create `.env.production` and encrypt it:
   ```typescript
   await encryptEnv({ input: ".env.production", key: process.env.VAULT_KEY! });
   // Creates .env.production.vault
   ```

2. Set `BUN_ENV` at runtime:
   ```bash
   export BUN_ENV=production
   ```

3. `createEnv()` will automatically merge `.env.production.vault` on top of `.env.vault` and validate the merged result.
