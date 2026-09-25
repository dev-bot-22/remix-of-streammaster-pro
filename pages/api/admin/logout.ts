import type { NextApiRequest, NextApiResponse } from "next";
import { clearAdminCookieString } from "@/lib/adminAuth";

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Set-Cookie", [clearAdminCookieString()]);
  return res.status(200).json({ success: true });
}
