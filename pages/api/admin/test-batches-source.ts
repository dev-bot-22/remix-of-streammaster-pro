// pages/api/admin/test-batches-source.ts — admin-only check of a batches JSON URL.
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminApi } from "@/lib/adminAuth";
import { fetchBatchesFromUrl } from "@/lib/batchesSource";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdminApi(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });
  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!/^https:\/\//i.test(url)) return res.status(400).json({ message: "URL must start with https://" });
  try {
    const items = await fetchBatchesFromUrl(url);
    return res.status(200).json({
      success: true,
      count: items.length,
      sample: items.slice(0, 5).map((b) => ({ id: b.batchId, name: b.batchName })),
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err?.message || "Could not load this URL" });
  }
}
