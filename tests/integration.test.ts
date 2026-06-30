import { describe, it, expect, afterEach } from "bun:test";
import { encryptEnv, createEnv, generateKey, z } from "../src/index";
import {
  VaultNotFoundError,
  VaultKeyError,
  ProfileNotFoundError,
} from "../src/errors";
import { unlink } from "node:fs/promises";

const tempFiles: string[] = [];

/**
 * Tracks a temporary file to ensure it gets cleaned up after each test.
 * @param path The path of the file to track
 * @returns The same file path
 */
function trackFile(path: string): string {
  tempFiles.push(path);
  return path;
}

/**
 * Deletes all tracked temporary files.
 */
async function cleanFiles(): Promise<void> {
  for (const file of tempFiles) {
    try {
      await unlink(file);
    } catch {
      // Ignore if file doesn't exist
    }
  }
  tempFiles.length = 0;
}

const originalVaultKey = Bun.env.VAULT_KEY;
const originalBunEnv = Bun.env.BUN_ENV;

afterEach(async () => {
  // Restore environment variables
  if (originalVaultKey === undefined) {
    delete Bun.env.VAULT_KEY;
  } else {
    Bun.env.VAULT_KEY = originalVaultKey;
  }

  if (originalBunEnv === undefined) {
    delete Bun.env.BUN_ENV;
  } else {
    Bun.env.BUN_ENV = originalBunEnv;
  }

  await cleanFiles();
});

describe("integration.test.ts", () => {
  it("full round trip: write .env -> encryptEnv() -> createEnv() -> validate", async () => {
    const envPath = trackFile(`/tmp/test-base-${Math.random().toString(36).substring(7)}.env`);
    const vaultPath = trackFile(`${envPath}.vault`);
    const key = generateKey();

    // 1. Write plain .env file
    const envContent = `
      PORT=8080
      DB_URL="mongodb://localhost:27017" # database URL
      DEBUG=true
    `;
    await Bun.write(envPath, envContent);

    // 2. Encrypt .env to .env.vault
    await encryptEnv({ input: envPath, output: vaultPath, key });

    // 3. Load and parse using createEnv
    const schema = {
      PORT: z.preprocess((val) => Number(val), z.number()),
      DB_URL: z.string(),
      DEBUG: z.preprocess((val) => val === "true", z.boolean()),
    };

    const config = await createEnv({
      vault: vaultPath,
      key,
      schema,
    });

    expect(config).toEqual({
      PORT: 8080,
      DB_URL: "mongodb://localhost:27017",
      DEBUG: true,
    });
  });

  it("BUN_ENV profile overrides base keys", async () => {
    const baseEnvPath = trackFile(`/tmp/test-profile-${Math.random().toString(36).substring(7)}.env`);
    const baseVaultPath = trackFile(`${baseEnvPath}.vault`);
    const prodEnvPath = trackFile(`/tmp/test-profile-${Math.random().toString(36).substring(7)}.env.production`);
    const prodVaultPath = trackFile(`${baseEnvPath}.production.vault`);

    const key = generateKey();

    // Write base env
    await Bun.write(
      baseEnvPath,
      `
      PORT=8080
      API_KEY="base-key"
      `
    );
    await encryptEnv({ input: baseEnvPath, output: baseVaultPath, key });

    // Write production override
    await Bun.write(
      prodEnvPath,
      `
      API_KEY="prod-key"
      `
    );
    await encryptEnv({ input: prodEnvPath, output: prodVaultPath, key });

    // Set BUN_ENV to trigger profile resolution
    Bun.env.BUN_ENV = "production";

    const schema = {
      PORT: z.preprocess((val) => Number(val), z.number()),
      API_KEY: z.string(),
    };

    const config = await createEnv({
      vault: baseVaultPath,
      key,
      schema,
    });

    expect(config.PORT).toBe(8080);
    expect(config.API_KEY).toBe("prod-key");
  });

  it("missing vault file throws VaultNotFoundError", async () => {
    const key = generateKey();
    const schema = {
      PORT: z.string(),
    };

    await expect(
      createEnv({
        vault: "/tmp/non-existent-vault-file.vault",
        key,
        schema,
      })
    ).rejects.toThrow(VaultNotFoundError);
  });

  it("missing VAULT_KEY throws VaultKeyError", async () => {
    delete Bun.env.VAULT_KEY;
    const schema = {
      PORT: z.string(),
    };

    await expect(
      createEnv({
        vault: "/tmp/some-vault.vault",
        schema,
      })
    ).rejects.toThrow(VaultKeyError);
  });
});
