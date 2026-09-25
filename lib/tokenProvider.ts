// lib/tokenProvider.ts
// Central place that hands out the PW (penpencil) access token used by every
// API call on the site.
//
//  * Login mode OFF (default): a single global token is fetched from the
//    StudySpark exchange-token endpoint, cached in memory + Postgres and
//    auto-refreshed before it expires.
//  * Login mode ON: each user's own token is used (see utils/authenticateUser).
import { ensureSchema, query } from "./db";
import { getAppSettings } from "./appSettings";

export type GlobalToken = {
  accessToken: string;
  refreshToken: string;
  randomId: string;
  expiresAt: Date | null;
  fetchedAt: Date;
  source: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __globalToken: GlobalToken | null | undefined;
  // eslint-disable-next-line no-var
  var __globalTokenInFlight: Promise<GlobalToken> | null | undefined;
}

const SKEW_MS = 5 * 60 * 1000; // refresh 5 minutes before expiry
const DEFAULT_TTL_MS = 60 * 60 * 1000; // assume 1h if the API doesn't say

function decodeJwtExpiry(token: string): Date | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString("utf8"));
    if (payload?.exp) return new Date(payload.exp * 1000);
  } catch {
    /* not a JWT */
  }
  return null;
}

function pick(obj: any, keys: string[]): string {
  for (const key of keys) {
    const parts = key.split(".");
    let cur = obj;
    for (const p of parts) cur = cur?.[p];
    if (typeof cur === "string" && cur) return cur;
  }
  return "";
}

function randomId(): string {
  return crypto.randomUUID();
}

async function readCachedToken(): Promise<GlobalToken | null> {
  try {
    await ensureSchema();
    const res = await query<any>(`SELECT * FROM global_tokens WHERE id = 1`);
    const row = res.rows[0];
    if (!row?.access_token) return null;
    return {
      accessToken: row.access_token,
      refreshToken: row.refresh_token || "",
      randomId: row.random_id || randomId(),
      expiresAt: row.expires_at ? new Date(row.expires_at) : null,
      fetchedAt: new Date(row.fetched_at),
      source: row.source_url || "",
    };
  } catch {
    return null;
  }
}

async function writeCachedToken(token: GlobalToken, error?: string) {
  try {
    await ensureSchema();
    await query(
      `INSERT INTO global_tokens (id, access_token, refresh_token, random_id, source_url, expires_at, fetched_at, last_error)
       VALUES (1, $1, $2, $3, $4, $5, now(), $6)
       ON CONFLICT (id) DO UPDATE SET access_token = EXCLUDED.access_token,
         refresh_token = EXCLUDED.refresh_token, random_id = EXCLUDED.random_id,
         source_url = EXCLUDED.source_url, expires_at = EXCLUDED.expires_at,
         fetched_at = now(), last_error = EXCLUDED.last_error`,
      [token.accessToken, token.refreshToken, token.randomId, token.source, token.expiresAt, error || null]
    );
  } catch (err) {
    console.error("[tokenProvider] cache write failed:", (err as Error).message);
  }
}

function isFresh(token: GlobalToken | null | undefined): token is GlobalToken {
  if (!token?.accessToken) return false;
  const exp = token.expiresAt ? token.expiresAt.getTime() : token.fetchedAt.getTime() + DEFAULT_TTL_MS;
  return exp - Date.now() > SKEW_MS;
}

