import { z } from "./schema";
import type { ZodRawShape } from "./schema";
import { validateKey, generateKey } from "./key";
import { encrypt, decrypt } from "./crypto";
import { parseEnv } from "./parser";
import { resolveProfilePath, readVaultFile } from "./profiles";
import { validateSchema } from "./schema";
import { VaultNotFoundError, VaultKeyError } from "./errors";

export { z };
export type { ZodRawShape };
export { generateKey };
export * from "./errors";

/**
 * Loads, decrypts, merges, and validates environment variables from the vault.
 * Follows a strict internal pipeline:
 * 1. KeyResolver     — read + validate VAULT_KEY from Bun.env
 * 2. VaultDecryptor  — AES-256-GCM decrypt via crypto.subtle
 * 3. EnvParser       — parse decrypted .env text to Record<string,string>
 * 4. ProfileMerger   — merge base vault + BUN_ENV profile vault
 * 5. SchemaValidator — Zod safeParse → typed output or typed error
 *
 * @param options Loader options including vault path, key, and schema raw shape
 * @returns A promise resolving to the validated, typed environment object
 */
export async function createEnv<T extends ZodRawShape>(options: {
  vault?: string;
  key?: string;
  schema: T;
}): Promise<z.infer<z.ZodObject<T>>> {
  const vaultKey = options.key ?? Bun.env.VAULT_KEY;
  if (typeof vaultKey !== "string") {
    throw new VaultKeyError("Vault key is missing or not a string.");
  }

  const keyBytes = validateKey(vaultKey);
  // decrypt-only — do not pass to encrypt(); import a separate key for that
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes as unknown as Uint8Array<ArrayBuffer>,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
  keyBytes.fill(0);

  const vaultPath = options.vault ?? ".env.vault";
  const baseVault = await readVaultFile(vaultPath, false);
  const basePlaintext = await decrypt(baseVault, cryptoKey);
  const baseEnv = parseEnv(basePlaintext);

  let mergedEnv = { ...baseEnv };
  const profile = Bun.env.BUN_ENV;

  if (profile) {
    const profilePath = resolveProfilePath(vaultPath, profile);
    const profileVault = await readVaultFile(profilePath, true);
    const profilePlaintext = await decrypt(profileVault, cryptoKey);
    const profileEnv = parseEnv(profilePlaintext);
    mergedEnv = { ...baseEnv, ...profileEnv };
  }

  return validateSchema(options.schema, mergedEnv);
}

/**
 * Encrypts a plaintext .env file and writes the formatted .env.vault file.
 * Key validation happens before any file I/O.
 *
 * @param options Encryption options including input path, output path, and key
 * @returns A promise that resolves when the vault file has been written
 */
export async function encryptEnv(options: {
  input: string;
  output?: string;
  key: string;
}): Promise<void> {
  const key = options.key;
  const keyBytes = validateKey(key);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes as unknown as Uint8Array<ArrayBuffer>,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );
  keyBytes.fill(0);

  const inputFile = Bun.file(options.input);
  if (!(await inputFile.exists())) {
    throw new VaultNotFoundError(
      `Input .env file not found at: ${options.input}`
    );
  }

  const plaintext = await inputFile.text();
  const vaultData = await encrypt(plaintext, cryptoKey);

  const content = [
    `BSENV_VERSION=${vaultData.version}`,
    `BSENV_ALGO=${vaultData.algo}`,
    `BSENV_IV=${vaultData.iv}`,
    `BSENV_TAG=${vaultData.tag}`,
    `BSENV_CIPHER=${vaultData.cipher}`,
  ].join("\n") + "\n";

  const outputPath = options.output ?? `${options.input}.vault`;
  await Bun.write(outputPath, content);
}
