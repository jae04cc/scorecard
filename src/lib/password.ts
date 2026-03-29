import { pbkdf2, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const pbkdf2Async = promisify(pbkdf2);
const ITERATIONS = 100_000;
const KEYLEN = 64;
const DIGEST = "sha512";

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = await pbkdf2Async(password, salt, ITERATIONS, KEYLEN, DIGEST);
  return `${salt}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const derived = await pbkdf2Async(password, salt, ITERATIONS, KEYLEN, DIGEST);
  const keyBuf = Buffer.from(key, "hex");
  // Constant-time comparison to prevent timing attacks
  if (derived.length !== keyBuf.length) return false;
  return timingSafeEqual(derived, keyBuf);
}
