import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { getHeaders } from "@/utils/auth";
import { authenticateUser, clearAuthCookies } from "@/utils/authenticateUser";
import dbConnect from "@/lib/mongodb";
import Batch from "@/models/Batch";
import User from "@/models/User";

interface TokenItem {
  ownerId: string;
  accessToken: string;
  refreshToken: string;
  source: "current" | "batch" | "enrolled" | "other";
}

async function tryStartTestForToken(
  tokenValue: string,
  testId: string,
  batchId: string,
  resolvedSubjectId: string,
  scheduleId: string,
  type: string
) {
  const PW_API = (process.env.PW_API || "https://api.penpencil.co");
  
  // 1. Fetch cohortId from user profile info
  const profileUrl = `${PW_API}/v1/users/user-profile-info?fields=cohortId`;
  const profileRes = await axios.get(profileUrl, {
    headers: getHeaders(tokenValue),
    timeout: 6000,
  });

  const cohortId = profileRes.data?.data?.cohortId;
  if (!cohortId) {
    throw new Error("Failed to resolve cohortId");
  }

  // 2. Call the Start Test API
  const startTestUrl = `${PW_API}/v3/test-service/tests/${testId}/start-test?batchId=${batchId}&cohortId=${cohortId}&exerciseId=${testId}&testSource=BATCH_QUIZ&type=${type}&batchScheduleId=${scheduleId}&subjectId=${resolvedSubjectId}`;

  const response = await axios.get(startTestUrl, {
    headers: getHeaders(tokenValue),
    timeout: 6000,
  });

  return response.data;
}

