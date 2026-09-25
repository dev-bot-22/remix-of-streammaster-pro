// lib/mongodb.ts — compatibility shim.
// The project now runs on Neon (Postgres). This keeps the old `dbConnect()`
// call sites working: it just makes sure the Postgres schema exists. When no
// DATABASE_URL is configured (local preview), it is a no-op.
import { ensureSchema, isDatabaseConfigured, pool } from "./db";

export async function dbConnect() {
  if (!isDatabaseConfigured()) return null;
  await ensureSchema();
  return pool;
}

export default dbConnect;
