import { VaultKeyError } from "./errors";

/**
 * Validates the provided vault key.
 * The key must be a base64-encoded string representing exactly 32 bytes (44 characters).
 * @param key The vault key to validate
 * @returns The decoded 32-byte key material as a Uint8Array
 * @throws VaultKeyError if the key is missing or invalid
 */
export function validateKey(key: unknown): Uint8Array {
  if (typeof key !== "string") {
    throw new VaultKeyError("Vault key is missing or not a string.");
  }

  if (key.length < 43 || key.length > 44) {
    throw new VaultKeyError(
      `Vault key must be 43 or 44 characters (received ${key.length}).`
    );
  }

  // Base64 regex validation (accepts standard and URL-safe base64, with or without padding)
  const base64Regex = /^[A-Za-z0-9+/_-]{42,44}={0,2}$/;
  if (!base64Regex.test(key)) {
    throw new VaultKeyError("Vault key contains invalid base64 characters.");
  }

  try {
    const decoded = Buffer.from(key, "base64");
    if (decoded.length !== 32) {
      throw new VaultKeyError(
        `Vault key must decode to exactly 32 bytes (decoded to ${decoded.length} bytes).`
      );
    }
    return new Uint8Array(decoded);
  } catch (err) {
    if (err instanceof VaultKeyError) {
      throw err;
    }
    throw new VaultKeyError("Failed to decode base64 vault key.");
  }
}

/**
 * Generates a cryptographically secure 32-byte key encoded as base64 (44 characters).
 * @returns A 44-character base64 encoded string
 */
export function generateKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64");
}
