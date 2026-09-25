import type { NextApiRequest, NextApiResponse } from "next";
import { verifyAdminTokenFromCookie } from "@/lib/adminAuth";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import Batch from "@/models/Batch";
import ServerConfig from "@/models/ServerConfig";
import { ensureSchema, isDatabaseConfigured, query } from "@/lib/db";

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error("[adminDashboard] read failed:", (err as Error).message);
    return fallback;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  // Auth first — the dashboard must open even if a data read fails.
  const admin = verifyAdminTokenFromCookie(req);
  if (!admin) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  await safe(async () => {
    await dbConnect();
    if (isDatabaseConfigured()) await ensureSchema();
  }, undefined);

  const [userCount, batchCount, config, guestCount, enrollmentCount] = await Promise.all([
    safe(() => User.countDocuments(), 0),
    safe(() => Batch.countDocuments(), 0),
    safe<any>(async () => await ServerConfig.findOne({ _id: 1 }).lean(), null),
    safe(async () => {
      if (!isDatabaseConfigured()) return 0;
      const r = await query<any>(`SELECT COUNT(*)::int AS total FROM guest_sessions`);
      return r.rows[0]?.total || 0;
    }, 0),
    safe(async () => {
      if (!isDatabaseConfigured()) return 0;
      const r = await query<any>(`SELECT COUNT(*)::int AS total FROM guest_enrollments`);
      return r.rows[0]?.total || 0;
    }, 0),
  ]);

  return res.status(200).json({
    userCount,
    batchCount,
    guestCount,
    enrollmentCount,
    databaseConnected: isDatabaseConfigured(),
    serverConfig: config,
    admin: admin.username,
  });
}
