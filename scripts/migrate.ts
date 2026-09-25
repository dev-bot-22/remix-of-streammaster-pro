// scripts/migrate.ts — creates all Postgres tables on Neon.
// Run with: npm run db:migrate
import { ensureSchema, pool } from "../lib/db";

async function main() {
  console.log("[migrate] creating tables (if missing)…");
  await ensureSchema();
  const res = await pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
  );
  console.log("[migrate] tables present:", res.rows.map((r) => r.table_name).join(", "));
  await pool.end();
  console.log("[migrate] done ✅");
}

main().catch((err) => {
  console.error("[migrate] failed:", err);
  process.exit(1);
});
