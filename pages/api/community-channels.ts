// pages/api/community-channels.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { authenticateUser } from "@/utils/authenticateUser";
import { getHeaders } from "@/utils/auth";
import Batch from "@/models/Batch";
import Verification from "@/models/Verification";
import dbConnect from "@/lib/mongodb";

const PW_COMMUNITY_API = "https://pw-api-gate.penpencil.co";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const batchId = (req.query.batchId || req.query.batchid) as string | undefined;

  if (!batchId || typeof batchId !== "string") {
    return res.status(400).json({ success: false, message: "`batchId` is required." });
  }

  // Authenticate user session or verify via anon_id
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
    return res.status(401).json({ success: false, message: "Unauthorized access. Please verify or login." });
  }

  // Get the best available access token: batch enrolled token first, then user's own
  let accessToken = "";
  let randomId = "";

  if (user) {
    accessToken = user.ActualToken || "";
    randomId = user.randomId || "";
  }

  await dbConnect();
  let batch = null;
  try {
    batch = await Batch.findOne({ batchId }).lean() as any;
  } catch (err) {
    console.warn("[community-channels] Failed to fetch batch details");
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
      const url = `${PW_COMMUNITY_API}/v3/community/channels/batch/${batchId}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          ...getHeaders(currentToken),
          randomid: currentRandomId,
          "x-sdk-version": "0.0.13-alpha.10",
          "cache-control": "no-cache",
          pragma: "no-cache",
          origin: "https://www.pw.live",
          referer: "https://www.pw.live/",
        },
      });

      if (response.ok) {
        successData = await response.json();
        break; // Success!
      } else {
        const errText = await response.text();
        console.warn(`[community-channels] Token ${tokenObj.randomId} returned status ${response.status}: ${errText}`);
        if (response.status === 401) {
          try {
            await Batch.updateOne(
              { batchId, "enrolledTokens.accessToken": currentToken },
              { $set: { "enrolledTokens.$.tokenStatus": false } }
            );
            console.log(`[community-channels] Deactivated expired token ${tokenObj.randomId} in DB.`);
          } catch (dbErr: any) {
            console.error("[community-channels] Failed to deactivate expired token:", dbErr.message);
          }
        }
        finalStatus = response.status;
        finalMessage = "Failed to fetch community channels.";
      }
    } catch (fetchErr: any) {
      console.warn(`[community-channels] Fetch failed with token ${tokenObj.randomId}: ${fetchErr.message}`);
      finalStatus = 500;
      finalMessage = "Internal server error.";
    }
  }

  // Fallback to user's token if batch tokens failed
  if (!successData && user && accessToken) {
    try {
      const url = `${PW_COMMUNITY_API}/v3/community/channels/batch/${batchId}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          ...getHeaders(accessToken),
          randomid: randomId,
          "x-sdk-version": "0.0.13-alpha.10",
          "cache-control": "no-cache",
          pragma: "no-cache",
          origin: "https://www.pw.live",
          referer: "https://www.pw.live/",
        },
      });

      if (response.ok) {
        successData = await response.json();
      } else {
        finalStatus = response.status;
        finalMessage = "Failed to fetch community channels.";
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
