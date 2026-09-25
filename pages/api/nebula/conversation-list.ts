// pages/api/nebula/conversation-list.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { authenticateUser } from "@/utils/authenticateUser";
import { getHeaders } from "@/utils/auth";

const PW_NEBULA_API = "https://api.penpencil.co";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  let user: any = null;
  try {
    user = await authenticateUser(req, res);
  } catch (err: any) {
    return res.status(401).json({ success: false, message: "Unauthorized access." });
  }

  const token = user?.ActualToken || "";
  if (!token) {
    return res.status(403).json({ success: false, message: "No actual token available." });
  }

  const type = req.query.type || "ACADEMIC";

  try {
    const url = `${PW_NEBULA_API}/student-engagement-core/private/v1/nebula/conversation-list?type=${type}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        ...getHeaders(token),
        "client-id": "5eb393ee95fab7468a79d189",
        "client-type": "WEB",
        "x-sdk-version": "0.0.28",
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ success: false, message: errText });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Internal server error" });
  }
}
