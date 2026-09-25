import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import { getHeaders } from "@/utils/auth";
import { authenticateUser, clearAuthCookies } from "@/utils/authenticateUser";
import dbConnect from "@/lib/mongodb";
import Batch from "@/models/Batch";
import User from "@/models/User";
import { v4 as uuidv4 } from "uuid";

interface TokenItem {
  ownerId?: string;
  accessToken: string;
  refreshToken?: string;
  source: string;
}

async function fetchDppListForToken(
  tokenValue: string,
  batchId: string,
  batchSubjectId: string,
  chapterId: string,
  pageNum: number
) {
  const PW_API = (process.env.PW_API || "https://api.penpencil.co");
  let resolvedSubjectId = String(batchSubjectId);
  let resolvedChapterId = String(chapterId);

  const isObjectId = (id: string) => /^[0-9a-fA-F]{24}$/.test(id);

  // 1. Resolve subject slug if necessary
  if (!isObjectId(resolvedSubjectId)) {
    console.log(`DppList API: Resolving subject slug: ${resolvedSubjectId}`);
    const detailsUrl = `${PW_API}/v3/batches/${batchId}/details`;
    const detailsRes = await axios.get(detailsUrl, {
      headers: getHeaders(tokenValue),
      timeout: 10000,
    });
    const subjects = detailsRes.data?.data?.subjects || [];
    const matchedSubject = subjects.find(
      (sub: any) => sub.slug === resolvedSubjectId
    );
    if (matchedSubject) {
      resolvedSubjectId = matchedSubject._id;
      console.log(`DppList API: Resolved subject slug to ID: ${resolvedSubjectId}`);
    } else {
      throw { status: 404, message: `Subject with slug "${resolvedSubjectId}" not found in batch.` };
    }
  }

  // 2. Resolve chapter/topic slug if necessary
  if (!isObjectId(resolvedChapterId)) {
    console.log(`DppList API: Resolving chapter slug: ${resolvedChapterId}`);
    let matchedTopic: any = null;
    for (let p = 1; p <= 3; p++) {
      const topicsUrl = `${PW_API}/v2/batches/${batchId}/subject/${resolvedSubjectId}/topics?page=${p}`;
      const topicsRes = await axios.get(topicsUrl, {
        headers: getHeaders(tokenValue),
        timeout: 10000,
      });
      const topics = topicsRes.data?.data || [];
      matchedTopic = topics.find((t: any) => t.slug === resolvedChapterId);
      if (matchedTopic) break;
      if (topics.length === 0) break;
    }

    if (matchedTopic) {
      resolvedChapterId = matchedTopic._id;
      console.log(`DppList API: Resolved chapter slug to ID: ${resolvedChapterId}`);
    } else {
      throw { status: 404, message: `Chapter with slug "${resolvedChapterId}" not found under subject.` };
    }
  }

  const url = `${PW_API}/v3/test-service/tests/new-dpp-list?page=${pageNum}&batchId=${batchId}&batchSubjectId=${resolvedSubjectId}&chapterId=${resolvedChapterId}&dppType=ALL&limit=20`;

  const response = await axios.get(url, {
    headers: getHeaders(tokenValue),
    timeout: 10000,
  });

  return response.data;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const user = await authenticateUser(req, res);
    const ActualToken = user.ActualToken;
    const PW_API = (process.env.PW_API || "https://api.penpencil.co");

    const { batchId, batchSubjectId, chapterId, page } = req.query;

    if (!batchId || !batchSubjectId || !chapterId) {
      return res.status(400).json({
        message: "Missing required fields: batchId, batchSubjectId, chapterId",
      });
    }

    // Connect to database
    await dbConnect();

    // Gather potential tokens
    const tokensToTry: TokenItem[] = [];

    // a. Currently logged-in user
    if (ActualToken) {
      tokensToTry.push({
        ownerId: user._id.toString(),
        accessToken: ActualToken,
        refreshToken: user.ActualRefresh || "",
        source: "current",
      });
    }

    // b. Master Token (from env or hardcoded fallback)
    const masterToken = process.env.MASTER_DPP_TOKEN || "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE3ODE0MDcwMzAuMjIxLCJkYXRhIjp7Il9pZCI6IjY5ZTE4NWUxMWM3Y2JlZGMyNjU4ZDNhZiIsInVzZXJuYW1lIjoiOTQ1ODQzNTU2NSIsImZpcnN0TmFtZSI6IkthaXplbiIsIm9yZ2FuaXphdGlvbiI6eyJfaWQiOiI1ZWIzOTNlZTk1ZmFiNzQ2OGE3OWQxODkiLCJ3ZWJzaXRlIjoicGh5c2ljc3dhbGxhaC5jb20iLCJuYW1lIjoiUGh5c2ljc3dhbGxhaCJ9LCJyb2xlcyI6WyI1YjI3YmQ5NjU4NDJmOTUwYTc3OGM2ZWYiXSwiY291bnRyeUdyb3VwIjoiSU4iLCJ0eXBlIjoiVVNFUiJ9LCJqdGkiOiJmXzF5eU5iTlFobW9oUFJMalZ6cGhBXzY5ZTE4NWUxMWM3Y2JlZGMyNjU4ZDNhZiIsImlhdCI6MTc4MDgwMjIzMH0.uags8M_6n8f6NV84CQpVIgfM2zL0C1197KWB8d46gp8";
    if (masterToken) {
      tokensToTry.push({
        accessToken: masterToken,
        source: "master",
      });
    }

    // c. Enrolled tokens directly associated with the Batch doc
    const batch = await Batch.findOne({ batchId });
    if (batch && batch.enrolledTokens) {
      for (const t of batch.enrolledTokens) {
        if (t.tokenStatus && t.accessToken) {
          tokensToTry.push({
            ownerId: t.ownerId.toString(),
            accessToken: t.accessToken,
            refreshToken: t.refreshToken || "",
            source: "batch",
          });
        }
      }
    }

    // d. Users who have batchId in enrolledBatches
    const enrolledUsers = await User.find({
      "enrolledBatches.batchId": batchId,
      ActualToken: { $exists: true, $ne: null }
    });
    for (const u of enrolledUsers) {
      if (u.ActualToken) {
        tokensToTry.push({
          ownerId: u._id.toString(),
          accessToken: u.ActualToken,
          refreshToken: u.ActualRefresh || "",
          source: "enrolled",
        });
      }
    }

    // Unique-ify tokens
    const uniqueTokens: TokenItem[] = [];
    const seenAccessTokens = new Set<string>();
    for (const item of tokensToTry) {
      if (!seenAccessTokens.has(item.accessToken)) {
        seenAccessTokens.add(item.accessToken);
        uniqueTokens.push(item);
      }
    }

    console.log(`DppList API: Unique tokens to try count: ${uniqueTokens.length}`);

    let lastError: any = null;
    const pageNum = page ? parseInt(page as string) : 1;

    for (let i = 0; i < uniqueTokens.length; i++) {
      const tokenItem = uniqueTokens[i];
      try {
        console.log(`DppList API: Trying token index ${i} (source: ${tokenItem.source})...`);
        const data = await fetchDppListForToken(
          tokenItem.accessToken,
          String(batchId),
          String(batchSubjectId),
          String(chapterId),
          pageNum
        );

        console.log(`DppList API: SUCCESS using token index ${i}!`);
        return res.status(200).json(data);
      } catch (err: any) {
        if (err.status === 404) {
          return res.status(404).json({ message: err.message });
        }

        const status = err.response?.status;

        // If 401 and we have a refresh token, try to refresh it dynamically!
        if (status === 401 && tokenItem.refreshToken && tokenItem.ownerId) {
          console.log(`DppList API: Token index ${i} expired. Attempting refresh...`);
          try {
            const newRandomId = uuidv4();
            const refreshRes = await axios.post(
              `${PW_API}/v3/oauth/refresh-token`,
              {
                refresh_token: tokenItem.refreshToken,
                client_id: "system-admin",
              },
              {
                headers: {
                  "Content-Type": "application/json",
                  Randomid: newRandomId,
                },
                timeout: 5000,
              }
            );

            if (refreshRes.data?.success && refreshRes.data?.data) {
              const newAccessToken = refreshRes.data.data.access_token;
              const newRefreshToken = refreshRes.data.data.refresh_token;

              console.log(`DppList API: Token refreshed successfully for user ${tokenItem.ownerId}`);

              // Update user doc in MongoDB
              await User.findByIdAndUpdate(tokenItem.ownerId, {
                ActualToken: newAccessToken,
                ActualRefresh: newRefreshToken,
                randomId: newRandomId,
              });

              // Also update batch enrolled token cache
              await Batch.updateOne(
                {
                  batchId: batchId,
                  "enrolledTokens.ownerId": tokenItem.ownerId,
                },
                {
                  $set: {
                    "enrolledTokens.$.accessToken": newAccessToken,
                    "enrolledTokens.$.refreshToken": newRefreshToken,
                    "enrolledTokens.$.updatedAt": new Date(),
                    "enrolledTokens.$.tokenStatus": true,
                    "enrolledTokens.$.randomId": newRandomId,
                  },
                }
              );

              // Retry call with refreshed token
              console.log(`DppList API: Retrying token index ${i} after refresh...`);
              const data = await fetchDppListForToken(
                newAccessToken,
                String(batchId),
                String(batchSubjectId),
                String(chapterId),
                pageNum
              );
              console.log(`DppList API: SUCCESS after refresh using token index ${i}!`);
              return res.status(200).json(data);
            }
          } catch (refreshErr: any) {
            console.error(`DppList API: Refresh failed for token index ${i}:`, refreshErr.message);
            // Mark token as invalid
            await Batch.updateOne(
              {
                batchId: batchId,
                "enrolledTokens.ownerId": tokenItem.ownerId,
              },
              {
                $set: {
                  "enrolledTokens.$.tokenStatus": false,
                  "enrolledTokens.$.updatedAt": new Date(),
                },
              }
            );
          }
        }

        console.warn(`DppList API: Token index ${i} failed. Error: ${err.message}`);
        lastError = err;
      }
    }

    if (lastError) {
      console.error("DppList API: All tokens failed. Last error details:", lastError.response?.data || lastError.message);
      const status = lastError.response?.status || 500;
      return res.status(status).json({
        message: lastError.response?.data?.message || lastError.message || "Error fetching DPP list",
      });
    }

    return res.status(400).json({
      message: "No active user tokens available to fetch DPP list",
    });
  } catch (error: any) {
    console.error("Error in DppList API handler:", error.message);
    const status = error.response?.status || 500;

    if (status === 401) {
      clearAuthCookies(res);
    }

    return res.status(status).json({
      message: error.response?.data?.message || error.message || "Error fetching DPP list",
    });
  }
}
