// utils/verifyUser.ts
// Same idea as authenticateUser, but for read-only checks (no cookie refresh).
import type { NextApiRequest, NextApiResponse } from "next";
import jwt from "jsonwebtoken";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { getAppSettings } from "@/lib/appSettings";
import { getGuestSessionUser, type SessionUser } from "@/utils/authenticateUser";

const JWT_SECRET = process.env.JWT_SECRET || "pw-marco-dev-secret";

export const verifyUser = async (
  req: NextApiRequest,
  res?: NextApiResponse
): Promise<SessionUser> => {
  await dbConnect();

  const { loginEnabled } = await getAppSettings();
  if (!loginEnabled) return getGuestSessionUser(req, res);

  const token = req.cookies?.accessToken;
  if (!token) throw new Error("Unauthorized: No token provided");

  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    const user = (await User.findById(decoded.userId)) as SessionUser | null;
    if (!user) throw new Error("User not found");
    user.isGuest = false;
    return user;
  } catch (err: any) {
    console.error("Token verification failed:", err?.message || err);
    throw new Error("Unauthorized: Invalid or expired token");
  }
};

export default verifyUser;
