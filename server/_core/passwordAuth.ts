import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { parse } from "cookie";
import type { Request, Response } from "express";
import { and, eq, gt, lt } from "drizzle-orm";
import { authRateLimits, authSessions, getDb, getTursoClient, users } from "../db";

export const SESSION_COOKIE = "boostme_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
export const AUTH_RATE_WINDOW_MS = 15 * 60 * 1000;
export const MAX_AUTH_ATTEMPTS_PER_WINDOW = 10;
const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_BYTES = 64;
type ScryptOptions = { N: number; r: number; p: number; maxmem: number };

function deriveKey(password: string, salt: Buffer, keyLength: number, options: ScryptOptions) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, derived) => error ? reject(error) : resolve(derived as Buffer));
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt, SCRYPT_KEY_BYTES, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, encoded: string | null | undefined) {
  if (!encoded) return false;
  const [algorithm, nRaw, rRaw, pRaw, saltRaw, keyRaw, extra] = encoded.split("$");
  if (algorithm !== "scrypt" || !nRaw || !rRaw || !pRaw || !saltRaw || !keyRaw || extra !== undefined) return false;
  const n = Number(nRaw), r = Number(rRaw), p = Number(pRaw);
  if (!Number.isInteger(n) || n < 16_384 || n > 65_536 || !Number.isInteger(r) || r !== 8 || !Number.isInteger(p) || p !== 1) return false;
  try {
    const expected = Buffer.from(keyRaw, "base64url");
    if (expected.length !== SCRYPT_KEY_BYTES) return false;
    const actual = await deriveKey(password, Buffer.from(saltRaw, "base64url"), expected.length, { N: n, r, p, maxmem: 128 * n * r + 1024 * 1024 });
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function tokenDigest(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function readSessionToken(req: Request) {
  const raw = req.headers.cookie;
  if (!raw) return null;
  const token = parse(raw)[SESSION_COOKIE];
  return token && /^[A-Za-z0-9_-]{32,100}$/.test(token) ? token : null;
}

export function writeSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS * 1000,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
}

export async function consumeAuthAttempt(email: string, requestIp = "unknown", nowMs = Date.now()) {
  const db = await getDb();
  if (!db) throw new Error("Turso database unavailable");
  const client = getTursoClient();
  if (!client) throw new Error("Turso database unavailable");
  const keyHash = tokenDigest(`${normalizeEmail(email)}\n${requestIp}`);
  const floor = nowMs - AUTH_RATE_WINDOW_MS;
  const result = await client.execute({
    sql: `INSERT INTO auth_rate_limits (key_hash, window_started_at, attempts) VALUES (?, ?, 1)
      ON CONFLICT(key_hash) DO UPDATE SET
        attempts = CASE WHEN auth_rate_limits.window_started_at <= ? THEN 1 ELSE auth_rate_limits.attempts + 1 END,
        window_started_at = CASE WHEN auth_rate_limits.window_started_at <= ? THEN ? ELSE auth_rate_limits.window_started_at END
      RETURNING attempts`,
    args: [keyHash, nowMs, floor, floor, nowMs],
  });
  const attempts = Number(result.rows[0]?.attempts ?? 0);
  return attempts <= MAX_AUTH_ATTEMPTS_PER_WINDOW;
}

export async function clearAuthAttempts(email: string, requestIp = "unknown") {
  const db = await getDb();
  if (!db) return;
  const keyHash = tokenDigest(`${normalizeEmail(email)}\n${requestIp}`);
  await db.delete(authRateLimits).where(eq(authRateLimits.keyHash, keyHash));
}

export async function createSession(userId: number, res: Response) {
  const db = await getDb();
  if (!db) throw new Error("Turso database unavailable");
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  await db.delete(authSessions).where(lt(authSessions.expiresAt, new Date()));
  await db.insert(authSessions).values({ tokenHash: tokenDigest(token), userId, expiresAt });
  writeSessionCookie(res, token);
}

export async function revokeSession(token: string | null | undefined, res: Response) {
  if (token) {
    const db = await getDb();
    if (db) await db.delete(authSessions).where(eq(authSessions.tokenHash, tokenDigest(token)));
  }
  clearSessionCookie(res);
}

export async function loadSessionUser(token: string | null) {
  if (!token) return { user: null, tokenHash: null };
  const db = await getDb();
  if (!db) return { user: null, tokenHash: null };
  const tokenHash = tokenDigest(token);
  const now = new Date();
  const session = (await db.select().from(authSessions).where(and(eq(authSessions.tokenHash, tokenHash), gt(authSessions.expiresAt, now))).limit(1))[0];
  if (!session) return { user: null, tokenHash: null };
  let user = (await db.select().from(users).where(eq(users.id, session.userId)).limit(1))[0];
  if (!user) return { user: null, tokenHash: null };
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (adminEmail && user.email.toLowerCase() === adminEmail && user.role !== "admin") {
    await db.update(users).set({ role: "admin" }).where(eq(users.id, user.id));
    user = { ...user, role: "admin" };
  }
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return { user: publicUser, tokenHash };
}
