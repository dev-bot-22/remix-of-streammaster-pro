// lib/appSettings.ts — runtime settings stored in Postgres (app_settings table),
// editable from the admin panel at /admin.
import { ensureSchema, isDatabaseConfigured, query } from "./db";
import { APP_NAME, TELEGRAM_LINK } from "./branding";

export type AppSettings = {
  /** false = guest mode (global StudySpark token), true = users log in with their own PW account */
  loginEnabled: boolean;
  appName: string;
  telegramLink: string;
  /** URL that returns the global StudySpark token */
  tokenUrl: string;
  /** Optional manual override token (admin can paste a token from another source) */
  manualToken: string;
  /** Primary lecture stream API template with {batch_id}/{subject_id}/{lecture_id} */
  primaryStreamApi: string;
  /** Fallback lecture stream API template, used when the primary one fails */
  fallbackStreamApi: string;
  /** JSON URL that supplies the batches shown on the Batches page */
  batchesSourceUrl: string;
};

// Keep the stream provider available even when the first deploy has no
// app_settings row yet or an older row contains blank API fields.
export const DEFAULT_PRIMARY_STREAM_API =
  "https://og-stream.raghutiwari554-34f.workers.dev/api/{batch_id}/{subject_id}/{lecture_id}";
export const DEFAULT_FALLBACK_STREAM_API =
  "https://lecture-stream-api--r9140128682ashw.replit.app/api/{batch_id}/{subject_id}/{topic_id}/{lecture_id}";

const DEFAULTS: AppSettings = {
  loginEnabled: false,
  appName: APP_NAME,
  telegramLink: TELEGRAM_LINK,
  tokenUrl:
    process.env.STUDYSPARK_TOKEN_URL ||
    "https://api.studyspark.study/api/penpencil/v3/oauth/exchange-token",
  manualToken: "",
  primaryStreamApi:
    process.env.PRIMARY_STREAM_API ||
    DEFAULT_PRIMARY_STREAM_API,
  fallbackStreamApi:
    process.env.FALLBACK_STREAM_API ||
    DEFAULT_FALLBACK_STREAM_API,
  batchesSourceUrl:
    process.env.BATCHES_SOURCE_URL ||
    "https://raw.githubusercontent.com/pwxmarco/Batches/refs/heads/main/batches.json",
};

const KEY = "app";
let cache: { value: AppSettings; at: number } | null = null;
const TTL_MS = 10_000;

export async function getAppSettings(force = false): Promise<AppSettings> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.value;
  if (!isDatabaseConfigured()) return DEFAULTS;
  try {
    await ensureSchema();
    const res = await query<{ value: Partial<AppSettings> }>(
      `SELECT value FROM app_settings WHERE key = $1`,
      [KEY]
    );
    const stored = res.rows[0]?.value || {};
    const value = {
      ...DEFAULTS,
      ...stored,
      // Older deployments may have persisted empty API fields. Keep the
      // environment/default providers active instead of disabling streaming.
      primaryStreamApi: stored.primaryStreamApi?.trim() || DEFAULTS.primaryStreamApi,
      fallbackStreamApi: stored.fallbackStreamApi?.trim() || DEFAULTS.fallbackStreamApi,
    } as AppSettings;
    cache = { value, at: Date.now() };
    return value;
  } catch (err) {
    console.error("[appSettings] read failed:", (err as Error).message);
    return DEFAULTS;
  }
}

export async function updateAppSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  if (!isDatabaseConfigured()) {
    const next: AppSettings = { ...(cache?.value ?? DEFAULTS), ...patch };
    cache = { value: next, at: Date.now() };
    return next;
  }
  await ensureSchema();
  const current = await getAppSettings(true);
  const next: AppSettings = { ...current, ...patch };
  await query(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [KEY, JSON.stringify(next)]
  );
  cache = { value: next, at: Date.now() };
  return next;
}

export async function isLoginEnabled(): Promise<boolean> {
  return (await getAppSettings()).loginEnabled;
}