/** Hit the configured token source and normalise whatever shape it returns. */
export async function fetchTokenFromSource(url: string): Promise<GlobalToken> {
  // The StudySpark endpoint answers on GET (POST returns 404).
  const res = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json, text/plain, */*",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
    },
    cache: "no-store",
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Token source returned non-JSON (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    throw new Error(`Token source HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const accessToken = pick(json, [
    "access_token",
    "accessToken",
    "token",
    "data.access_token",
    "data.accessToken",
    "data.token",
    "data.tokens.access_token",
    "result.access_token",
  ]);
  if (!accessToken) {
    throw new Error(`Token source response had no access token: ${text.slice(0, 200)}`);
  }

  const refreshToken = pick(json, [
    "refresh_token",
    "refreshToken",
    "data.refresh_token",
    "data.refreshToken",
    "data.tokens.refresh_token",
  ]);

  return {
    accessToken,
    refreshToken,
    randomId: pick(json, ["randomId", "data.randomId", "data.user.randomId"]) || randomId(),
    expiresAt: decodeJwtExpiry(accessToken),
    fetchedAt: new Date(),
    source: url,
  };
}

/** Returns a usable global token, refreshing it only when needed. */
export async function getGlobalToken(forceRefresh = false): Promise<GlobalToken> {
  const settings = await getAppSettings();

  if (settings.manualToken && !forceRefresh) {
    const manual: GlobalToken = {
      accessToken: settings.manualToken,
      refreshToken: "",
      randomId: randomId(),
      expiresAt: decodeJwtExpiry(settings.manualToken),
      fetchedAt: new Date(),
      source: "manual",
    };
    if (!manual.expiresAt || isFresh(manual)) return manual;
  }

  if (!forceRefresh && isFresh(global.__globalToken)) return global.__globalToken!;

  if (!forceRefresh) {
    const cached = await readCachedToken();
    if (isFresh(cached)) {
      global.__globalToken = cached;
      return cached;
    }
  }

  if (global.__globalTokenInFlight) return global.__globalTokenInFlight;

  global.__globalTokenInFlight = (async () => {
    try {
      const token = await fetchTokenFromSource(settings.tokenUrl);
      global.__globalToken = token;
      await writeCachedToken(token);
      return token;
    } catch (err) {
      const stale = global.__globalToken || (await readCachedToken());
      if (stale?.accessToken) {
        console.error("[tokenProvider] refresh failed, using last known token:", (err as Error).message);
        return stale;
      }
      throw err;
    } finally {
      global.__globalTokenInFlight = null;
    }
  })();

  return global.__globalTokenInFlight;
}

export async function getGlobalTokenStatus() {
  const settings = await getAppSettings();
  const cached = await readCachedToken();
  return {
    tokenUrl: settings.tokenUrl,
    hasManualToken: Boolean(settings.manualToken),
    hasToken: Boolean(cached?.accessToken),
    fetchedAt: cached?.fetchedAt || null,
    expiresAt: cached?.expiresAt || null,
    fresh: isFresh(cached),
    preview: cached?.accessToken ? `${cached.accessToken.slice(0, 12)}…${cached.accessToken.slice(-6)}` : null,
  };
}

// ---------------------------------------------------------------------------
// Auto-heal: if PW rejects the global (guest) token with 401 — e.g. StudySpark
// rotated it — fetch a fresh token once and transparently retry the request.
// ---------------------------------------------------------------------------
import axios from "axios";

declare global {
  // eslint-disable-next-line no-var
  var __pwAxiosHealInstalled: boolean | undefined;
}

if (!global.__pwAxiosHealInstalled) {
  global.__pwAxiosHealInstalled = true;
  axios.interceptors.response.use(undefined, async (error: any) => {
    const cfg = error?.config;
    const status = error?.response?.status;
    if (!cfg || cfg.__pwRetried || status !== 401) throw error;
    const auth: string = String(cfg.headers?.Authorization || cfg.headers?.authorization || "");
    const current = global.__globalToken?.accessToken;
    if (!auth || !current || !auth.includes(current)) throw error;
    try {
      const fresh = await getGlobalToken(true);
      if (!fresh?.accessToken || fresh.accessToken === current) throw error;
      cfg.__pwRetried = true;
      cfg.headers = { ...(cfg.headers || {}), Authorization: `Bearer ${fresh.accessToken}` };
      return axios.request(cfg);
    } catch {
      throw error;
    }
  });
}
