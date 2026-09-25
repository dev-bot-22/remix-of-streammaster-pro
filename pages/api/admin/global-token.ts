// pages/api/admin/global-token.ts
// GET  -> status of the global StudySpark token
// POST -> force refresh (and optionally test the PW APIs with it)
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminApi } from "@/lib/adminAuth";
import { getGlobalToken, getGlobalTokenStatus } from "@/lib/tokenProvider";

const BASE_URL = "https://api.penpencil.co";

async function testApis(accessToken: string, randomId: string) {
  const headers = {
    accept: "application/json, text/plain, */*",
    authorization: `Bearer ${accessToken}`,
    "client-id": "5eb393ee95fab7468a79d189",
    "client-type": "WEB",
    "client-version": "1.1.1",
    randomid: randomId,
  } as Record<string, string>;

  const checks: { name: string; url: string }[] = [
    { name: "My batches", url: `${BASE_URL}/v3/batches/my-batches?page=1` },
    { name: "User profile", url: `${BASE_URL}/v1/users/user-profile-info?fields=cohortId` },
    {
      name: "Batch details",
      url: `${BASE_URL}/v3/batches/6aaa69aa33cdd45944168874/details`,
    },
    {
      name: "Today's schedule",
      url: `${BASE_URL}/v1/batches/6aaa69aa33cdd45944168874/todays-schedule?isNewStudyMaterialFlow=true`,
    },
  ];

  return Promise.all(
    checks.map(async (c) => {
      try {
        const r = await fetch(c.url, { headers, cache: "no-store" });
        const text = await r.text();
        let ok = r.ok;
        try {
          ok = ok && JSON.parse(text)?.success !== false;
        } catch {
          ok = false;
        }
        return { name: c.name, status: r.status, ok };
      } catch (err: any) {
        return { name: c.name, status: 0, ok: false, error: err?.message };
      }
    })
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdminApi(req, res)) return;

  try {
    if (req.method === "GET") {
      return res.status(200).json(await getGlobalTokenStatus());
    }

    if (req.method === "POST") {
      const token = await getGlobalToken(true);
      const status = await getGlobalTokenStatus();
      const runTests = req.query.test === "1" || req.body?.test === true;
      return res.status(200).json({
        success: true,
        status,
        tests: runTests ? await testApis(token.accessToken, token.randomId) : undefined,
      });
    }

    return res.status(405).json({ message: "Method not allowed" });
  } catch (err: any) {
    console.error("[admin/global-token]", err);
    return res.status(500).json({ message: err?.message || "Token refresh failed" });
  }
}
