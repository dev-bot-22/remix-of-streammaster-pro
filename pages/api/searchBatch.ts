import type { NextApiRequest, NextApiResponse } from "next";
import { authenticateUser } from "@/utils/authenticateUser";
import { getAllBatches, paginate } from "@/lib/batchesSource";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { name, page = "1" } = req.query;
  if (!name || typeof name !== "string") {
    return res.status(400).json({ message: "Missing or invalid `name` query" });
  }
  const currentPage = Math.max(1, parseInt(page as string, 10) || 1);

  try {
    await authenticateUser(req, res);
  } catch (err: any) {
    return res.status(401).json({ message: err.message || "Unauthorized" });
  }

  try {
    const q = name.trim().toLowerCase();
    const terms = q.split(/\s+/).filter(Boolean);
    const all = await getAllBatches();
    const matches = all.filter((b) => {
      const hay = `${b.batchName} ${b.byName} ${b.language} ${b.slug || ""}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
    const result = paginate(matches, currentPage, 10);
    return res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    console.error("Batch search error:", error.message);
    return res.status(500).json({ message: "Error While Searching Batches" });
  }
}
