// pages/api/get-live-url.ts
// Live class video URL resolution.
//
// Source: the paid stream worker
//   /api/get-video-url?batchId=..&subjectId=..&childId=..&videoType=penpencilvdo
// It returns a signed CloudFront HLS manifest (index.m3u8) which is handed to
// the player directly — no proxy, no og-stream API for live classes.
import type { NextApiRequest, NextApiResponse } from "next";
import { authenticateUser } from "@/utils/authenticateUser";
import { fetchPaidStream } from "@/lib/paidStream";

// The paid worker often takes 10-15s to answer; allow the function to run long.
export const maxDuration = 60;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const batchId = String(req.query.batchId || "");
  const childId = String(req.query.childId || "");
  const subjectId = String(req.query.subjectId || req.query.SubjectId || "");

  if (!batchId || !childId) {
    return res
      .status(400)
      .json({ success: false, message: "`batchId` and `childId` are required." });
  }

  try {
    await authenticateUser(req, res);
  } catch (err: any) {
    return res.status(401).json({ success: false, message: err?.message || "Unauthorized" });
  }

  const stream = await fetchPaidStream({ batchId, subjectId, childId }, { timeoutMs: 22000, retries: 0 });

  if (!stream) {
    return res
      .status(502)
      .json({ success: false, message: "Live stream is not available right now." });
  }

  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({
    success: true,
    url: stream.url,
    signedUrl: stream.signedUrl,
    fullUrl: stream.fullUrl,
  });
}
