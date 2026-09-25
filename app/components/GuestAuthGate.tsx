"use client";

// When the admin turns Login ON, any visitor still browsing on a guest session
// is signed out (guest cookie removed) and sent to /auth.
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function GuestAuthGate() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    if (pathname.startsWith("/auth") || pathname.startsWith("/admin")) return;

    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch("/api/auth/check", { credentials: "include", cache: "no-store" });
        if (cancelled) return;
        if (res.status === 401) {
          document.cookie = "guest_id=; Path=/; Max-Age=0; SameSite=Lax";
          router.replace("/auth");
        }
      } catch {
        /* offline — keep the page as-is */
      }
    };
    check();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  return null;
}
