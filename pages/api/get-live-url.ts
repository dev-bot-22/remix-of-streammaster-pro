// pages/api/get-live-url.ts
// Dedicated endpoint for live class video URL resolution.
// Handles auth, DB token lookup, PW API call, and signed URL assembly — all server-side.
import type { NextApiRequest, NextApiResponse } from "next";
import { authenticateUser } from "@/utils/authenticateUser";
import { getVideoHeaders } from "@/utils/auth";
import Batch from "@/models/Batch";
import dbConnect from "@/lib/mongodb";

const PW_API = process.env.PW_LIVE_API || "https://pwapi.vivekkumar980127.workers.dev/";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const { batchId, childId, container = "HLS" } = req.query;

  if (!batchId || typeof batchId !== "string" || !childId || typeof childId !== "string") {
    return res.status(400).json({ success: false, message: "`batchId` and `childId` are required." });
  }

  // Authenticate user session
  let user: any = null;
  try {
    user = await authenticateUser(req, res);
  } catch (err: any) {
    return res.status(401).json({ success: false, message: err.message || "Unauthorized" });
  }

  await dbConnect();

  // Find batch and get active enrolled tokens
  let batch: any = null;
  try {
    batch = await Batch.findOne({ batchId }).lean();
  } catch {
    console.warn("[get-live-url] Failed to fetch batch from DB");
  }

  const activeTokens: any[] = (batch?.enrolledTokens || []).filter(
    (t: any) => t.tokenStatus === true && !!t.accessToken
  );

  // Also try user's own token as final fallback
  const fallbackToken = user?.ActualToken || "";
  const fallbackRandomId = user?.randomId || "";

  const allTokens = [
    ...activeTokens.map((t: any) => ({ accessToken: t.accessToken, randomId: t.randomId || "" })),
    ...(fallbackToken ? [{ accessToken: fallbackToken, randomId: fallbackRandomId }] : []),
  ];

  if (allTokens.length === 0) {
    return res.status(403).json({ success: false, message: "No valid token available for this batch." });
  }

  const videoUrlPath = `v1/videos/video-url-details?type=BATCHES&videoContainerType=${container}&reqType=query&childId=${childId}&parentId=${batchId}&clientVersion=201`;
  const fullApiUrl = PW_API.endsWith("/")
    ? `${PW_API}${videoUrlPath}`
    : `${PW_API}/${videoUrlPath}`;

  let lastError = "Failed to fetch video URL.";

  for (const { accessToken, randomId } of allTokens) {
    try {
      const pwRes = await fetch(fullApiUrl, {
        headers: getVideoHeaders(accessToken, randomId) as Record<string, string>,
        signal: AbortSignal.timeout(8000),
      });

      if (!pwRes.ok) {
        // Deactivate 401 tokens automatically
        if (pwRes.status === 401 && activeTokens.find((t: any) => t.accessToken === accessToken)) {
          try {
            await Batch.updateOne(
              { batchId, "enrolledTokens.accessToken": accessToken },
              { $set: { "enrolledTokens.$.tokenStatus": false } }
            );
          } catch {}
        }
        lastError = `PW API returned ${pwRes.status}`;
        continue;
      }

      const json = await pwRes.json();
      const url: string = json?.data?.url || "";
      if (!url) {
        lastError = "Empty video URL from PW API";
        continue;
      }

      const signedUrl: string = json?.data?.signedUrl || "";

      // For HLS live streams: build the full signed URL
      // The `url` is the base URL (e.g. https://ddbacdlvl6v94.cloudfront.net/index.m3u8)
      // signedUrl holds the CloudFront signature params (e.g. ?Signature=...&Key-Pair-Id=...&Policy=...)
      return res.status(200).json({
        success: true,
        url,
        signedUrl,
        fullUrl: url + signedUrl,
      });
    } catch (err: any) {
      lastError = err.message || "Fetch error";
    }
  }

  return res.status(502).json({ success: false, message: lastError });
}
