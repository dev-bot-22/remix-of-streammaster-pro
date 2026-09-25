import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import { authenticateUser } from "@/utils/authenticateUser";
import { getHeaders } from "@/utils/auth";

const MASTER_TOKEN = process.env.MASTER_DPP_TOKEN || "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE3ODE0MDcwMzAuMjIxLCJkYXRhIjp7Il9pZCI6IjY5ZTE4NWUxMWM3Y2JlZGMyNjU4ZDNhZiIsInVzZXJuYW1lIjoiOTQ1ODQzNTU2NSIsImZpcnN0TmFtZSI6IkthaXplbiIsIm9yZ2FuaXphdGlvbiI6eyJfaWQiOiI1ZWIzOTNlZTk1ZmFiNzQ2OGE3OWQxODkiLCJ3ZWJzaXRlIjoicGh5c2ljc3dhbGxhaC5jb20iLCJuYW1lIjoiUGh5c2ljc3dhbGxhaCJ9LCJyb2xlcyI6WyI1YjI3YmQ5NjU4NDJmOTUwYTc3OGM2ZWYiXSwiY291bnRyeUdyb3VwIjoiSU4iLCJ0eXBlIjoiVVNFUiJ9LCJqdGkiOiJmXzF5eU5iTlFobW9oUFJMalZ6cGhBXzY5ZTE4NWUxMWM3Y2JlZGMyNjU4ZDNhZiIsImlhdCI6MTc4MDgwMjIzMH0.uags8M_6n8f6NV84CQpVIgfM2zL0C1197KWB8d46gp8";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { testId } = req.query;

  if (!testId) {
    return res.status(400).json({ message: "Missing required parameter: testId" });
  }

  try {
    // Authenticate user
    const user = await authenticateUser(req, res);
    const ActualToken = user.ActualToken;

    const pwApiBase = (process.env.PW_API || "https://api.penpencil.co").replace(/\/$/, "");
    const url = `${pwApiBase}/v3/test-service/tests/${testId}/instructions`;

    let response;
    try {
      if (!ActualToken) {
        throw new Error("No user token found");
      }
      response = await axios.get(url, {
        headers: getHeaders(ActualToken),
        timeout: 10000,
      });
    } catch (userTokenErr: any) {
      const userStatus = userTokenErr.response?.status;
      console.log(`[testSyllabus] User token failed or missing (${userStatus}), trying master token...`);
      if (MASTER_TOKEN) {
        response = await axios.get(url, {
          headers: getHeaders(MASTER_TOKEN),
          timeout: 10000,
        });
      } else {
        throw userTokenErr;
      }
    }

    if (response.data && response.data.success) {
      return res.status(200).json({
        success: true,
        data: response.data.data?.syllabus || null,
      });
    } else {
      throw new Error(response.data?.message || "Failed to fetch test syllabus");
    }
  } catch (err: any) {
    console.error("Fetch test syllabus error:", err.response?.data || err.message);
    return res.status(err.response?.status || 500).json({
      message: err.response?.data?.message || err.message || "Error fetching test syllabus",
    });
  }
}
