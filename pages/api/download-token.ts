import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import downloadDbConnect from "../../lib/downloadDb";
import { getDownloadTokenModel } from "../../models/DownloadToken";
import { rateLimit } from "@/utils/rateLimiter";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const ip = ((req.headers["x-forwarded-for"] as string) || "").split(",")[0].trim() || req.socket.remoteAddress || "127.0.0.1";
  if (!rateLimit(ip, 10, 60 * 1000)) {
    return res.status(429).json({ success: false, message: "Too many requests. Please try again later." });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  let { videoUrl, lectureName, thumbnail, duration } = req.body;

  if (!videoUrl || !lectureName) {
    return res.status(400).json({ success: false, message: "videoUrl and lectureName are required" });
  }

  // Convert to stream.pimaxer.in URL format if a UUID is present in the videoUrl
  const uuidMatch = videoUrl.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  if (uuidMatch) {
    const uuid = uuidMatch[1];
    videoUrl = `https://stream.pimaxer.in/${uuid}/master.m3u8`;
    console.log(`[download-token] Converted videoUrl to stream.pimaxer.in format: ${videoUrl}`);
  }

  try {
    // Connect to the download tokens database connection
    const conn = await downloadDbConnect();
    const DownloadToken = getDownloadTokenModel(conn);

    // Generate a secure random UUID token
    const tokenId = `dl_${crypto.randomUUID().replace(/-/g, "")}`;

    // Create the short-lived download token document
    await DownloadToken.create({
      tokenId,
      videoUrl,
      lectureName,
      thumbnail,
      duration: duration ? parseFloat(duration) : undefined,
    });

    return res.status(200).json({ success: true, tokenId });
  } catch (err: any) {
    console.error("[api/download-token] Error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error: " + err.message });
  }
}
