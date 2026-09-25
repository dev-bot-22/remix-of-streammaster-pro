// lib/downloadDb.ts — compatibility shim.
// Downloads used to live in a second MongoDB. They now share the Neon database.
import { ensureSchema, pool } from "./db";

export async function downloadDbConnect() {
  await ensureSchema();
  return pool;
}

export default downloadDbConnect;
