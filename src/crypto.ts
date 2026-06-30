import { validateKey } from "./key";
import { DecryptionError } from "./errors";

export interface VaultData {
  version: string;
  algo: string;
  iv: string;
  tag: string;
  cipher: string;
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * The authentication tag is extracted from the end of the ciphertext.
 * @param plaintext The plaintext string to encrypt
 * @param key The base64-encoded 32-byte key or a pre-imported CryptoKey
 * @returns A promise resolving to the VaultData containing base64 fields
 */
export async function encrypt(
  plaintext: string,
  key: string | CryptoKey
): Promise<VaultData> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  let cryptoKey: CryptoKey;

  if (typeof key === "string") {
    const keyBytes = validateKey(key);
    cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyBytes as unknown as Uint8Array<ArrayBuffer>,
      { name: "AES-GCM" },
      false,
      ["encrypt"]
    );
    keyBytes.fill(0);
  } else {
    cryptoKey = key;
  }

  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    cryptoKey,
    encoded
  );

  const encryptedBytes = new Uint8Array(encrypted);
  const cipherBytes = encryptedBytes.subarray(0, encryptedBytes.length - 16);
  const tagBytes = encryptedBytes.subarray(encryptedBytes.length - 16);

  return {
    version: "1",
    algo: "aes-256-gcm",
    iv: Buffer.from(iv).toString("base64"),
    tag: Buffer.from(tagBytes).toString("base64"),
    cipher: Buffer.from(cipherBytes).toString("base64"),
  };
}

/**
 * Decrypts a vault data structure using AES-256-GCM.
 * Recombines the ciphertext and the authentication tag for WebCrypto.
 * @param vault The VaultData object containing base64 fields
 * @param key The base64-encoded 32-byte key or a pre-imported CryptoKey
 * @returns A promise resolving to the decrypted plaintext string
 * @throws DecryptionError if decryption or signature validation fails
 */
export async function decrypt(
  vault: VaultData,
  key: string | CryptoKey
): Promise<string> {
  if (vault.version !== "1" || vault.algo !== "aes-256-gcm") {
    throw new DecryptionError(
      `Unsupported vault version or algorithm: ${vault.version}/${vault.algo}`
    );
  }

  let cryptoKey: CryptoKey;
  if (typeof key === "string") {
    const keyBytes = validateKey(key);
    cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyBytes as unknown as Uint8Array<ArrayBuffer>,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );
    keyBytes.fill(0);
  } else {
    cryptoKey = key;
  }

  const cipherBytes = Buffer.from(vault.cipher, "base64");
  const tagBytes = Buffer.from(vault.tag, "base64");
  const ivBytes = Buffer.from(vault.iv, "base64");

  const encryptedBytes = new Uint8Array(cipherBytes.length + tagBytes.length);
  encryptedBytes.set(cipherBytes, 0);
  encryptedBytes.set(tagBytes, cipherBytes.length);

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: ivBytes, tagLength: 128 },
      cryptoKey,
      encryptedBytes
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    throw new DecryptionError("Decryption failed. The key may be invalid or the ciphertext/tag has been tampered with.");
  }
}
