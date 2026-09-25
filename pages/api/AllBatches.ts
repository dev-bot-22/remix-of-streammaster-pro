import type { NextApiRequest, NextApiResponse } from "next";
import { authenticateUser } from "@/utils/authenticateUser";
import { getAllBatches, paginate } from "@/lib/batchesSource";

// Batches come from the admin-configured JSON source (Admin > Controls > Batches source URL).
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { page = "1" } = req.query;
  const pageNum = parseInt(page as string, 10);
  if (isNaN(pageNum) || pageNum <= 0) {
    return res.status(400).json({ message: "Invalid page parameter" });
  }

  try {
    await authenticateUser(req, res);
  } catch (err: any) {
    return res.status(401).json({ message: err.message || "Unauthorized" });
  }

  try {
    const all = await getAllBatches();
    const result = paginate(all, pageNum, 15);
    return res.status(200).json({ success: true, ...result });
  } catch (err: any) {
    console.error("AllBatches error:", err);
    return res.status(500).json({ message: err.message || "Failed to fetch batches" });
  }
}
