---
title: Core Concepts
order: 2
---

# Core Concepts

## The Vault Pipeline

Every call to `createEnv()` runs through a strict, sequential 5-step internal pipeline:

```
VAULT_KEY (env var)
     │
     ▼
1. KeyResolver      — Reads and validates VAULT_KEY from Bun.env
     │
     ▼
2. VaultDecryptor   — AES-256-GCM decrypts .env.vault via crypto.subtle
     │
     ▼
3. EnvParser        — Parses decrypted .env text into Record<string, string>
     │
     ▼
4. ProfileMerger    — Merges base vault with BUN_ENV profile vault (if set)
     │
     ▼
5. SchemaValidator  — Zod safeParse → typed output or SchemaError
```

If any step fails, the pipeline throws a typed error and halts — your application never starts with invalid or missing configuration.

---

## The Vault File Format

Encrypted `.env.vault` files use a simple key-value format that stores all cryptographic components required for AES-256-GCM decryption and authentication:

```ini
BSENV_VERSION=1
BSENV_ALGO=aes-256-gcm
BSENV_IV=<base64-encoded 12-byte IV>
BSENV_TAG=<base64-encoded 16-byte auth tag>
BSENV_CIPHER=<base64-encoded ciphertext>
```

| Field | Description |
|-------|-------------|
| `BSENV_VERSION` | Format version — currently `1` |
| `BSENV_ALGO` | Always `aes-256-gcm` |
| `BSENV_IV` | Unique random 12-byte initialization vector (new per encryption) |
| `BSENV_TAG` | 16-byte GCM authentication tag — detects tampering |
| `BSENV_CIPHER` | The base64-encoded encrypted payload |

---

## The Vault Key

The vault key is a **32-byte cryptographically secure random value**, base64-encoded to a 44-character string. It is the master key for all your encrypted vaults.

Generate one with:

```typescript
import { generateKey } from "bun-secure-env";
const key = generateKey(); // "abc123...==" (44 chars, base64)
```

### Key Management Rules

1. **Never commit the key** — do not write `VAULT_KEY` to any file tracked in source control.
2. **Inject via environment** — set `VAULT_KEY` in your shell, CI/CD secrets, or hosting provider's config.
3. **One key, multiple vaults** — the same key encrypts both `.env.vault` and any profile vault (`.env.production.vault`).

---

## Profile Merging

When `BUN_ENV` is set, `createEnv()` loads a second, profile-specific vault and merges it on top of the base vault:

```
Base keys  (.env.vault)         → { PORT: "8080", API_KEY: "base-key" }
Profile keys (.env.production.vault) → { API_KEY: "prod-key" }
                                        ↓ merge
Final result                    → { PORT: "8080", API_KEY: "prod-key" }
```

Profile vault path resolution uses this pattern:

| Base vault | Profile | Profile vault |
|------------|---------|---------------|
| `.env.vault` | `production` | `.env.production.vault` |
| `/app/.env.vault` | `staging` | `/app/.env.staging.vault` |

> [!NOTE]
> If `BUN_ENV` is set but the profile vault file does not exist, a `ProfileNotFoundError` is thrown.

---

## Schema Validation with Zod

`bun-secure-env` re-exports `z` from Zod so you don't need a separate import:

```typescript
import { createEnv, z } from "bun-secure-env";

const env = await createEnv({
  schema: {
    PORT: z.preprocess((v) => Number(v), z.number().int().positive()),
    DB_URL: z.string().url(),
    FEATURE_FLAG: z.preprocess((v) => v === "true", z.boolean().default(false)),
    OPTIONAL_KEY: z.string().optional(),
  },
});
```

Since all environment variables arrive as strings, use `z.preprocess` to coerce types before validation. If schema validation fails, a `SchemaError` is thrown listing every invalid field.
