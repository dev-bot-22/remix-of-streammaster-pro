// lib/adminAuth.ts — admin panel auth for /admin.
// Credentials come from environment variables only:
//   ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_SESSION_SECRET
import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import type { NextApiRequest, NextApiResponse } from "next";
import { ensureSchema, isDatabaseConfigured, query } from "./db";

export const ADMIN_COOKIE = "admin_token";
export const ADMIN_MAX_AGE_SECONDS = 60 * 60 * 12; // 12 hours

export function adminSecret(): string {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.JWT_SECRET ||
    "pw-marco-admin-dev-secret-change-me"
  );
}

export type AdminClaims = { admin: true; username: string };

export function signAdminToken(username: string): string {
  return jwt.sign({ admin: true, username }, adminSecret(), {
    expiresIn: ADMIN_MAX_AGE_SECONDS,
  });
}

export function verifyAdminToken(token?: string | null): AdminClaims | null {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, adminSecret());
    if (decoded && typeof decoded === "object" && (decoded as any).admin) {
      return decoded as AdminClaims;
    }
    return null;
  } catch {
    return null;
  }
}

function readCookie(header: string | undefined | null, name: string): string | undefined {
  if (!header) return undefined;
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match?.[1];
}

/** pages/api guard. */
export function verifyAdminTokenFromCookie(req: NextApiRequest): AdminClaims | null {
  const token = req.cookies?.[ADMIN_COOKIE] || readCookie(req.headers.cookie, ADMIN_COOKIE);
  return verifyAdminToken(token);
}

/** pages/api guard that writes the 401 for you. Returns null when blocked. */
export function requireAdminApi(req: NextApiRequest, res: NextApiResponse): AdminClaims | null {
  const admin = verifyAdminTokenFromCookie(req);
  if (!admin) {
    res.status(401).json({ message: "Unauthorized" });
    return null;
  }
  return admin;
}

/** App-router guard. */
export function getAdminFromRequest(request: Request): AdminClaims | null {
  return verifyAdminToken(readCookie(request.headers.get("cookie"), ADMIN_COOKIE));
}

export function adminCookieString(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${ADMIN_COOKIE}=${token}; Path=/; HttpOnly; Max-Age=${ADMIN_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

export function clearAdminCookieString(): string {
  return `${ADMIN_COOKIE}=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax`;
}

export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD);
}

async function ensureAdminCredentialsSchema(): Promise<void> {
  if (!isDatabaseConfigured()) return;
  await ensureSchema();
  await query(`
    CREATE TABLE IF NOT EXISTS admin_credentials (
      username TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

export async function adminConfiguredAsync(): Promise<boolean> {
  if (adminConfigured()) return true;
  if (!isDatabaseConfigured()) return false;
  try {
    await ensureAdminCredentialsSchema();
    const r = await query(`SELECT 1 FROM admin_credentials LIMIT 1`);
    return Boolean(r.rowCount);
  } catch (err) {
    console.error("[adminAuth] config check failed:", (err as Error).message);
    return false;
  }
}

export function checkAdminCredentials(username: string, password: string): boolean {
  if (!adminConfigured()) return false;
  const a = crypto.createHash("sha256").update(`${username}:${password}`).digest();
  const b = crypto
    .createHash("sha256")
    .update(`${process.env.ADMIN_USERNAME}:${process.env.ADMIN_PASSWORD}`)
    .digest();
  return crypto.timingSafeEqual(a, b);
}

export async function checkAdminCredentialsAsync(username: string, password: string): Promise<boolean> {
  if (checkAdminCredentials(username, password)) return true;
  if (!isDatabaseConfigured()) return false;
  try {
    await ensureAdminCredentialsSchema();
    const r = await query<{ password_hash: string }>(
      `SELECT password_hash FROM admin_credentials WHERE lower(username) = lower($1) LIMIT 1`,
      [username]
    );
    const hash = r.rows[0]?.password_hash;
    if (!hash) return false;
    return bcrypt.compare(password, hash);
  } catch (err) {
    console.error("[adminAuth] credential check failed:", (err as Error).message);
    return false;
  }
}
