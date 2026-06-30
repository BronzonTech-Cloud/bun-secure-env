import type { ZodIssue } from "zod";

/**
 * Base class for all bun-secure-env errors.
 */
export class BunSecureEnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when VAULT_KEY is missing, invalid, or fails validation.
 */
export class VaultKeyError extends BunSecureEnvError {
  constructor(message: string) {
    super(message);
  }
}

/**
 * Error thrown when decryption fails (e.g. invalid key, tampered ciphertext, bad auth tag).
 */
export class DecryptionError extends BunSecureEnvError {
  constructor(message: string) {
    super(message);
  }
}

/**
 * Error thrown when schema validation fails.
 */
export class SchemaError extends BunSecureEnvError {
  /**
   * Constructs a SchemaError with detailed formatting of missing/invalid fields.
   * @param issues Array of Zod validation issues
   */
  constructor(public readonly issues: ZodIssue[]) {
    const messages = issues.map((issue) => {
      const path = issue.path.join(".");
      return `Field "${path}": ${issue.message}`;
    });
    super(`Schema validation failed:\n- ${messages.join("\n- ")}`);
  }
}

/**
 * Error thrown when a profile vault file is not found.
 */
export class ProfileNotFoundError extends BunSecureEnvError {
  constructor(message: string) {
    super(message);
  }
}

/**
 * Error thrown when the main vault file is not found.
 */
export class VaultNotFoundError extends BunSecureEnvError {
  constructor(message: string) {
    super(message);
  }
}
