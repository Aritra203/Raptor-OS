import crypto from "crypto";
import { prisma } from "@/lib/db/prisma";

let cachedKeyPair: { publicKey: string; privateKey: string } | null = null;

/**
 * Recursively canonicalizes an object by sorting all keys alphabetically.
 * Guarantees byte-for-byte identical JSON serialization across different environments.
 */
export function canonicalizeJson(data: unknown): string {
  if (data === null || typeof data !== "object") {
    return JSON.stringify(data);
  }

  if (Array.isArray(data)) {
    return `[${data.map((item) => canonicalizeJson(item)).join(",")}]`;
  }

  const entries = Object.entries(data as Record<string, unknown>)
    .filter(([_, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));

  const objectPairs = entries.map(
    ([k, v]) => `${JSON.stringify(k)}:${canonicalizeJson(v)}`
  );

  return `{${objectPairs.join(",")}}`;
}

/**
 * Computes the SHA-256 digest of a string or canonicalized object.
 */
export function computeSha256(data: string | object): string {
  const content = typeof data === "string" ? data : canonicalizeJson(data);
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * Computes an HMAC-SHA256 signature for webhook payloads.
 */
export function computeHmacSha256(payload: string | object, secret: string): string {
  const content = typeof payload === "string" ? payload : canonicalizeJson(payload);
  return crypto.createHmac("sha256", secret).update(content, "utf8").digest("hex");
}

/**
 * Verifies an HMAC-SHA256 signature using timing-safe comparison to prevent timing attacks.
 */
export function verifyHmacSha256(
  payload: string | object,
  signature: string,
  secret: string
): boolean {
  try {
    const expected = computeHmacSha256(payload, secret);
    const expectedBuffer = Buffer.from(expected, "hex");
    const signatureBuffer = Buffer.from(signature, "hex");

    if (expectedBuffer.length !== signatureBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
  } catch {
    return false;
  }
}

/**
 * Initializes or loads the server's Ed25519 signing keypair from system_settings.
 * Self-contained and offline-ready: creates keypair once and persists across restarts.
 */
export async function getOrCreateSigningKeyPair(): Promise<{
  publicKey: string;
  privateKey: string;
}> {
  if (cachedKeyPair) {
    return cachedKeyPair;
  }

  try {
    const publicSetting = await prisma.systemSetting.findUnique({
      where: { key: "crypto.ed25519.public_key" },
    });
    const privateSetting = await prisma.systemSetting.findUnique({
      where: { key: "crypto.ed25519.private_key" },
    });

    if (publicSetting && privateSetting) {
      cachedKeyPair = {
        publicKey: publicSetting.value,
        privateKey: privateSetting.value,
      };
      return cachedKeyPair;
    }

    // Generate new Ed25519 keypair
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519", {
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    await prisma.$transaction([
      prisma.systemSetting.upsert({
        where: { key: "crypto.ed25519.public_key" },
        update: { value: publicKey },
        create: {
          key: "crypto.ed25519.public_key",
          value: publicKey,
          description: "Ed25519 Public Verification Key for Signed Judge Records",
        },
      }),
      prisma.systemSetting.upsert({
        where: { key: "crypto.ed25519.private_key" },
        update: { value: privateKey },
        create: {
          key: "crypto.ed25519.private_key",
          value: privateKey,
          description: "Ed25519 Private Signing Key for Signed Judge Records (Server Confidential)",
        },
      }),
    ]);

    cachedKeyPair = { publicKey, privateKey };
    return cachedKeyPair;
  } catch {
    // Ephemeral fallback (e.g. during certain unit test mocks)
    if (!cachedKeyPair) {
      const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519", {
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
      });
      cachedKeyPair = { publicKey, privateKey };
    }
    return cachedKeyPair;
  }
}

/**
 * Returns the public verification key (PEM format) for external verification.
 */
export async function getPublicVerificationKey(): Promise<string> {
  const { publicKey } = await getOrCreateSigningKeyPair();
  return publicKey;
}

/**
 * Signs canonicalized data using the server's Ed25519 private key.
 */
export async function signCanonicalData(data: unknown): Promise<{
  canonicalData: string;
  recordHash: string;
  signature: string;
  algorithm: string;
}> {
  const canonicalData = canonicalizeJson(data);
  const recordHash = computeSha256(canonicalData);
  const { privateKey } = await getOrCreateSigningKeyPair();

  const signature = crypto
    .sign(null, Buffer.from(recordHash, "utf8"), privateKey)
    .toString("base64");

  return {
    canonicalData,
    recordHash,
    signature,
    algorithm: "Ed25519",
  };
}

/**
 * Verifies a canonicalized record against an Ed25519 signature and public key.
 */
export function verifyCanonicalData(
  canonicalData: unknown,
  signatureBase64: string,
  publicKeyPem: string
): boolean {
  try {
    const canonicalString =
      typeof canonicalData === "string"
        ? canonicalData
        : canonicalizeJson(canonicalData);
    const recordHash = computeSha256(canonicalString);

    return crypto.verify(
      null,
      Buffer.from(recordHash, "utf8"),
      publicKeyPem,
      Buffer.from(signatureBase64, "base64")
    );
  } catch {
    return false;
  }
}

export const verifyEd25519Signature = verifyCanonicalData;
