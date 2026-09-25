// pages/api/Schedule.ts
import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import crypto from "crypto";
import { getHeaders } from "@/utils/auth";
import { authenticateUser, clearAuthCookies } from "@/utils/authenticateUser";

const MASTER_TOKEN = process.env.MASTER_DPP_TOKEN || "";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Verify user token before proceeding
    const user = await authenticateUser(req, res);
    let ActualToken = user.ActualToken;
    const PW_API = process.env.PW_API;
    const { BatchId, SubjectId, ContentId } = req.query;

    // Validate required params first
    const errors: string[] = [];

    if (!BatchId) errors.push("`BatchId`");
    if (!SubjectId) errors.push("`SubjectId`");
    if (!ContentId) errors.push("`ContentId`");

    if (errors.length > 0) {
      return res
        .status(400)
        .json({ message: `Missing or invalid: ${errors.join(", ")}` });
    }

    // Normalize all fields
    const batchIdStr = Array.isArray(BatchId) ? BatchId[0] : BatchId ?? "";
    const subjectIdStr = Array.isArray(SubjectId)
      ? SubjectId[0]
      : SubjectId ?? "";
    const topicIdStr = Array.isArray(ContentId)
      ? ContentId[0]
      : ContentId ?? "";

    const url =
      PW_API +
      `/v1/batches/${batchIdStr}/subject/${subjectIdStr}/schedule/${ContentId}/schedule-details`;

    // Try with user's own token first
    try {
      const response = await axios.get(url, {
        headers: getHeaders(ActualToken),
        timeout: 8000,
      });

      const data = response.data?.data;
      return res.status(200).json(signScheduleResponse(data, topicIdStr));
    } catch (userTokenErr: any) {
      const userStatus = userTokenErr.response?.status;
      console.log(`[Schedule] User token failed (${userStatus}), trying master token...`);

      // If user token fails with 401/403/400, try the master token
      if (MASTER_TOKEN && (userStatus === 401 || userStatus === 403 || userStatus === 400)) {
        try {
          const masterResponse = await axios.get(url, {
            headers: getHeaders(MASTER_TOKEN),
            timeout: 8000,
          });

          const data = masterResponse.data?.data;
          return res.status(200).json(signScheduleResponse(data, topicIdStr));
        } catch (masterErr: any) {
          console.error(`[Schedule] Master token also failed:`, masterErr.response?.status, masterErr.response?.data?.message);
          // Fall through to the error handling below
        }
      }

      // Re-throw the original error if master token didn't work
      throw userTokenErr;
    }
  } catch (error: any) {
    const status = error.response?.status || 500;

    // 🚨 Handle 401 from downstream API
    if (status === 401) {
      clearAuthCookies(res);
    }

    return res.status(status).json({
      message: error.response?.data?.message || "Error fetching DataX",
    });
  }
}

function signScheduleResponse(data: any, contentId: string) {
  const timestamp = Date.now();
  const secret = process.env.JWT_SECRET || "fallback_secret";
  const signData = `${contentId}:${timestamp}`;
  const signature = crypto.createHmac("sha256", secret).update(signData).digest("hex");
  return {
    success: true,
    data,
    videoSignature: signature,
    videoTimestamp: timestamp,
  };
}
