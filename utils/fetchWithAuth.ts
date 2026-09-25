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
    if (typeof window !== "undefined") {
      localStorage.clear();
      window.location.href = "/auth";
    }
  }

  return res;
};
