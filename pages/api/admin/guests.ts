// pages/api/admin/guests.ts — guest sessions + their enrolled batches.
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminApi } from "@/lib/adminAuth";
import { ensureSchema, query } from "@/lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdminApi(req, res)) return;

  try {
    await ensureSchema();

    if (req.method === "GET") {
      const page = Math.max(1, parseInt(String(req.query.page || "1")));
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "20"))));
      const search = String(req.query.search || "").trim();
      const offset = (page - 1) * limit;

      const where = search ? `WHERE g.id ILIKE $3 OR g.label ILIKE $3` : "";
      const params: any[] = search ? [limit, offset, `%${search}%`] : [limit, offset];

      const rows = await query<any>(
        `SELECT g.id, g.label, g.user_agent, g.created_at, g.last_seen_at,
                COALESCE(e.count, 0) AS enrolled_count,
                COALESCE(e.batches, '[]'::json) AS batches
         FROM guest_sessions g
         LEFT JOIN (
           SELECT guest_id, COUNT(*) AS count,
                  json_agg(json_build_object('batchId', batch_id, 'batchName', batch_name, 'createdAt', created_at)
                           ORDER BY created_at DESC) AS batches
           FROM guest_enrollments GROUP BY guest_id
         ) e ON e.guest_id = g.id
         ${where}
         ORDER BY g.last_seen_at DESC
         LIMIT $1 OFFSET $2`,
        params
      );

      const totalRes = await query<any>(
        `SELECT COUNT(*)::int AS total FROM guest_sessions g ${search ? "WHERE g.id ILIKE $1 OR g.label ILIKE $1" : ""}`,
        search ? [`%${search}%`] : []
      );
      const enrollRes = await query<any>(`SELECT COUNT(*)::int AS total FROM guest_enrollments`);

      return res.status(200).json({
        guests: rows.rows.map((r) => ({
          id: r.id,
          label: r.label,
          userAgent: r.user_agent,
          createdAt: r.created_at,
          lastSeenAt: r.last_seen_at,
          enrolledCount: Number(r.enrolled_count),
          batches: r.batches,
        })),
        total: totalRes.rows[0]?.total || 0,
        totalEnrollments: enrollRes.rows[0]?.total || 0,
        page,
        limit,
      });
    }

    if (req.method === "DELETE") {
      const id = String(req.query.id || req.body?.id || "");
      if (!id) return res.status(400).json({ message: "Guest id required" });
      await query(`DELETE FROM guest_sessions WHERE id = $1`, [id]);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ message: "Method not allowed" });
  } catch (err: any) {
    console.error("[admin/guests]", err);
    return res.status(500).json({ message: err?.message || "Internal server error" });
  }
}
