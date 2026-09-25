import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { getAppSettings } from "@/lib/appSettings";
import { GUEST_COOKIE, guestCookieString, newGuestId, touchGuest } from "@/lib/guest";

export async function GET(req: NextRequest) {
  const { loginEnabled } = await getAppSettings();

  // Guest mode: everyone is "authenticated" through a permanent guest session.
  if (!loginEnabled) {
    let id = req.cookies.get(GUEST_COOKIE)?.value;
    let created = false;
    if (!id || !/^[a-f0-9]{16,64}$/i.test(id)) {
      id = newGuestId();
      created = true;
    }
    const guest = await touchGuest(id, {
      userAgent: req.headers.get("user-agent") || undefined,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    });
    const res = NextResponse.json({
      authenticated: true,
      guest: true,
      guestId: guest.id,
      name: guest.label,
    });
    if (created) res.headers.append("Set-Cookie", guestCookieString(guest.id));
    return res;
  }

  const clearGuest = (r: NextResponse) => {
    r.headers.append("Set-Cookie", `${GUEST_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`);
    return r;
  };

  const token = req.cookies.get("accessToken")?.value;
  if (!token) {
    return clearGuest(NextResponse.json({ authenticated: false, guest: false }, { status: 401 }));
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || "pw-marco-dev-secret");
    await jwtVerify(token, secret);
    return NextResponse.json({ authenticated: true, guest: false });
  } catch {
    return clearGuest(NextResponse.json({ authenticated: false, guest: false }, { status: 401 }));
  }
}
