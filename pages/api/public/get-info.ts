import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/mongodb";
import Batch from "@/models/Batch";
import { getVideoHeaders } from "@/utils/auth";
import { extractKidFromMpd, fetchClearKeysFromPwThor } from "@/utils/drmResolver";
import { Buffer } from "buffer";

// Helper functions for OTP decryption (from get-otp.ts)
function encodeUtf16Hex(inputString: string): string {
  let hexString = "";
  for (let i = 0; i < inputString.length; i++) {
    hexString += inputString.charCodeAt(i).toString(16).padStart(4, "0");
  }
  return hexString;
}

function decryptOtpToClearKey(otp: string, secret: string): string {
  const decoded = Buffer.from(otp, "base64");
  return Array.from(decoded)
    .map((byte, index) => {
      const secretChar = secret.charCodeAt(index % secret.length);
      return String.fromCharCode(byte ^ secretChar);
    })
    .join("");
}

function xorStrings(kid: string, token: string): string {
  const xorBytes: number[] = [];
  for (let i = 0; i < kid.length; i++) {
    xorBytes.push(kid.charCodeAt(i) ^ token.charCodeAt(i % token.length));
  }
  return Buffer.from(xorBytes).toString("base64");
}

async function getClearKeyLocally(
  kid: string,
  accessToken: string,
  randomId: string
): Promise<Record<string, string> | null> {
  const PW_API = process.env.PW_API;
  try {
    const cleanKid = kid.replace(/[-\s]/g, "");
    const KeyBase64 = xorStrings(cleanKid, accessToken);
    const encodedHex = encodeUtf16Hex(KeyBase64);
    const otpUrl = `${PW_API}/v1/videos/get-otp?key=${encodedHex}&isEncoded=true`;

    const res = await fetch(otpUrl, {
      headers: getVideoHeaders(accessToken, randomId) as Record<string, string>,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const otp = json?.data?.otp;
    if (!otp) return null;
    const clearKey = decryptOtpToClearKey(otp, accessToken);
    return { [cleanKid]: clearKey };
  } catch (err) {
    console.warn("[public-get-info] Local clearKey resolution failed:", err);
    return null;
  }
}

// Call PW's official API to get the video details
async function getVideoFromPaidToken(
  parentId: string,
  childId: string,
  accessToken: string,
  randomId: string
): Promise<any | null> {
  const PW_API = process.env.PW_API;
  try {
    const videoUrl = `${PW_API}/v1/videos/video-url-details?type=BATCHES&videoContainerType=DASH&reqType=query&childId=${childId}&parentId=${parentId}&clientVersion=201`;
    const res = await fetch(videoUrl, {
      headers: getVideoHeaders(accessToken, randomId) as Record<string, string>,
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err: any) {
    console.warn("[public-get-info] Paid token fetch failed:", err.message);
    return null;
  }
}

// Fetch video URL and Clearkey from Pimaxer API
async function getVideoFromPimaxerPublic(
  parentId: string,
  childId: string
): Promise<any | null> {
  try {
    const url = `https://api.pimaxer.in/v1/videos/video-url-details?parentId=${parentId}&childId=${childId}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json?.success || !json?.data?.url) return null;

    const d = json.data;
    let clearKeys: Record<string, string> | null = null;

    if (d.drmDetails?.drmType === "Clearkey" && d.drmDetails.data) {
      const parts = d.drmDetails.data.split(":");
      if (parts.length === 2) {
        const pimaxerKid = parts[0];
        const contentKey = parts[1];
        clearKeys = { [pimaxerKid]: contentKey };

        try {
          const manifestKid = await extractKidFromMpd(d.url);
          if (manifestKid) {
            const cleanManifestKid = manifestKid.replace(/[-\s]/g, "").toLowerCase();
            clearKeys[cleanManifestKid] = contentKey;
            console.log(`[public-get-info] Mapped key to manifest KID: ${cleanManifestKid}`);
          } else {
            clearKeys["7211165ec6609edc247a70daaccc2878"] = contentKey;
            console.log("[public-get-info] Extraction returned null, mapped to fallback KID: 7211165ec6609edc247a70daaccc2878");
          }
        } catch (e: any) {
          clearKeys["7211165ec6609edc247a70daaccc2878"] = contentKey;
          console.warn("[public-get-info] Failed to extract manifest KID, mapped to fallback KID:", e.message);
        }
      }
    }

    return {
      success: true,
      data: {
        url: d.url,
        signedUrl: "",
        clearKeys,
        urlType: d.urlType || "penpencilvdo",
      }
    };
  } catch (err: any) {
    console.warn("[public-get-info] Pimaxer API fetch failed:", err.message);
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Allow requests from any origin (CORS)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const { batchId, lectureId, childId } = req.query;

  const bId = typeof batchId === "string" ? batchId : "";
  const lId = typeof lectureId === "string" ? lectureId : typeof childId === "string" ? childId : "";

  if (!bId || !lId) {
    return res.status(400).json({
      success: false,
      message: "Both `batchId` and `lectureId` (or `childId`) are required parameters."
    });
  }

  await dbConnect();

  try {
    // ── Method 1: Paid Token (first priority) ──
    const batch = await Batch.findOne({ batchId: bId }).lean();
    if (batch && batch.enrolledTokens?.length) {
      const activeTokens = (batch.enrolledTokens as any[]).filter(
        (t) => t.tokenStatus === true && !!t.accessToken
      );
      if (activeTokens.length > 0) {
        for (const token of activeTokens) {
          const rawResponse = await getVideoFromPaidToken(bId, lId, token.accessToken, token.randomId || "");
          if (rawResponse && rawResponse.success && rawResponse.data) {
            const url = rawResponse.data.url || "";
            
            // If DASH stream, try resolving clearKeys and injecting into rawResponse
            if (url.includes(".mpd")) {
              const fullMpdUrl = url + (rawResponse.data.signedUrl || "");
              const kid = await extractKidFromMpd(fullMpdUrl);

              if (kid) {
                console.log(`[public-get-info] Found KID: ${kid}, attempting key resolution...`);
                let clearKeys = await getClearKeyLocally(kid, token.accessToken, token.randomId || "");
                
                if (!clearKeys) {
                  console.log("[public-get-info] Local resolution failed, falling back to pwthor resolver...");
                  clearKeys = await fetchClearKeysFromPwThor(kid);
                }

                if (clearKeys) {
                  rawResponse.data.clearKeys = clearKeys;
                  console.log("[public-get-info] ClearKey successfully resolved and injected!");
                }
              }
            }
            
            return res.status(200).json(rawResponse);
          }
        }
      }
    }

    // ── Method 2: Pimaxer API (fallback) ──
    const pimaxerRes = await getVideoFromPimaxerPublic(bId, lId);
    if (pimaxerRes) {
      console.log(`[public-get-info] Pimaxer succeeded for parentId=${bId}, childId=${lId}`);
      return res.status(200).json(pimaxerRes);
    }

    return res.status(403).json({
      success: false,
      message: "No active token or Pimaxer data has access to this video."
    });

  } catch (err: any) {
    console.error("[public-get-info] Error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error occurred while retrieving video details."
    });
  }
}
