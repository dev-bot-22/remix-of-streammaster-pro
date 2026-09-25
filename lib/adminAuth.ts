// lib/adminAuth.ts — admin panel auth for /admin.
// Credentials come from environment variables only:
//   ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_SESSION_SECRET
import crypto from "crypto";
import jwt from "jsonwebtoken";
import type { NextApiRequest, NextApiResponse } from "next";

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

export function checkAdminCredentials(username: string, password: string): boolean {
  if (!adminConfigured()) return false;
  const a = crypto.createHash("sha256").update(`${username}:${password}`).digest();
  const b = crypto
    .createHash("sha256")
    .update(`${process.env.ADMIN_USERNAME}:${process.env.ADMIN_PASSWORD}`)
    .digest();
  return crypto.timingSafeEqual(a, b);
}