async function tryStartTestWithAllTypes(
  tokenValue: string,
  testId: string,
  batchId: string,
  resolvedSubjectId: string,
  scheduleId: string,
  initialType: string
) {
  const typesToTry = [initialType, "Start", "Resume", "Reattempt"];
  const uniqueTypes = Array.from(new Set(typesToTry));
  let lastError: any = null;

  for (const type of uniqueTypes) {
    try {
      console.log(`StartTest API: Trying type ${type} for token...`);
      const data = await tryStartTestForToken(tokenValue, testId, batchId, resolvedSubjectId, scheduleId, type);
      return data;
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.response?.data?.message || err.message;
      console.warn(`StartTest API: Type ${type} failed. Message: ${msg}`);
      lastError = err;

      // Only retry other types if the error is state-related
      const isStateError = msg?.toLowerCase().includes("state");
      if (!isStateError) {
        break;
      }
    }
  }
  throw lastError;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const user = await authenticateUser(req, res);
    const ActualToken = user.ActualToken;
    const PW_API = (process.env.PW_API || "https://api.penpencil.co");

    const { batchId, subjectId, testId, scheduleId, type = "Start" } = req.query;

    if (!batchId || !subjectId || !testId || !scheduleId) {
      return res.status(400).json({
        message: "Missing required fields: batchId, subjectId, testId, scheduleId",
      });
    }

    // Resolve subject slug
    let resolvedSubjectId = String(subjectId);
    const isObjectId = (id: string) => /^[0-9a-fA-F]{24}$/.test(id);

    if (!isObjectId(resolvedSubjectId)) {
      console.log(`Resolving subject slug: ${resolvedSubjectId}`);
      const detailsUrl = `${PW_API}/v3/batches/${batchId}/details`;
      const detailsRes = await axios.get(detailsUrl, {
        headers: getHeaders(ActualToken || ""),
        timeout: 10000,
      });
      const subjects = detailsRes.data?.data?.subjects || [];
      const matchedSubject = subjects.find(
        (sub: any) => sub.slug === resolvedSubjectId
      );
      if (matchedSubject) {
        resolvedSubjectId = matchedSubject._id;
        console.log(`Resolved subject slug to ID: ${resolvedSubjectId}`);
      } else {
        return res.status(404).json({
          message: `Subject with slug "${resolvedSubjectId}" not found in batch.`,
        });
      }
    }

    // Connect to database
    await dbConnect();

    // Gather potential tokens
    const tokensToTry: TokenItem[] = [];

    // a. Currently logged-in user
    if (ActualToken) {
      tokensToTry.push({
        ownerId: user._id.toString(),
        accessToken: user.ActualToken,
        refreshToken: user.ActualRefresh || "",
        source: "current"
      });
    }

    // b. Master Token (from env or hardcoded fallback)
    const masterToken = process.env.MASTER_DPP_TOKEN || "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE3ODE0MDcwMzAuMjIxLCJkYXRhIjp7Il9pZCI6IjY5ZTE4NWUxMWM3Y2JlZGMyNjU4ZDNhZiIsInVzZXJuYW1lIjoiOTQ1ODQzNTU2NSIsImZpcnN0TmFtZSI6IkthaXplbiIsIm9yZ2FuaXphdGlvbiI6eyJfaWQiOiI1ZWIzOTNlZTk1ZmFiNzQ2OGE3OWQxODkiLCJ3ZWJzaXRlIjoicGh5c2ljc3dhbGxhaC5jb20iLCJuYW1lIjoiUGh5c2ljc3dhbGxhaCJ9LCJyb2xlcyI6WyI1YjI3YmQ5NjU4NDJmOTUwYTc3OGM2ZWYiXSwiY291bnRyeUdyb3VwIjoiSU4iLCJ0eXBlIjoiVVNFUiJ9LCJqdGkiOiJmXzF5eU5iTlFobW9oUFJMalZ6cGhBXzY5ZTE4NWUxMWM3Y2JlZGMyNjU4ZDNhZiIsImlhdCI6MTc4MDgwMjIzMH0.uags8M_6n8f6NV84CQpVIgfM2zL0C1197KWB8d46gp8";
    if (masterToken) {
      tokensToTry.push({
        ownerId: "",
        accessToken: masterToken,
        refreshToken: "",
        source: "master" as any
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
            source: "batch"
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
          source: "enrolled"
        });
      }
    }

    // Unique-ify tokens while preserving order
    const uniqueTokens: TokenItem[] = [];
    const seenAccessTokens = new Set<string>();

    for (const item of tokensToTry) {
      if (!seenAccessTokens.has(item.accessToken)) {
        seenAccessTokens.add(item.accessToken);
        uniqueTokens.push(item);
      }
    }

    console.log(`StartTest API: Unique tokens to try count: ${uniqueTokens.length}`);

    let lastError: any = null;

    // Try tokens sequentially
    for (let i = 0; i < uniqueTokens.length; i++) {
      const tokenItem = uniqueTokens[i];
      try {
        console.log(`StartTest API: Trying token index ${i} (source: ${tokenItem.source})...`);
        const data = await tryStartTestWithAllTypes(
          tokenItem.accessToken,
          String(testId),
          String(batchId),
          String(resolvedSubjectId),
          String(scheduleId),
          String(type)
        );
        console.log(`StartTest API: SUCCESS using token index ${i}!`);
        return res.status(200).json(data);
      } catch (err: any) {
        const status = err.response?.status;
        
        // If 401 and we have a refresh token, try to refresh it dynamically!
        if (status === 401 && tokenItem.refreshToken) {
          console.log(`StartTest API: Token index ${i} expired. Attempting refresh...`);
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

              console.log(`StartTest API: Token refreshed successfully for user ${tokenItem.ownerId}`);

              // Update user doc in MongoDB
              await User.findByIdAndUpdate(tokenItem.ownerId, {
                ActualToken: newAccessToken,
                ActualRefresh: newRefreshToken,
                randomId: newRandomId,
              });

              // Also update batch enrolled token cache if it is a batch source
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

              // Retry start-test with new token
              console.log(`StartTest API: Retrying token index ${i} after refresh...`);
              const data = await tryStartTestWithAllTypes(
                newAccessToken,
                String(testId),
                String(batchId),
                String(resolvedSubjectId),
                String(scheduleId),
                String(type)
              );
              console.log(`StartTest API: SUCCESS after refresh using token index ${i}!`);
              return res.status(200).json(data);
            }
          } catch (refreshErr: any) {
            console.error(`StartTest API: Refresh failed for token index ${i}:`, refreshErr.message);
            // Mark token as invalid in Batch doc if it fails refresh
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

        console.warn(`StartTest API: Token index ${i} failed. Error: ${err.message}`);
        lastError = err;
      }
    }

    // If all failed
    if (lastError) {
      console.error("StartTest API: All tokens failed. Last error details:", lastError.response?.data || lastError.message);
      const status = lastError.response?.status || 500;
      return res.status(status).json({
        message: lastError.response?.data?.message || lastError.message || "Error starting the test",
        details: lastError.response?.data || null,
      });
    }

    return res.status(400).json({
      message: "No active user tokens available to fetch quiz data",
    });

  } catch (error: any) {
    console.error("Fatal error in StartTest handler:", error);
    return res.status(500).json({
      message: error.message || "Internal Server Error",
    });
  }
}
