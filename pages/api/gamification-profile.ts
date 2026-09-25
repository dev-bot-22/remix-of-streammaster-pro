// pages/api/gamification-profile.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { authenticateUser } from "@/utils/authenticateUser";
import { getHeaders } from "@/utils/auth";
import Batch from "@/models/Batch";
import dbConnect from "@/lib/mongodb";
import Verification from "@/models/Verification";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const { user_ids } = req.body;
  const batchId = (req.body.batchId || req.body.batchid) as string | undefined;

  if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
    return res.status(400).json({ success: false, message: "`user_ids` array is required in body." });
  }

  if (!batchId || typeof batchId !== "string") {
    return res.status(400).json({ success: false, message: "`batchId` is required in body." });
  }

  // Authenticate user session or verify via anon_id cookie
  let user = null;
  let hasAnonId = false;
  try {
    user = await authenticateUser(req, res);
  } catch (err: any) {
    const anonId = req.cookies?.anon_id;
    if (anonId && typeof anonId === "string" && anonId.trim().length > 0) {
      hasAnonId = true;
    }
  }

  if (!user && !hasAnonId) {
    return res.status(401).json({ success: false, message: "Unauthorized access." });
  }

  let userAccessToken = "";
  let randomId = "";
  if (user) {
    userAccessToken = user.ActualToken || "";
    randomId = user.randomId || "";
  }

  await dbConnect();
  let batch = null;
  try {
    batch = await Batch.findOne({ batchId }).lean() as any;
  } catch (err) {
    console.warn("[gamification-profile] Failed to fetch batch details");
  }

  const enrolledTokens = batch?.enrolledTokens || [];
  const activeTokens = enrolledTokens.filter(
    (t: any) => t.tokenStatus === true && !!t.accessToken
  );

  let successData = null;
  let finalStatus = 403;
  let finalMessage = "No valid token available for this batch.";

  // Try batch enrolled tokens first with self-healing deactivation on 401
  for (const tokenObj of activeTokens) {
    const currentToken = tokenObj.accessToken;
    const currentRandomId = tokenObj.randomId || randomId;

    try {
      const response = await fetch("https://api.penpencil.co/student-engagement-core/private/v1/gamification/user/profile", {
        method: "POST",
        headers: {
          "authorization": "Bearer " + currentToken,
          "client-id": "5eb393ee95fab7468a79d189",
          "client-type": "WEB",
          "content-type": "application/json",
          "origin": "https://www.pw.live",
          "referer": "https://www.pw.live/",
          "randomid": currentRandomId,
          "x-sdk-version": "0.0.13-alpha.10",
        },
        body: JSON.stringify({ user_ids }),
      });

      if (response.ok) {
        successData = await response.json();
        break; // Success!
      } else {
        const errText = await response.text();
        console.warn(`[gamification-profile] Token ${tokenObj.randomId} returned status ${response.status}: ${errText}`);
        if (response.status === 401) {
          try {
            await Batch.updateOne(
              { batchId, "enrolledTokens.accessToken": currentToken },
              { $set: { "enrolledTokens.$.tokenStatus": false } }
            );
            console.log(`[gamification-profile] Deactivated expired token ${tokenObj.randomId} in DB.`);
          } catch (dbErr: any) {
            console.error("[gamification-profile] Failed to deactivate expired token:", dbErr.message);
          }
        }
        finalStatus = response.status;
        finalMessage = "Failed to fetch gamification profile.";
      }
    } catch (fetchErr: any) {
      console.warn(`[gamification-profile] Fetch failed with token ${tokenObj.randomId}: ${fetchErr.message}`);
      finalStatus = 500;
      finalMessage = "Internal server error.";
    }
  }

  // Fallback to user's token if batch tokens failed
  if (!successData && user && userAccessToken) {
    try {
      const response = await fetch("https://api.penpencil.co/student-engagement-core/private/v1/gamification/user/profile", {
        method: "POST",
        headers: {
          "authorization": "Bearer " + userAccessToken,
          "client-id": "5eb393ee95fab7468a79d189",
          "client-type": "WEB",
          "content-type": "application/json",
          "origin": "https://www.pw.live",
          "referer": "https://www.pw.live/",
          "randomid": randomId,
          "x-sdk-version": "0.0.13-alpha.10",
        },
        body: JSON.stringify({ user_ids }),
      });

      if (response.ok) {
        successData = await response.json();
      } else {
        finalStatus = response.status;
        finalMessage = "Failed to fetch gamification profile.";
      }
    } catch (fetchErr: any) {
      finalStatus = 500;
      finalMessage = "Internal server error.";
    }
  }

  if (successData) {
    return res.status(200).json(successData);
  } else {
    return res.status(finalStatus).json({ success: false, message: finalMessage });
  }
}
