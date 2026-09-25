import type { NextApiRequest, NextApiResponse } from "next";
import { Buffer } from "buffer";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { hex } = req.query;

  if (!hex || typeof hex !== "string") {
    return res.status(400).json({ error: "Missing key hex" });
  }

  // Convert the 32-character hex key string to a 16-byte raw binary buffer
  const keyBuffer = Buffer.from(hex, "hex");

  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Length", keyBuffer.length);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

  return res.status(200).send(keyBuffer);
}
