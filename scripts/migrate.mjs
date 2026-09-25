// scripts/migrate.mjs — creates all Postgres tables on Neon.
// Plain Node ESM (no tsx needed) so it works in the Heroku release phase.
import pg from "pg";

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

async function main() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    console.warn("[migrate] DATABASE_URL not set — skipping migration.");
    return;
  }

  const pool = new pg.Pool({
    connectionString: url,
    ssl: /sslmode=disable/.test(url) ? undefined : { rejectUnauthorized: false },
    max: 2,
    connectionTimeoutMillis: 20_000,
  });

  console.log("[migrate] creating tables (if missing)…");
  await pool.query(SCHEMA_SQL);
  const res = await pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
  );
  console.log("[migrate] tables present:", res.rows.map((r) => r.table_name).join(", "));
  await pool.end();
  console.log("[migrate] done");
}

main().catch((err) => {
  console.error("[migrate] failed:", err?.message || err);
  process.exit(1);
});
