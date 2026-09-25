// lib/guest.ts — permanent guest sessions.
// A visitor gets a guest id in a long-lived cookie; everything they enroll in
// is stored against that id in Postgres, so re-opening the site keeps their
// batches. When no DATABASE_URL is configured (e.g. local preview), the same
// data lives in a module-level in-memory store instead so the app still works.
import crypto from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { ensureSchema, isDatabaseConfigured, query } from "./db";

export const GUEST_COOKIE = "guest_id";
export const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 5; // 5 years

export type GuestSession = {
  id: string;
  label: string;
  createdAt: Date;
  lastSeenAt: Date;
};

// ---- In-memory fallback (only used when DATABASE_URL is not set) ----
type MemSession = { id: string; createdAt: Date; lastSeenAt: Date };
type MemEnrollment = { batchId: string; batchName: string; batchImage: string; createdAt: Date };

declare global {
  // eslint-disable-next-line no-var
  var __memGuests: Map<string, MemSession> | undefined;
  // eslint-disable-next-line no-var
  var __memEnrollments: Map<string, MemEnrollment[]> | undefined;
}
const memGuests = (global.__memGuests ??= new Map());
const memEnrollments = (global.__memEnrollments ??= new Map());

export function newGuestId(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function guestLabel(id: string): string {
  return `PW-MARCO User-${id.slice(0, 6).toUpperCase()}`;
}

function hashIp(ip: string): string {
  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

export function guestCookieString(id: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${GUEST_COOKIE}=${id}; Path=/; Max-Age=${GUEST_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

/** Create the row if missing and bump last_seen_at. */
export async function touchGuest(
  id: string,
  meta: { userAgent?: string; ip?: string } = {}
): Promise<GuestSession> {
  if (!isDatabaseConfigured()) {
    const existing = memGuests.get(id);
    const session: MemSession =
      existing ? { ...existing, lastSeenAt: new Date() } : { id, createdAt: new Date(), lastSeenAt: new Date() };
    memGuests.set(id, session);
    return { id, label: guestLabel(id), createdAt: session.createdAt, lastSeenAt: session.lastSeenAt };
  }
  await ensureSchema();
  const res = await query<any>(
    `INSERT INTO guest_sessions (id, label, user_agent, ip_hash)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE SET last_seen_at = now(),
       user_agent = COALESCE(EXCLUDED.user_agent, guest_sessions.user_agent)
     RETURNING *`,
    [id, guestLabel(id), meta.userAgent || null, meta.ip ? hashIp(meta.ip) : null]
  );
  const row = res.rows[0];
  return {
    id: row.id,
    label: guestLabel(row.id),
    createdAt: new Date(row.created_at),
    lastSeenAt: new Date(row.last_seen_at),
  };
}

/** pages/api version: reads the cookie, creating + setting it when absent. */
export async function getOrCreateGuest(
  req: NextApiRequest,
  res?: NextApiResponse
): Promise<GuestSession> {
  let id = req.cookies?.[GUEST_COOKIE];
  if (!id || !/^[a-f0-9]{16,64}$/i.test(id)) {
    id = newGuestId();
    if (res) {
      const existing = res.getHeader("Set-Cookie");
      const cookie = guestCookieString(id);
      res.setHeader(
        "Set-Cookie",
        Array.isArray(existing) ? [...existing, cookie] : existing ? [String(existing), cookie] : cookie
      );
    }
  }
  return touchGuest(id, {
    userAgent: req.headers["user-agent"],
    ip: (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim(),
  });
}

/** App-router version: never sets a cookie (route handlers do that themselves). */
export async function getGuestFromRequest(request: Request): Promise<GuestSession | null> {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(new RegExp(`${GUEST_COOKIE}=([a-f0-9]{16,64})`, "i"));
  if (!match) return null;
  return touchGuest(match[1], {
    userAgent: request.headers.get("user-agent") || undefined,
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
  });
}

export type GuestEnrollment = {
  batchId: string;
  batchName: string;
  batchImage: string;
  createdAt: Date;
};

export async function listEnrollments(guestId: string): Promise<GuestEnrollment[]> {
  if (!isDatabaseConfigured()) {
    return (memEnrollments.get(guestId) || []).map((e) => ({ ...e }));
  }
  await ensureSchema();
  const res = await query<any>(
    `SELECT batch_id, batch_name, batch_image, created_at FROM guest_enrollments
     WHERE guest_id = $1 ORDER BY created_at DESC`,
    [guestId]
  );
  return res.rows.map((r) => ({
    batchId: r.batch_id,
    batchName: r.batch_name,
    batchImage: r.batch_image,
    createdAt: new Date(r.created_at),
  }));
}

export async function addEnrollment(
  guestId: string,
  batch: { batchId: string; batchName?: string; batchImage?: string }
): Promise<void> {
  if (!isDatabaseConfigured()) {
    const list = memEnrollments.get(guestId) || [];
    const existing = list.find((e) => e.batchId === batch.batchId);
    if (existing) {
      if (batch.batchName) existing.batchName = batch.batchName;
      if (batch.batchImage) existing.batchImage = batch.batchImage;
    } else {
      list.push({
        batchId: batch.batchId,
        batchName: batch.batchName || "",
        batchImage: batch.batchImage || "",
        createdAt: new Date(),
      });
    }
    memEnrollments.set(guestId, list);
    return;
  }
  await ensureSchema();
  await query(
    `INSERT INTO guest_enrollments (guest_id, batch_id, batch_name, batch_image)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (guest_id, batch_id) DO UPDATE SET
       batch_name = COALESCE(NULLIF(EXCLUDED.batch_name, ''), guest_enrollments.batch_name),
       batch_image = COALESCE(NULLIF(EXCLUDED.batch_image, ''), guest_enrollments.batch_image)`,
    [guestId, batch.batchId, batch.batchName || "", batch.batchImage || ""]
  );
}

export async function removeEnrollment(guestId: string, batchId: string): Promise<void> {
  if (!isDatabaseConfigured()) {
    memEnrollments.set(
      guestId,
      (memEnrollments.get(guestId) || []).filter((e) => e.batchId !== batchId)
    );
    return;
  }
  await ensureSchema();
  await query(`DELETE FROM guest_enrollments WHERE guest_id = $1 AND batch_id = $2`, [guestId, batchId]);
}

export async function isEnrolled(guestId: string, batchId: string): Promise<boolean> {
  if (!isDatabaseConfigured()) {
    return (memEnrollments.get(guestId) || []).some((e) => e.batchId === batchId);
  }
  await ensureSchema();
  const res = await query(`SELECT 1 FROM guest_enrollments WHERE guest_id = $1 AND batch_id = $2`, [
    guestId,
    batchId,
  ]);
  return res.rowCount! > 0;
}
