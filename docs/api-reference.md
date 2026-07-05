---
title: API Reference
order: 4
---

# API Reference

## `createEnv<T>(options)`

Loads, decrypts, merges, and validates environment variables from the vault.

```typescript
import { createEnv, z } from "bun-secure-env";

const env = await createEnv({
  schema: {
    PORT: z.preprocess((v) => Number(v), z.number()),
    DB_URL: z.string().url(),
  },
});
```

### Options

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `schema` | `ZodRawShape` | ✅ | — | Zod shape object defining your environment structure |
| `vault` | `string` | ❌ | `".env.vault"` | Path to the base vault file |
| `key` | `string` | ❌ | `Bun.env.VAULT_KEY` | Base64-encoded 32-byte vault key |

### Returns

`Promise<z.infer<z.ZodObject<T>>>` — The fully decrypted, merged, and validated typed environment object.

### Throws

| Error | When |
|-------|------|
| `VaultKeyError` | `VAULT_KEY` is missing, not valid base64, or not 32 bytes when decoded |
| `VaultNotFoundError` | The base vault file does not exist |
| `ProfileNotFoundError` | `BUN_ENV` is set but the corresponding profile vault is missing |
| `DecryptionError` | Decryption fails due to wrong key, corrupted data, or tampered auth tag |
| `SchemaError` | The decrypted configuration fails Zod schema validation |

---

## `encryptEnv(options)`

Encrypts a plaintext `.env` file and writes the formatted `.env.vault` file.

```typescript
import { encryptEnv } from "bun-secure-env";

await encryptEnv({
  input: ".env",
  key: process.env.VAULT_KEY!,
});
```

### Options

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `input` | `string` | ✅ | — | Path to the plaintext `.env` file |
| `key` | `string` | ✅ | — | Base64-encoded 32-byte vault key |
| `output` | `string` | ❌ | `input + ".vault"` | Output path for the vault file |

### Returns

`Promise<void>`

### Throws

| Error | When |
|-------|------|
| `VaultKeyError` | The key is invalid base64 or does not decode to 32 bytes |
| `VaultNotFoundError` | The input file does not exist |

---

## `generateKey()`

Generates a cryptographically secure 32-byte random vault key, base64-encoded.

```typescript
import { generateKey } from "bun-secure-env";

const key = generateKey();
// "vM3K9...==" — 44-character base64 string
```

### Returns

`string` — Base64-encoded 32-byte key (44 characters, padded).

---

## Error Classes

All errors extend `BunSecureEnvError`, allowing selective catching:

```typescript
import {
  BunSecureEnvError,
  VaultKeyError,
  VaultNotFoundError,
  ProfileNotFoundError,
  DecryptionError,
  SchemaError,
} from "bun-secure-env";

try {
  const env = await createEnv({ schema: { PORT: z.string() } });
} catch (error) {
  if (error instanceof SchemaError) {
    console.error("Invalid config fields:", error.issues);
    //   error.issues → ZodIssue[] with path, message, etc.
  } else if (error instanceof VaultKeyError) {
    console.error("Bad vault key:", error.message);
  } else if (error instanceof BunSecureEnvError) {
    console.error("Vault error:", error.message);
  }
}
```

### Error Hierarchy

```
BunSecureEnvError
├── VaultKeyError          — Invalid or missing VAULT_KEY
├── VaultNotFoundError     — Vault file not found
├── ProfileNotFoundError   — BUN_ENV profile vault not found
├── DecryptionError        — AES-GCM decryption failure
└── SchemaError            — Zod validation failure
     └── .issues: ZodIssue[]
```

---

## `z` (Zod re-export)

`bun-secure-env` re-exports the `z` namespace from Zod for convenience:

```typescript
import { z } from "bun-secure-env";
// Equivalent to: import { z } from "zod";
```

No separate `zod` import is needed in your application code.
