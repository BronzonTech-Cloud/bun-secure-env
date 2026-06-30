import { describe, it, expect } from "bun:test";
import { resolveProfilePath, readVaultFile } from "../src/profiles";
import { VaultNotFoundError, ProfileNotFoundError, DecryptionError } from "../src/errors";

describe("profiles.ts", () => {
  describe("resolveProfilePath", () => {
    it("resolves standard vault path with profile", () => {
      expect(resolveProfilePath(".env.vault", "production")).toBe(
        ".env.production.vault"
      );
      expect(resolveProfilePath("/path/to/.env.vault", "development")).toBe(
        "/path/to/.env.development.vault"
      );
    });

    it("resolves non-standard vault path with profile", () => {
      expect(resolveProfilePath("my_vault", "staging")).toBe("my_vault.staging");
    });
  });

  describe("readVaultFile", () => {
    it("throws VaultNotFoundError if base vault is missing", async () => {
      await expect(readVaultFile("non-existent-base.vault", false)).rejects.toThrow(
        VaultNotFoundError
      );
    });

    it("throws ProfileNotFoundError if profile vault is missing", async () => {
      await expect(readVaultFile("non-existent-profile.vault", true)).rejects.toThrow(
        ProfileNotFoundError
      );
    });

    it("throws DecryptionError if vault format is invalid", async () => {
      const tempPath = `/tmp/invalid-${Math.random().toString(36).substring(7)}.vault`;
      await Bun.write(tempPath, "BSENV_VERSION=1\nBSENV_ALGO=aes-256-gcm\n");

      await expect(readVaultFile(tempPath, false)).rejects.toThrow(DecryptionError);
    });
  });
});
