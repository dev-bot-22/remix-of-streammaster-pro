// pages/api/subjectInfo.ts
import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import { authenticateUser, clearAuthCookies } from "@/utils/authenticateUser";
import { getHeaders } from "@/utils/auth";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Verify user token before proceeding
    const user = await authenticateUser(req, res);
    let ActualToken = user.ActualToken;

    const { BatchId, SubjectId, batchTagType } = req.query;
    const PW_API = (process.env.PW_API || "https://api.penpencil.co");

    if (!BatchId || typeof BatchId !== "string") {
      return res
        .status(400)
        .json({ message: "Missing or invalid `BatchId` query" });
    }
    if (!SubjectId || typeof SubjectId !== "string") {
      return res
        .status(400)
        .json({ message: "Missing or invalid `SubjectId` query" });
    }
    const pageRaw = req.query.page;
    const pageStr = Array.isArray(pageRaw) ? pageRaw[0] : pageRaw;
    const pageNumber = parseInt(pageStr ?? "1", 10);

    const tagType = typeof batchTagType === "string" ? batchTagType : "UNITS";

    let resolvedSubjectId = SubjectId;
    const isObjectId = (id: string) => /^[0-9a-fA-F]{24}$/.test(id);

    // Resolve subject slug if necessary
    if (!isObjectId(resolvedSubjectId)) {
      console.log(`SubjectInfo API: Resolving subject slug: ${resolvedSubjectId}`);
      const detailsUrl = `${PW_API}/v3/batches/${BatchId}/details`;
      const detailsRes = await axios.get(detailsUrl, {
        headers: getHeaders(ActualToken ?? ""),
        timeout: 10000,
      });
      const subjects = detailsRes.data?.data?.subjects || [];
      const matchedSubject = subjects.find(
        (sub: any) => sub.slug === resolvedSubjectId || sub._id === resolvedSubjectId
      );
      if (matchedSubject) {
        resolvedSubjectId = matchedSubject._id;
        console.log(`SubjectInfo API: Resolved subject slug to ID: ${resolvedSubjectId}`);
      } else {
        return res.status(404).json({
          message: `Subject with slug "${resolvedSubjectId}" not found in batch.`,
        });
      }
    }

    // Use the v1 batch-tags API for units/study material
    const url = `https://api.penpencil.co/batch-service/v1/batch-tags/${BatchId}/subject/${resolvedSubjectId}/topics?page=${pageNumber}&batchTagType=${tagType}&limit=20`;

    console.log(`SubjectInfo API calling: ${url}`);
    const response = await axios.get(url, {
      headers: getHeaders(ActualToken ?? ""),
    });

    return res.status(200).json({
      data: response.data?.data || [],
    });
  } catch (error: any) {
    const status = error.response?.status || 500;

    // 🚨 Handle 401 from downstream API
    if (status === 401) {
      clearAuthCookies(res);
    }

    return res.status(status).json({
      message: error.response?.data?.message || "Error fetching Subjects",
    });
  }
}
