import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import { getHeaders } from "@/utils/auth";
import { authenticateUser, clearAuthCookies } from "@/utils/authenticateUser";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { ProgramId, Type, SubjectId, ChapterId, page, limit } = req.query;

  if (!ProgramId || !Type) {
    return res.status(400).json({ message: "Missing Required Payloads" });
  }

  const typeStr = String(Type);
  const programIdStr = String(ProgramId);

  if (
    typeStr !== "filters" &&
    typeStr !== "teachers" &&
    typeStr !== "chapters" &&
    typeStr !== "topics"
  ) {
    return res.status(400).json({ message: "Invalid Type parameter" });
  }

  const PW_API = process.env.PW_API;
  let url = "";
  if (typeStr === "filters") {
    url = `${PW_API}/v2/programs/${programIdStr}/filters?page=1&limit=20`;
  } else if (typeStr === "teachers") {
    url = `${PW_API}/v2/programs/${programIdStr}/teachers?popular=false&page=1&limit=100`;
  } else if (typeStr === "chapters") {
    if (!SubjectId) {
      return res.status(400).json({ message: "Missing SubjectId parameter for chapters Type" });
    }
    const pageNum = page ? String(page) : "1";
    const limitNum = limit ? String(limit) : "20";
    url = `${PW_API}/v2/programs/${programIdStr}/subjects/${String(SubjectId)}/chapters/list?page=${pageNum}&limit=${limitNum}`;
  } else if (typeStr === "topics") {
    if (!SubjectId || !ChapterId) {
      return res.status(400).json({ message: "Missing SubjectId or ChapterId parameter for topics Type" });
    }
    const pageNum = page ? String(page) : "1";
    const limitNum = limit ? String(limit) : "20";
    url = `${PW_API}/v2/programs/${programIdStr}/subjects/${String(SubjectId)}/chapters/${String(ChapterId)}/topics/list?page=${pageNum}&limit=${limitNum}`;
  }

  try {
    const user = await authenticateUser(req, res);
    const ActualToken = user.ActualToken;

    const response = await axios.get(url, { headers: getHeaders(ActualToken ?? "") });
    return res.status(200).json(response.data);
  } catch (error: any) {
    const status = error.response?.status || 500;
    if (status === 401) {
      clearAuthCookies(res);
    }
    return res.status(status).json({
      message: error.response?.data?.message || "Error fetching Khazana info",
    });
  }
}
