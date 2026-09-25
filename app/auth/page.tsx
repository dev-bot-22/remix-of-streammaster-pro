import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import Login from "./login"; // Client login component (only used when login mode is ON)
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getAppSettings } from "@/lib/appSettings";

export default async function AuthPage() {
  // Guest mode (default): there is no login at all — send visitors straight in.
  const { loginEnabled } = await getAppSettings();
  if (!loginEnabled) redirect("/study");

  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;

  if (token) {
    try {
      const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "pw-marco-dev-secret");
      await jwtVerify(token, SECRET);
      redirect("/study");
    } catch {
      // Invalid token, show login page
    }
  }

  return (
    <Suspense fallback={<div className="text-center text-gray-500 py-8">Loading authorization...</div>}>
      <Login />
    </Suspense>
  );
}
