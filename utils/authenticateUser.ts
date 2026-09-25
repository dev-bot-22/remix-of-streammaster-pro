// utils/authenticateUser.ts
// Returns the "session user" for an API request.
//
//  * Login mode OFF (default): a permanent guest session is used and the PW
//    token comes from the global StudySpark token.
//  * Login mode ON: the classic JWT cookie flow is used and the user's own PW
//    token is returned.
import type { NextApiRequest, NextApiResponse } from "next";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { getAppSettings } from "@/lib/appSettings";
import { getGlobalToken } from "@/lib/tokenProvider";
import { addEnrollment, getOrCreateGuest, listEnrollments, removeEnrollment } from "@/lib/guest";

const JWT_SECRET = process.env.JWT_SECRET || "pw-marco-dev-secret";
const JWT_ACCESS_EXPIRES_SECONDS = Number(process.env.JWT_ACCESS_EXPIRES_SECONDS || 900);
const JWT_REFRESH_EXPIRES_DAYS = Number(process.env.JWT_REFRESH_EXPIRES_DAYS || 30);

export type SessionUser = {
  _id: string;
  UserName: string;
  phoneNumber?: string;
  photoUrl?: string | null;
  telegramId?: string | null;
  isGuest: boolean;
  ActualToken?: string | null;
  ActualRefresh?: string | null;
  randomId?: string | null;
  enrolledBatches: { batchId: string; name: string }[];
  save?: () => Promise<any>;
  [key: string]: any;
};

type JwtPayload = {
  userId: string;
  name: string;
  telegramId: string;
  PhotoUrl: string;
};

const generateAccessToken = (payload: JwtPayload) =>
  jwt.sign(payload, JWT_SECRET, { expiresIn: `${JWT_ACCESS_EXPIRES_SECONDS}s` });

const generateRefreshToken = () => crypto.randomBytes(32).toString("hex");

export function clearAuthCookies(res: NextApiResponse) {
  res.setHeader("Set-Cookie", [
    "accessToken=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax",
    "refreshToken=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax",
  ]);
}

function setAuthCookies(res: NextApiResponse, accessToken: string, refreshToken: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", [
    `accessToken=${accessToken}; Path=/; HttpOnly; Max-Age=${JWT_ACCESS_EXPIRES_SECONDS}; SameSite=Lax${secure}`,
    `refreshToken=${refreshToken}; Path=/; HttpOnly; Max-Age=${JWT_REFRESH_EXPIRES_DAYS * 86400}; SameSite=Lax${secure}`,
  ]);
}

/** Guest session user backed by the global token. */
export async function getGuestSessionUser(
  req: NextApiRequest,
  res?: NextApiResponse
): Promise<SessionUser> {
  const guest = await getOrCreateGuest(req, res);
  const token = await getGlobalToken();
  const enrollments = await listEnrollments(guest.id);
  const sessionUser: SessionUser = {
    _id: guest.id,
    UserName: guest.label,
    phoneNumber: "",
    photoUrl: null,
    telegramId: null,
    isGuest: true,
    ActualToken: token.accessToken,
    ActualRefresh: token.refreshToken,
    randomId: token.randomId,
    enrolledBatches: enrollments.map((e) => ({ batchId: e.batchId, name: e.batchName })),
  };

  // `save()` syncs whatever the caller did to enrolledBatches back into the
  // guest_enrollments table, so existing enroll/unenroll code keeps working.
  sessionUser.save = async () => {
    const wanted = (sessionUser.enrolledBatches || []).filter((b: any) => b?.batchId);
    const existing = await listEnrollments(guest.id);
    for (const b of wanted) {
      await addEnrollment(guest.id, { batchId: String(b.batchId), batchName: b.name || "" });
    }
    for (const e of existing) {
      if (!wanted.some((b: any) => String(b.batchId) === e.batchId)) {
        await removeEnrollment(guest.id, e.batchId);
      }
    }
    return sessionUser;
  };

  return sessionUser;
}

export async function authenticateUser(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<SessionUser> {
  await dbConnect();

  const { loginEnabled } = await getAppSettings();
  if (!loginEnabled) return getGuestSessionUser(req, res);

  // Login mode ON: any leftover guest session is revoked immediately.
  if (req.cookies?.guest_id) {
    const prev = res.getHeader("Set-Cookie");
    const kill = "guest_id=; Path=/; Max-Age=0; SameSite=Lax";
    res.setHeader(
      "Set-Cookie",
      Array.isArray(prev) ? [...prev, kill] : prev ? [String(prev), kill] : kill
    );
  }

  const accessToken = req.cookies?.accessToken;
  const refreshToken = req.cookies?.refreshToken;

  if (!accessToken || !refreshToken) {
    clearAuthCookies(res);
    throw new Error("Unauthorized: No tokens provided");
  }

  try {
    const decoded = jwt.verify(accessToken, JWT_SECRET) as JwtPayload;
    const user = (await User.findById(decoded.userId)) as SessionUser | null;
    if (!user) throw new Error("User not found");
    user.isGuest = false;
    return user;
  } catch (err: any) {
    if (err?.name !== "TokenExpiredError") {
      clearAuthCookies(res);
      throw new Error("Unauthorized: Invalid access token");
    }

    const decoded = jwt.verify(accessToken, JWT_SECRET, { ignoreExpiration: true }) as JwtPayload;
    const user = (await User.findById(decoded.userId)) as SessionUser | null;
    if (!user) {
      clearAuthCookies(res);
      throw new Error("User not found");
    }
    if (user.refreshToken !== refreshToken) {
      clearAuthCookies(res);
      throw new Error("Unauthorized: Refresh token mismatch");
    }

    const payload: JwtPayload = {
      userId: String(user._id),
      name: user.UserName,
      telegramId: user.telegramId || "",
      PhotoUrl: user.photoUrl || "",
    };
    const newAccess = generateAccessToken(payload);
    const newRefresh = generateRefreshToken();
    user.refreshToken = newRefresh;
    await user.save?.();
    setAuthCookies(res, newAccess, newRefresh);
    user.isGuest = false;
    return user;
  }
}

export { generateAccessToken, generateRefreshToken, setAuthCookies };
export default authenticateUser;
