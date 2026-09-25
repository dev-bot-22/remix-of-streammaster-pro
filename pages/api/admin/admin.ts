// pages/api/admin/admin.ts — admin login (credentials come from env vars).
import type { NextApiRequest, NextApiResponse } from "next";
import {
  adminConfigured,
  adminCookieString,
  checkAdminCredentials,
  signAdminToken,
} from "@/lib/adminAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ message: "Username and password required" });
  }

  if (!adminConfigured()) {
    return res.status(500).json({
      message: "Admin not configured. Set ADMIN_USERNAME and ADMIN_PASSWORD environment variables.",
    });
  }

  if (!checkAdminCredentials(String(username), String(password))) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  res.setHeader("Set-Cookie", [adminCookieString(signAdminToken(String(username)))]);
  return res.status(200).json({ success: true });
}
