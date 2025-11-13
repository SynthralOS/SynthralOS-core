import crypto from 'crypto';

/**
 * Encryption utility for sensitive data at rest
 * Uses AES-256-GCM for authenticated encryption
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const SALT_LENGTH = 64; // 512 bits
const TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits
const ITERATIONS = 100000; // PBKDF2 iterations

/**
 * Get encryption key from environment variable or derive from master key
 */
function getEncryptionKey(): Buffer {
  const masterKey = process.env.ENCRYPTION_MASTER_KEY;
  
  if (!masterKey) {
    throw new Error(
      'ENCRYPTION_MASTER_KEY environment variable is required. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  // If master key is 64 hex characters (32 bytes), use it directly
  if (masterKey.length === 64 && /^[0-9a-f]+$/i.test(masterKey)) {
    return Buffer.from(masterKey, 'hex');
  }

  // Otherwise, derive key using PBKDF2
  const salt = process.env.ENCRYPTION_SALT || 'default-salt-change-in-production';
  return crypto.pbkdf2Sync(masterKey, salt, ITERATIONS, KEY_LENGTH, 'sha512');
}

/**
 * Encrypt sensitive data
 * Returns base64-encoded string: salt:iv:tag:encryptedData
 */
export function encrypt(plaintext: string): string {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const salt = crypto.randomBytes(SALT_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    const tag = cipher.getAuthTag();

    // Combine salt:iv:tag:encryptedData
    const combined = Buffer.concat([
      salt,
      iv,
      tag,
      Buffer.from(encrypted, 'base64'),
    ]);

    return combined.toString('base64');
  } catch (error: any) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

/**
 * Decrypt sensitive data
 * Expects base64-encoded string: salt:iv:tag:encryptedData
 */
export function decrypt(encryptedData: string): string {
  try {
    const key = getEncryptionKey();
    const combined = Buffer.from(encryptedData, 'base64');

    // Extract components
    let offset = 0;
    const salt = combined.slice(offset, offset + SALT_LENGTH);
    offset += SALT_LENGTH;
    const iv = combined.slice(offset, offset + IV_LENGTH);
    offset += IV_LENGTH;
    const tag = combined.slice(offset, offset + TAG_LENGTH);
    offset += TAG_LENGTH;
    const encrypted = combined.slice(offset);

    // If salt was used, derive key (for backward compatibility)
    // Otherwise use direct key
    let decryptionKey = key;
    if (process.env.ENCRYPTION_SALT) {
      decryptionKey = crypto.pbkdf2Sync(
        process.env.ENCRYPTION_MASTER_KEY!,
        salt.toString('utf8'),
        ITERATIONS,
        KEY_LENGTH,
        'sha512'
      );
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, decryptionKey, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error: any) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

/**
 * Encrypt an object (useful for credentials)
 */
export function encryptObject<T extends Record<string, unknown>>(obj: T): string {
  return encrypt(JSON.stringify(obj));
}

/**
 * Decrypt an object (useful for credentials)
 */
export function decryptObject<T extends Record<string, unknown>>(encryptedData: string): T {
  return JSON.parse(decrypt(encryptedData)) as T;
}

