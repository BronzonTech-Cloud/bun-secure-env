---
title: Troubleshooting
order: 5
---

# Troubleshooting

This guide addresses common errors and gotchas when working with `bun-secure-env`.

---

## Error: `VaultKeyError`

### Message: `VAULT_KEY is missing` or `invalid key length`

*   **Cause**: The vault key was not found or is invalid.
*   **Solutions**:
    *   Verify that `VAULT_KEY` is exported in the shell environment where you run Bun:
        ```bash
        echo $VAULT_KEY
        ```
    *   If you are passing the key explicitly to `createEnv({ key })`, ensure it is not undefined or empty.
    *   Ensure the key is a valid base64-encoded string (standard or URL-safe, with or without padding, typically 43 or 44 characters long) that decodes to exactly 32 bytes of raw key material.

---

## Error: `VaultNotFoundError`

### Message: `Vault file not found: .env.vault`

*   **Cause**: The loader cannot find the `.env.vault` file.
*   **Solutions**:
    *   Ensure you ran `encryptEnv` to generate the vault file before booting the application.
    *   Check your working directory. If you are starting Bun from a different directory than the project root, specify the absolute path to the vault file:
        ```typescript
        await createEnv({
          vault: "/absolute/path/to/.env.vault",
          schema: { ... }
        });
        ```

---

## Error: `ProfileNotFoundError`

### Message: `Profile vault file not found: .env.production.vault`

*   **Cause**: `BUN_ENV` is set to `production`, but the corresponding `.env.production.vault` file does not exist.
*   **Solutions**:
    *   Create a `.env.production` file and encrypt it:
        ```typescript
        await encryptEnv({ input: ".env.production", key: process.env.VAULT_KEY! });
        ```
    *   If you do not want to use profile merging, unset the `BUN_ENV` environment variable before running your app:
        ```bash
        unset BUN_ENV
        ```

---

## Error: `DecryptionError`

### Message: `Decryption failed`

*   **Cause**: The ciphertext could not be decrypted. This happens if the key is wrong, or if the vault file has been tampered with or corrupted.
*   **Solutions**:
    *   Double check that the `VAULT_KEY` matches the key used to encrypt the files.
    *   If you rotated keys, ensure you re-encrypted all files (both base and profiles) with the new key.
    *   Re-generate the vault file from your plaintext env to ensure it isn't corrupted:
        ```typescript
        await encryptEnv({ input: ".env", key: process.env.VAULT_KEY! });
        ```

---

## Error: `SchemaError`

### Message: `Environment validation failed`

*   **Cause**: One or more keys decrypted from the vault failed to satisfy your Zod schema.
*   **Solutions**:
    *   Remember that decrypted variables always start as strings. If you validate integers or booleans, you must coerce them first. Use `z.preprocess` or `z.coerce`:
        ```typescript
        // Preprocess string to number
        PORT: z.preprocess((val) => Number(val), z.number())
        
        // Coerce string to boolean
        DEBUG: z.preprocess((val) => val === "true", z.boolean())
        ```
    *   Inspect `error.issues` for a detailed payload containing the specific path, code, and validation issue details.

---

## Gotchas

### Variables with missing "=" are ignored
If your `.env` contains invalid syntax (e.g. comments without `#` or stray text lines without a `=` delimiter), the parser will silently ignore the line. Always format variables as `KEY=VALUE`.

### Committing plaintext env files
Make sure your `.gitignore` explicitly excludes `.env` and `.env.*` while whitelisting `.env.vault` and `.env.*.vault`:
```
.env
.env.*
!.env.vault
!.env.*.vault
```
