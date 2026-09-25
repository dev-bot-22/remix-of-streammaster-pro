// pages/api/community-comments.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { authenticateUser } from "@/utils/authenticateUser";
import { getHeaders } from "@/utils/auth";
import Batch from "@/models/Batch";
import dbConnect from "@/lib/mongodb";

const PW_API = "https://api.penpencil.co";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const { postId, limit = "10", skip = "0", batchId } = req.query;

  if (!postId || typeof postId !== "string") {
    return res.status(400).json({ success: false, message: "`postId` is required." });
  }

  let user = null;
  let hasAnonId = false;
  try {
    user = await authenticateUser(req, res);
  } catch {
    const anonId = req.cookies?.anon_id;
    if (anonId && typeof anonId === "string" && anonId.trim().length > 0) {
      hasAnonId = true;
    }
  }

  if (!user && !hasAnonId) {
    return res.status(401).json({ success: false, message: "Unauthorized access." });
  }

  let userAccessToken = user?.ActualToken || "";

  await dbConnect();

  let successData = null;

  // Try batch enrolled tokens first
  if (batchId && typeof batchId === "string") {
    try {
      const batch = await Batch.findOne({ batchId }).lean() as any;
      const activeTokens = (batch?.enrolledTokens || []).filter(
        (t: any) => t.tokenStatus === true && !!t.accessToken
      );

      for (const tokenObj of activeTokens) {
        try {
          const url = `${PW_API}/v1/comments/${postId}?type=COMMUNITY&limit=${limit}&skip=${skip}`;
          const response = await fetch(url, {
            method: "GET",
            headers: {
              ...getHeaders(tokenObj.accessToken),
              randomid: tokenObj.randomId || "",
            },
          });

          if (response.ok) {
            successData = await response.json();
            break;
          } else if (response.status === 401) {
            // Deactivate expired token
            try {
              await Batch.updateOne(
                { batchId, "enrolledTokens.accessToken": tokenObj.accessToken },
                { $set: { "enrolledTokens.$.tokenStatus": false } }
              );
            } catch {}
          }
        } catch {}
      }
    } catch {
      console.warn("[community-comments] Failed to fetch batch");
    }
  }

  // Fallback to user's own token
  if (!successData && userAccessToken) {
    try {
      const url = `${PW_API}/v1/comments/${postId}?type=COMMUNITY&limit=${limit}&skip=${skip}`;
      const response = await fetch(url, {
        method: "GET",
        headers: { ...getHeaders(userAccessToken) },
      });
      if (response.ok) {
        successData = await response.json();
      }
    } catch {}
  }

  if (successData) {
    return res.status(200).json(successData);
  }

  return res.status(500).json({ success: false, message: "Failed to fetch comments." });
}
