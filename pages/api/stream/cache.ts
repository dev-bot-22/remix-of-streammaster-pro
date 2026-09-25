import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/mongodb";
import VideoStream from "@/models/VideoStream";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { uuid, signedQuery, keyHex } = req.body;

  if (!uuid || !signedQuery) {
    return res.status(400).json({ error: "uuid and signedQuery are required" });
  }

  try {
    // Parse the Expires timestamp from the signed query to set TTL
    const expiresMatch = signedQuery.match(/Expires=(\d+)/);
    const expiresAt = expiresMatch
      ? new Date(parseInt(expiresMatch[1]) * 1000)
      : new Date(Date.now() + 6 * 60 * 60 * 1000); // default 6h

    await dbConnect();
    await VideoStream.findOneAndUpdate(
      { uuid },
      { uuid, signedQuery, expiresAt, keyHex: keyHex || "" },
      { upsert: true, new: true }
    );

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error("[stream-cache] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
