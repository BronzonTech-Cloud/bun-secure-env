import { parseEnv } from "./parser";
import {
  VaultNotFoundError,
  ProfileNotFoundError,
  DecryptionError,
} from "./errors";
import type { VaultData } from "./crypto";

/**
 * Resolves the profile vault path based on the base vault path and the profile name.
 * If the vault path ends with ".vault", inserts the profile name before it.
 * Otherwise, appends the profile name.
 * @param vaultPath The base vault path
 * @param profile The BUN_ENV profile name
 * @returns The resolved profile vault path
 */
export function resolveProfilePath(vaultPath: string, profile: string): string {
  if (vaultPath.endsWith(".vault")) {
    return vaultPath.slice(0, -6) + `.${profile}.vault`;
  }
  return `${vaultPath}.${profile}`;
}

/**
 * Reads and parses a vault file into VaultData.
 * @param path Path to the vault file
 * @param isProfile Whether this is a profile vault (affects thrown error type)
 * @returns A promise resolving to the parsed VaultData
 * @throws VaultNotFoundError if base file not found
 * @throws ProfileNotFoundError if profile file not found
 * @throws DecryptionError if format is invalid
 */
export async function readVaultFile(
  path: string,
  isProfile: boolean
): Promise<VaultData> {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    const msg = `${isProfile ? "Profile vault" : "Vault"} file not found at: ${path}`;
    throw isProfile
      ? new ProfileNotFoundError(msg)
      : new VaultNotFoundError(msg);
  }

  const text = await file.text();
  const parsed = parseEnv(text);

  const version = parsed["BSENV_VERSION"];
  const algo = parsed["BSENV_ALGO"];
  const iv = parsed["BSENV_IV"];
  const tag = parsed["BSENV_TAG"];
  const cipher = parsed["BSENV_CIPHER"];

  if (!version || !algo || !iv || !tag || !cipher) {
    throw new DecryptionError(
      `Invalid vault format at ${path}. Missing required BSENV_* keys.`
    );
  }

  return { version, algo, iv, tag, cipher };
}
