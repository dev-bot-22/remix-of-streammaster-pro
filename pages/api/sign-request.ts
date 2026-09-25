// pages/api/sign-request.ts
// Generates a short-lived HMAC signature for calling /api/get-url from client-side pages
// (e.g. /live page which has no Schedule API step to pre-sign the request)
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { authenticateUser } from "@/utils/authenticateUser";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const { childId } = req.query;
  if (!childId || typeof childId !== "string") {
    return res.status(400).json({ success: false, message: "`childId` is required." });
  }

  // Must be authenticated to get a signature
  try {
    await authenticateUser(req, res);
  } catch (err: any) {
    return res.status(401).json({ success: false, message: err.message || "Unauthorized" });
  }

  const timestamp = Date.now();
  const secret = process.env.JWT_SECRET || "fallback_secret";
  const signData = `${childId}:${timestamp}`;
  const signature = crypto.createHmac("sha256", secret).update(signData).digest("hex");

  return res.status(200).json({ success: true, signature, timestamp });
}
