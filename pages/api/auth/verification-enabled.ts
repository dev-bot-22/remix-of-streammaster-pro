import dbConnect from "@/lib/mongodb";
import ServerConfig from "@/models/ServerConfig";

/**
 * GET /api/auth/verification-enabled
 * Returns whether the verification system is active
 * (i.e., at least one shortener server has enabled: true)
 */
export default async function handler(req: any, res: any) {
  // Short-circuit cache to prevent stale reads
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  try {
    await dbConnect();
    const config = await ServerConfig.findOne({ _id: 1 }).lean();
    const servers: any[] = (config as any)?.shortner_servers || [];
    const hasEnabledServer = servers.some((s) => s.enabled === true);
    return res.status(200).json({ enabled: hasEnabledServer });
  } catch (err) {
    console.error("[verification-enabled] DB error:", err);
    // Fail open — don't block users if DB is down
    return res.status(200).json({ enabled: false });
  }
}
