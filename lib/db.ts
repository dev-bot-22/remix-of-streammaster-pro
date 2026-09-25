// lib/db.ts — Neon (Postgres) connection pool.
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import pg from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env.local"), override: true });

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: pg.Pool | undefined;
  // eslint-disable-next-line no-var
  var __pgSchemaReady: Promise<void> | undefined;
}

/**
 * The pool is created lazily on first use so that the app can be built
 * (and static pages collected) without DATABASE_URL being present.
 */
export function getPool(): pg.Pool {
  if (global.__pgPool) return global.__pgPool;

  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    throw new Error("Please define DATABASE_URL (Neon Postgres connection string)");
  }

  const created = new pg.Pool({
    connectionString: url,
    ssl: /sslmode=disable/.test(url) ? undefined : { rejectUnauthorized: false },
    max: Number(process.env.PG_POOL_MAX || 5),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
  });
  global.__pgPool = created;
  return created;
}

/** Proxy kept for backwards compatibility with `pool.query(...)` call sites. */
export const pool: pg.Pool = new Proxy({} as pg.Pool, {
  get(_t, prop) {
    const value = (getPool() as any)[prop];
    return typeof value === "function" ? value.bind(getPool()) : value;
  },
});

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL);
}

export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params: any[] = []
): Promise<pg.QueryResult<T>> {
  return getPool().query<T>(text, params);
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS documents (
  collection  TEXT NOT NULL,
  id          TEXT NOT NULL,
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (collection, id)
);
CREATE INDEX IF NOT EXISTS documents_collection_idx ON documents (collection);
CREATE INDEX IF NOT EXISTS documents_updated_idx ON documents (collection, updated_at DESC);

CREATE TABLE IF NOT EXISTS guest_sessions (
  id            TEXT PRIMARY KEY,
  label         TEXT,
  user_agent    TEXT,
  ip_hash       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guest_enrollments (
  guest_id    TEXT NOT NULL REFERENCES guest_sessions(id) ON DELETE CASCADE,
  batch_id    TEXT NOT NULL,
  batch_name  TEXT NOT NULL DEFAULT '',
  batch_image TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (guest_id, batch_id)
);
CREATE INDEX IF NOT EXISTS guest_enrollments_batch_idx ON guest_enrollments (batch_id);

CREATE TABLE IF NOT EXISTS app_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS global_tokens (
  id             INTEGER PRIMARY KEY DEFAULT 1,
  access_token   TEXT,
  refresh_token  TEXT,
  random_id      TEXT,
  source_url     TEXT,
  expires_at     TIMESTAMPTZ,
  fetched_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error     TEXT
);
`;

export async function ensureSchema(): Promise<void> {
  if (!global.__pgSchemaReady) {
    global.__pgSchemaReady = getPool().query(SCHEMA_SQL).then(() => undefined);
    global.__pgSchemaReady.catch(() => {
      global.__pgSchemaReady = undefined;
    });
  }
  return global.__pgSchemaReady;
}

export default pool;
