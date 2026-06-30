# bun-secure-env

[![npm-version](https://img.shields.io/npm/v/bun-secure-env)](https://www.npmjs.com/package/bun-secure-env)
[![bun-version](https://img.shields.io/badge/bun-%3E%3D1.1.0-orange)](https://bun.sh)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![docs](https://img.shields.io/badge/docs-online-green)](https://bronzontech-cloud.github.io/bun-secure-env)

Encrypted `.env` loader with AES-256-GCM, Zod schema validation, and Bun-native crypto.

Written in idiomatic, strict-mode TypeScript with no external runtime dependencies other than Zod, and no Node.js compatibility layer requirements.

---

## Features

- **Zero Node.js Shims**: Uses Bun's native WebCrypto (`crypto.subtle`) and Bun-native file system APIs.
- **AES-256-GCM Security**: Whole-file encryption with unique 12-byte initialization vectors (IV) per encryption call, and explicit 16-byte authentication tag verification.
- **Profile Merging**: Supports environment overrides via `BUN_ENV` (e.g. `.env.production.vault` overrides `.env.vault`).
- **Strict Validation**: Bundled with Zod for fail-fast validation. Invalid environment variables throw detailed, formatted error messages listing every faulty field.
- **Zero-Footprint Key Memory**: Explicitly zeroes out decoded vault key material in memory immediately after usage.
- **Fully Typed**: Infers fully typed environment configurations directly from your Zod schema shape.

---

## Installation

```bash
bun add bun-secure-env
```

---

## Quickstart

### 1. Generate a Vault Key
Generate a 32-byte cryptographically secure base64-encoded key:

```typescript
import { generateKey } from "bun-secure-env";

const key = generateKey();
console.log(key); // A 44-character base64 string
```

Save this key securely. Set it in your environment as `VAULT_KEY` (e.g. `export VAULT_KEY="..."` or in your hosting provider's configuration page).

### 2. Encrypt Your `.env` File
Create a plaintext `.env` file:

```env
PORT=8080
DB_URL="mongodb://localhost:27017" # Production Database
DEBUG=false
```

Encrypt it using the setup script:

```typescript
import { encryptEnv } from "bun-secure-env";

await encryptEnv({
  input: ".env",
  key: process.env.VAULT_KEY!,
});
```

This creates `.env.vault` in the same directory containing version metadata and base64-encoded ciphertext. You can safely commit `.env.vault` to your git repository. **Never commit the raw `.env` file or your `VAULT_KEY`**.

### 3. Load & Validate at Startup
Load your environment at your application entry point:

```typescript
import { createEnv, z } from "bun-secure-env";

const env = await createEnv({
  schema: {
    PORT: z.preprocess((val) => Number(val), z.number().int()),
    DB_URL: z.string().url(),
    DEBUG: z.preprocess((val) => val === "true", z.boolean().default(false)),
  },
});

console.log(env.PORT);    // Number: 8080
console.log(env.DB_URL);  // String: mongodb://localhost:27017
console.log(env.DEBUG);   // Boolean: false
```

---

## Environment Profiles

If you have different configuration values for different environments, you can create profile-specific vaults.

1. Create a profile-specific env file, e.g. `.env.production`.
2. Encrypt it using `encryptEnv`:
   ```typescript
   await encryptEnv({
     input: ".env.production",
     key: process.env.VAULT_KEY!,
   });
   ```
   This generates `.env.production.vault`.
3. Set your runtime profile in the shell:
   ```bash
   export BUN_ENV=production
   ```
4. When `createEnv()` is called, it will decrypt and parse the base `.env.vault`, decrypt and parse `.env.production.vault`, merge the production keys over the base keys, and validate the merged result.

---

## API Reference

### `createEnv<T extends ZodRawShape>(options)`

Loads and decrypts your vault configurations, merges profiles, and validates schemas.

- **Options**:
  - `vault` (optional): Path to the base vault file. Defaults to `".env.vault"`.
  - `key` (optional): The base64 vault key. Defaults to `Bun.env.VAULT_KEY`.
  - `schema`: A Zod raw shape definition (e.g. `{ PORT: z.string() }`).
- **Returns**: `Promise<z.infer<z.ZodObject<T>>>` - The decrypted, merged, and validated environment configuration.
- **Throws**:
  - `VaultKeyError`: If `VAULT_KEY` is missing or invalid base64.
  - `VaultNotFoundError`: If the base vault file does not exist.
  - `ProfileNotFoundError`: If `BUN_ENV` is set but the corresponding profile vault file does not exist.
  - `DecryptionError`: If decryption fails (corrupted data, bad key, or tampered auth tag).
  - `SchemaError`: If the decrypted configuration fails to satisfy the Zod schema.

### `encryptEnv(options)`

Encrypts a plaintext `.env` file into a secure, versioned `.env.vault` format.

- **Options**:
  - `input`: Path to the plaintext `.env` file.
  - `output` (optional): Output file path. Defaults to `input + ".vault"`.
  - `key`: The base64 vault key.
- **Returns**: `Promise<void>`
- **Throws**:
  - `VaultKeyError`: If the key is invalid base64 or not 32 bytes when decoded.
  - `VaultNotFoundError`: If the input file does not exist.

### `generateKey()`

Helper function to generate a 32-byte cryptographically secure random key.

- **Returns**: `string` - Base64 encoded key (exactly 44 characters).

---

## Error Handling

All errors thrown by the library extend `BunSecureEnvError`. This allows you to catch errors specific to your environment setup at startup:

```typescript
import { BunSecureEnvError, SchemaError } from "bun-secure-env";

try {
  const env = await createEnv({ schema: { PORT: z.string() } });
} catch (error) {
  if (error instanceof SchemaError) {
    console.error("Missing/invalid variables:", error.message);
    console.error(error.issues); // Raw Zod issues
  } else if (error instanceof BunSecureEnvError) {
    console.error("Secure env error:", error.message);
  }
}
```

---

## Vault File Format

The `.env.vault` file uses a simple key-value format containing the cryptographic components necessary for AES-256-GCM verification and decryption:

```ini
BSENV_VERSION=1
BSENV_ALGO=aes-256-gcm
BSENV_IV=<base64-encoded-12-byte-iv>
BSENV_TAG=<base64-encoded-16-byte-auth-tag>
BSENV_CIPHER=<base64-encoded-ciphertext>
```

---

## Vault Key Management Guide

The vault key is the master key to your encrypted environment variables. Maintain key security with the following guidelines:

1. **Never Commit Keys**: Do not write the `VAULT_KEY` to any file checked into source control.
2. **Environment Variable Injection**: Set `VAULT_KEY` as an environment variable in your production hosting, CI/CD systems, or local developer shell.
3. **Key Leak Mitigation**: The library decodes the vault key to a `Uint8Array` in memory, imports it into WebCrypto, and immediately fills the byte array with zeroes (`keyBytes.fill(0)`) to ensure the raw key material is destroyed from memory.
4. **Different Keys per Profile**: You can use the same key or different keys for your overrides. If using different keys, make sure to set the correct key in your runtime container or system prior to execution.

---

## Known Behaviors & Bundling Trade-offs

- **Zod Bundling (v0.1)**: Currently, Zod is bundled directly into the compiled output. While this provides a zero-setup runtime, it may result in Zod being bundled twice if your application also depends on it. We plan to move Zod to a peer dependency in `v0.2`.
- **Key-Value Parsing**: Any line in a `.env` file that does not contain a `=` character is silently ignored. Ensure all your environment variables are correctly formatted as `KEY=VALUE`.

---

## License

MIT

