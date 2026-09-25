// utils/fetchWithAuth.ts

export const fetchWithAuth = async (
  input: RequestInfo,
  init: RequestInit = {}
): Promise<Response> => {
  const res = await fetch(input, {
    ...init,
    credentials: "include", // very important to send cookies
  });

  if (res.status === 401) {
    // In guest mode (login OFF) a 401 means PW rejected the shared token, not
    // that the visitor is logged out — never bounce to /auth (causes a loop).
    let guest = false;
    try {
      const c = await fetch("/api/auth/check", { credentials: "include", cache: "no-store" });
      guest = c.ok && Boolean((await c.json())?.guest);
    } catch {}
    if (!guest && typeof window !== "undefined") {
      localStorage.clear();
      window.location.href = "/auth";
    }
  }

  return res;
};
