// pages/api/admin/settings.ts — read/update the app settings shown on /admin/controls.
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminApi } from "@/lib/adminAuth";
import { getAppSettings, updateAppSettings } from "@/lib/appSettings";
import { getGlobalTokenStatus } from "@/lib/tokenProvider";
import { clearBatchesCache } from "@/lib/batchesSource";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdminApi(req, res)) return;

  try {
    if (req.method === "GET") {
      const settings = await getAppSettings(true);
      const token = await getGlobalTokenStatus();
      return res.status(200).json({
        settings: { ...settings, manualToken: settings.manualToken ? "********" : "" },
        token,
      });
    }

    if (req.method === "PUT") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      const patch: any = {};
      if (typeof body.loginEnabled === "boolean") patch.loginEnabled = body.loginEnabled;
      if (typeof body.appName === "string") patch.appName = body.appName.trim();
      if (typeof body.telegramLink === "string") patch.telegramLink = body.telegramLink.trim();
      if (typeof body.tokenUrl === "string" && body.tokenUrl.trim()) patch.tokenUrl = body.tokenUrl.trim();
      for (const field of ["primaryStreamApi", "fallbackStreamApi"] as const) {
        const raw = (body as any)[field];
        if (typeof raw !== "string" || !raw.trim()) continue;
        const label = field === "primaryStreamApi" ? "Primary lecture API" : "Fallback lecture API";
        const url = raw.trim();
        if (!/^https:\/\//i.test(url)) {
          return res.status(400).json({ message: `${label} must start with https://` });
        }
        for (const ph of ["{batch_id}", "{subject_id}", "{lecture_id}"]) {
          if (!url.includes(ph)) {
            return res.status(400).json({ message: `${label} must contain ${ph}` });
          }
        }
        patch[field] = url;
      }
      if (typeof body.batchesSourceUrl === "string" && body.batchesSourceUrl.trim()) {
        const url = body.batchesSourceUrl.trim();
        if (!/^https:\/\//i.test(url)) {
          return res.status(400).json({ message: "Batches source URL must start with https://" });
        }
        patch.batchesSourceUrl = url;
        clearBatchesCache();
      }
      if (typeof body.manualToken === "string" && body.manualToken !== "********") {
        patch.manualToken = body.manualToken.trim();
      }
      const settings = await updateAppSettings(patch);
      return res.status(200).json({
        success: true,
        settings: { ...settings, manualToken: settings.manualToken ? "********" : "" },
      });
    }

    return res.status(405).json({ message: "Method not allowed" });
  } catch (err: any) {
    console.error("[admin/settings]", err);
    return res.status(500).json({ message: err?.message || "Internal server error" });
  }
}
