---
title: Security
order: 3
---

# Security

## AES-256-GCM Encryption

`bun-secure-env` encrypts vault files using **AES-256-GCM** — an authenticated encryption algorithm with associated data (AEAD). This provides two guarantees simultaneously:

- **Confidentiality**: The plaintext `.env` content is unreadable without the correct key.
- **Integrity**: The 16-byte authentication tag cryptographically verifies that neither the ciphertext nor the key has been tampered with. Any modification to the vault file — even a single bit flip — causes decryption to fail with a `DecryptionError`.

### Per-Encryption IVs

Every call to `encryptEnv()` generates a fresh **12-byte random initialization vector (IV)** using `crypto.getRandomValues()`. This means:

- Encrypting the same `.env` file twice produces different ciphertext each time.
- There is no IV reuse, preventing known-plaintext attacks.

---

## In-Memory Key Protection

The vault key is handled with deliberate care to minimize its exposure in process memory:

```typescript
// Inside the library — simplified
const keyBytes = validateKey(base64Key);          // 1. Decode to Uint8Array

const cryptoKey = await crypto.subtle.importKey(  // 2. Import into WebCrypto
  "raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]
);

keyBytes.fill(0);                                  // 3. Zero-fill immediately
```

After step 3, the raw key bytes are overwritten with zeros. Only the opaque `CryptoKey` object (managed internally by the Bun/WebCrypto engine) remains. This prevents the raw key material from persisting in a heap dump or memory inspection.

---

## Key Validation

All vault keys are validated before any cryptographic operation:

- Must be valid base64 (standard or URL-safe, with or without padding)
- Must decode to exactly **32 bytes** (256 bits)

An invalid key throws a `VaultKeyError` immediately, before any file I/O occurs.

---

## Threat Model

| Threat | Mitigation |
|--------|-----------|
| Committed secret in git | `.env` in `.gitignore`; only `.env.vault` is committed |
| Stolen vault file | Useless without `VAULT_KEY` |
| Tampered vault file | GCM auth tag detects tampering → `DecryptionError` |
| Key in memory | Raw bytes zero-filled immediately after WebCrypto import |
| IV reuse | Fresh random IV generated per encryption call |
| Missing/invalid config | Zod schema validation → `SchemaError` at startup |

---

## Recommendations

> [!CAUTION]
> Never commit your `VAULT_KEY` to source control. If a key is ever exposed, generate a new one and re-encrypt all vault files.

- Store `VAULT_KEY` in your hosting provider's secret manager (e.g., Fly.io secrets, Railway variables, GitHub Actions secrets).
- Rotate keys periodically by generating a new key with `generateKey()`, re-encrypting all vaults, and updating the key in all environments before deploying.
- Use different keys per environment (production vs staging) if your threat model requires it.
- Always add `.env` and `.env.*` (excluding `.vault` files) to `.gitignore`.
