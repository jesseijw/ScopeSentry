import * as crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV for GCM
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function getKey(): Buffer {
  const hexKey = process.env.NODE_ENCRYPTION_KEY;
  if (!hexKey) {
    throw new Error("NODE_ENCRYPTION_KEY environment variable is required");
  }
  const key = Buffer.from(hexKey.trim(), "hex");
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `NODE_ENCRYPTION_KEY must be ${KEY_LENGTH * 2} hex characters (${KEY_LENGTH} bytes)`
    );
  }
  return key;
}

/**
 * Encrypt a string using AES-256-GCM
 * Returns: base64-encoded (iv + authTag + ciphertext)
 */
export function encrypt(plaintext: string): Buffer {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv) as crypto.CipherGCM;

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // Format: IV (12 bytes) + tag (16 bytes) + ciphertext
  return Buffer.concat([iv, tag, encrypted]);
}

/**
 * Decrypt a buffer produced by encrypt()
 */
export function decrypt(encryptedBuffer: Buffer): string {
  const key = getKey();

  const iv = encryptedBuffer.subarray(0, IV_LENGTH);
  const tag = encryptedBuffer.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = encryptedBuffer.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    iv
  ) as crypto.DecipherGCM;
  decipher.setAuthTag(tag);

  return decipher.update(ciphertext) + decipher.final("utf8");
}

/**
 * Encrypt a string and return as Buffer (for storing in Prisma Bytes field)
 */
export function encryptToBytes(plaintext: string): Buffer {
  return encrypt(plaintext);
}

/**
 * Decrypt from Buffer (from Prisma Bytes field) and return string
 */
export function decryptFromBytes(data: Buffer | Uint8Array): string {
  return decrypt(Buffer.from(data));
}
