import { describe, it, expect } from "bun:test";
import { encrypt, decrypt } from "../src/crypto";
import { generateKey, validateKey } from "../src/key";
import { DecryptionError, VaultKeyError } from "../src/errors";

describe("crypto.ts", () => {
  it("encrypt then decrypt returns original plaintext", async () => {
    const key = generateKey();
    const plaintext = "HELLO_WORLD=true\nSECRET_KEY=12345";
    const vault = await encrypt(plaintext, key);

    expect(vault.version).toBe("1");
    expect(vault.algo).toBe("aes-256-gcm");

    const decrypted = await decrypt(vault, key);
    expect(decrypted).toBe(plaintext);
  });

  it("wrong key throws DecryptionError", async () => {
    const key1 = generateKey();
    const key2 = generateKey();
    const plaintext = "SECRET=my-secret";
    const vault = await encrypt(plaintext, key1);

    expect(decrypt(vault, key2)).rejects.toThrow(DecryptionError);
  });

  it("tampered ciphertext throws DecryptionError", async () => {
    const key = generateKey();
    const plaintext = "SECRET=my-secret";
    const vault = await encrypt(plaintext, key);

    // Modify a character in the base64 ciphertext to tamper with it
    const cipherBytes = Buffer.from(vault.cipher, "base64");
    cipherBytes[0] = (cipherBytes[0] ?? 0) ^ 1; // flip a bit
    const tamperedVault = {
      ...vault,
      cipher: cipherBytes.toString("base64"),
    };

    expect(decrypt(tamperedVault, key)).rejects.toThrow(DecryptionError);
  });

  it("tampered auth tag throws DecryptionError", async () => {
    const key = generateKey();
    const plaintext = "SECRET=my-secret";
    const vault = await encrypt(plaintext, key);

    // Modify a character in the base64 tag
    const tagBytes = Buffer.from(vault.tag, "base64");
    tagBytes[0] = (tagBytes[0] ?? 0) ^ 1; // flip a bit
    const tamperedVault = {
      ...vault,
      tag: tagBytes.toString("base64"),
    };

    expect(decrypt(tamperedVault, key)).rejects.toThrow(DecryptionError);
  });

  it("IV is unique per encryption call", async () => {
    const key = generateKey();
    const plaintext = "SAME_PLAINTEXT";
    const vault1 = await encrypt(plaintext, key);
    const vault2 = await encrypt(plaintext, key);

    expect(vault1.iv).not.toBe(vault2.iv);
  });

  describe("validateKey", () => {
    it("accepts standard base64 key (44 chars, padded)", () => {
      const key = generateKey();
      expect(() => validateKey(key)).not.toThrow();
      const bytes = validateKey(key);
      expect(bytes.length).toBe(32);
    });

    it("accepts URL-safe base64 key", () => {
      const standardKey = generateKey();
      const urlSafeKey = standardKey.replace(/\+/g, "-").replace(/\//g, "_");
      expect(() => validateKey(urlSafeKey)).not.toThrow();
      const bytes = validateKey(urlSafeKey);
      expect(bytes.length).toBe(32);
    });

    it("accepts unpadded base64 key (43 chars)", () => {
      const key = generateKey().replace(/=/g, "");
      expect(key.length).toBe(43);
      expect(() => validateKey(key)).not.toThrow();
      const bytes = validateKey(key);
      expect(bytes.length).toBe(32);
    });

    it("rejects invalid length", () => {
      const shortKey = "too-short";
      expect(() => validateKey(shortKey)).toThrow(VaultKeyError);
    });

    it("rejects invalid characters", () => {
      const invalidCharKey = "abcDEF1234567890abcDEF1234567890abcDEF12!@==";
      expect(() => validateKey(invalidCharKey)).toThrow(VaultKeyError);
    });
  });
});
