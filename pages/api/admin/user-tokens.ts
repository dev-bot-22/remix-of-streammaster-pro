// pages/api/admin/user-tokens.ts
// Tokens saved for users who logged in while Login Mode was ON.
// Tokens are masked by default; ?reveal=1 returns the full token.
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminApi } from "@/lib/adminAuth";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

function mask(token?: string | null) {
  if (!token) return null;
  if (token.length <= 18) return "********";
  return `${token.slice(0, 10)}…${token.slice(-6)}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdminApi(req, res)) return;

  try {
    await dbConnect();

    if (req.method === "GET") {
      const reveal = req.query.reveal === "1";
      const search = String(req.query.search || "").trim();
      const id = String(req.query.id || "").trim();

      if (id) {
        const user: any = await User.findById(id).lean();
        if (!user) return res.status(404).json({ message: "User not found" });
        return res.status(200).json({
          user: {
            id: user._id,
            name: user.UserName,
            phoneNumber: user.phoneNumber,
            accessToken: reveal ? user.ActualToken : mask(user.ActualToken),
            refreshToken: reveal ? user.ActualRefresh : mask(user.ActualRefresh),
            randomId: user.randomId,
            updatedAt: user.updatedAt,
          },
        });
      }

      const filter: any = search
        ? {
            $or: [
              { UserName: { $regex: search, $options: "i" } },
              { phoneNumber: { $regex: search, $options: "i" } },
            ],
          }
        : {};

      const users: any[] = (await User.find(filter).sort({ updatedAt: -1 }).limit(200).lean()) as any[];

      return res.status(200).json({
        total: users.length,
        users: users.map((u) => ({
          id: u._id,
          name: u.UserName,
          phoneNumber: u.phoneNumber,
          hasToken: Boolean(u.ActualToken),
          accessToken: reveal ? u.ActualToken : mask(u.ActualToken),
          refreshToken: reveal ? u.ActualRefresh : mask(u.ActualRefresh),
          randomId: u.randomId,
          enrolledBatches: (u.enrolledBatches || []).length,
          lastUpdated: u.updatedAt,
        })),
      });
    }

    return res.status(405).json({ message: "Method not allowed" });
  } catch (err: any) {
    console.error("[admin/user-tokens]", err);
    return res.status(500).json({ message: err?.message || "Internal server error" });
  }
}
