// pages/api/nebula/stream-conversation.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { authenticateUser } from "@/utils/authenticateUser";
import { getHeaders } from "@/utils/auth";

const PW_NEBULA_STREAM_API = "https://api.penpencil.co";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
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

  try {
    const url = `${PW_NEBULA_STREAM_API}/v1/nebula/stream/conversation`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        ...getHeaders(token),
        "client-id": "5eb393ee95fab7468a79d189",
        "client-type": "WEB",
        "content-type": "application/json",
        "x-sdk-version": "0.0.28",
      },
      body: JSON.stringify(req.body),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ success: false, message: errText });
    }

    // Set headers for SSE stream
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    });

    if (!response.body) {
      res.end();
      return;
    }

    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
      if ((res as any).flush) {
        (res as any).flush();
      }
    }
    res.end();
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Internal server error" });
  }
}
