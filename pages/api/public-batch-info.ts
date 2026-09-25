// pages/api/public-batch-info.ts — details of a single batch from the configured batches source.
import type { NextApiRequest, NextApiResponse } from "next";
import { authenticateUser } from "@/utils/authenticateUser";
import { findBatchById } from "@/lib/batchesSource";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ message: "Method not allowed" });
  const { batchId } = req.query;
  if (!batchId || typeof batchId !== "string") return res.status(400).json({ message: "Missing batchId" });
  try {
    await authenticateUser(req, res);
  } catch (err: any) {
    return res.status(401).json({ message: err.message || "Unauthorized" });
  }
  try {
    const batch = await findBatchById(batchId);
    if (!batch) return res.status(404).json({ success: false, message: "Batch not in source list" });
    return res.status(200).json({ success: true, data: batch });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || "Failed" });
  }
}
