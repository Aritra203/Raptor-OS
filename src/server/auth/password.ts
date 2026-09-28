import crypto from "crypto";

function scryptAsync(
  password: crypto.BinaryLike,
  salt: crypto.BinaryLike,
  keylen: number,
  options: crypto.ScryptOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey as Buffer);
    });
  });
}

// OWASP Recommended Parameters for Scrypt Password Hashing
const SCRYPT_N = 16384; // CPU/memory cost parameter (2^14)
const SCRYPT_R = 8;     // Block size parameter
const SCRYPT_P = 1;     // Parallelization parameter
const KEY_LENGTH = 64;  // Output key length in bytes
const SALT_LENGTH = 16; // Random salt length in bytes

export interface PasswordHashMetadata {
  algorithm: "scrypt";
  cost: number;
  blockSize: number;
  parallelization: number;
}

/**
 * Hashes a plaintext password using the memory-hard scrypt algorithm with a cryptographically secure salt.
 * Output format: $scrypt$N=16384,r=8,p=1$<saltHex>$<hashHex>
 *
 * @param password Plaintext password to hash
 * @returns Serialized hash string containing algorithm parameters, salt, and derived key
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || typeof password !== "string") {
    throw new Error("Password must be a non-empty string.");
  }

  const salt = crypto.randomBytes(SALT_LENGTH);
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 32 * 1024 * 1024, // 32MB max memory
  })) as Buffer;

  const saltHex = salt.toString("hex");
  const hashHex = derivedKey.toString("hex");

  return `$scrypt$N=${SCRYPT_N},r=${SCRYPT_R},p=${SCRYPT_P}$${saltHex}$${hashHex}`;
}

/**
 * Verifies a plaintext password against a stored scrypt hash using constant-time comparison.
 *
 * @param password Candidate plaintext password
 * @param storedHash Serialized hash from database
 * @returns True if password matches, false otherwise
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!password || !storedHash || typeof password !== "string" || typeof storedHash !== "string") {
    return false;
  }

  try {
    const parts = storedHash.split("$");
    // Format: ["", "scrypt", "N=16384,r=8,p=1", saltHex, hashHex]
    if (parts.length !== 5 || parts[1] !== "scrypt") {
      return false;
    }

    const paramsStr = parts[2];
    const saltHex = parts[3];
    const originalHashHex = parts[4];

    if (!paramsStr || !saltHex || !originalHashHex) {
      return false;
    }

    const params: Record<string, number> = {};
    for (const item of paramsStr.split(",")) {
      const [key, val] = item.split("=");
      if (key && val) {
        params[key] = parseInt(val, 10);
      }
    }

    const N = params.N || SCRYPT_N;
    const r = params.r || SCRYPT_R;
    const p = params.p || SCRYPT_P;

    const salt = Buffer.from(saltHex, "hex");
    const originalHash = Buffer.from(originalHashHex, "hex");

    if (salt.length === 0 || originalHash.length === 0) {
      return false;
    }

    const candidateHash = (await scryptAsync(password, salt, originalHash.length, {
      N,
      r,
      p,
      maxmem: 64 * 1024 * 1024,
    })) as Buffer;

    if (candidateHash.length !== originalHash.length) {
      return false;
    }

    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(candidateHash, originalHash);
  } catch {
    return false;
  }
}
