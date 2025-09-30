// utils/keys.ts
import crypto from "crypto";

const KEY_BYTES = 48; // 48 bytes -> 96 hex chars (very strong)
export function generateRawApiKey(): string {
  return crypto.randomBytes(KEY_BYTES).toString("hex");
}

// HMAC with server secret (store this secret in env, rotate when required)
export function hashApiKey(rawKey: string, serverSecret: string): string {
  return crypto.createHmac("sha256", serverSecret).update(rawKey).digest("hex");
}

// Constant-time compare to avoid timing attacks
export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
