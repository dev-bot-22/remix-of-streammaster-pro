// lib/streamVault.ts — server-only sealing of stream links.
// Real stream / segment links never reach the browser: they are sealed into
// opaque AES-256-GCM tokens that only this server can open.
import crypto from "crypto";

const SECRET =
  process.env.STREAM_VAULT_SECRET || process.env.JWT_SECRET || "pw-marco-stream-vault";
const KEY = crypto.createHash("sha256").update(`vault:${SECRET}`).digest();

export const SESSION_COOKIE = "_svs";
export const TOKEN_TTL_MS = 6 * 60 * 60 * 1000;

export type VaultPayload = {
  k: "p" | "s" | "key" | "r"; // playlist | segment | aes key | raw passthrough
  u?: string; // upstream url (untouched signed link)
  s: string; // session id hash
  e: number; // expiry (ms)
  x?: string; // hex aes-128 key for segment encryption
  i?: string; // hex iv
};

const b64u = (b: Buffer) => b.toString("base64url");

export function seal(p: VaultPayload): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const ct = Buffer.concat([c.update(JSON.stringify(p), "utf8"), c.final()]);
  return b64u(Buffer.concat([iv, c.getAuthTag(), ct]));
}

export function open(token: string): VaultPayload | null {
  try {
    const raw = Buffer.from(token, "base64url");
    const d = crypto.createDecipheriv("aes-256-gcm", KEY, raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    const pt = Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8");
    const p = JSON.parse(pt) as VaultPayload;
    if (!p || typeof p.e !== "number" || Date.now() > p.e) return null;
    return p;
  } catch {
    return null;
  }
}

export function sessionHash(sid: string): string {
  return crypto.createHmac("sha256", KEY).update(sid).digest("hex").slice(0, 32);
}

/** Opaque junk returned to anyone probing the endpoints directly. */
export function decoy(): { t: string } {
  return { t: b64u(crypto.randomBytes(48 + Math.floor(Math.random() * 64))) };
}

export function readCookie(header: string | undefined, name: string): string {
  if (!header) return "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return "";
}

/** Response envelope: AES-GCM with a key derived from a per-response nonce. */
export const ENVELOPE_SALT = "pwm-env-7c1e";
export function envelope(obj: unknown) {
  const n = crypto.randomBytes(16);
  const key = crypto.createHash("sha256").update(Buffer.concat([n, Buffer.from(ENVELOPE_SALT)])).digest();
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([c.update(JSON.stringify(obj), "utf8"), c.final(), c.getAuthTag()]);
  return { n: b64u(n), i: b64u(iv), d: b64u(ct) };
}
