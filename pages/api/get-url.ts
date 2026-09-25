import type { NextApiRequest, NextApiResponse } from "next";
import { webcrypto } from "node:crypto";
import crypto from "crypto";
import dbConnect from "@/lib/mongodb";
import Batch from "@/models/Batch";
import { authenticateUser } from "@/utils/authenticateUser";
import { getVideoHeaders } from "@/utils/auth";
import { extractKidFromMpd, fetchClearKeysFromPwThor } from "@/utils/drmResolver";

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
    console.warn("[get-url] Local clearKey resolution failed:", err);
    return null;
  }
}

const subtle = webcrypto.subtle;
const STUDYSPARK = "https://thestudyspark.site";

// ─── Security: In-memory rate limiter ────────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;

function getRateLimitKey(req: NextApiRequest): string {
  return (
    (req.headers["cf-connecting-ip"] as string) ||
    (req.headers["x-real-ip"] as string) ||
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "unknown"
  );
}

function isRateLimited(req: NextApiRequest): boolean {
  const key = getRateLimitKey(req);
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

// ─── Security: User-Session Rate Limiters ─────────────────────────────────────
const userMinLimitMap = new Map<string, { count: number; resetAt: number }>();
const USER_MIN_LIMIT_MAX = 3;
const USER_MIN_LIMIT_WINDOW_MS = 60_000;

const userHourLimitMap = new Map<string, { count: number; resetAt: number }>();
const USER_HOUR_LIMIT_MAX = 20;
const USER_HOUR_LIMIT_WINDOW_MS = 3_600_000;

function isUserMinRateLimited(userId: string): boolean {
  const now = Date.now();
  const entry = userMinLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    userMinLimitMap.set(userId, { count: 1, resetAt: now + USER_MIN_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > USER_MIN_LIMIT_MAX;
}

function isUserHourRateLimited(userId: string): boolean {
  const now = Date.now();
  const entry = userHourLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    userHourLimitMap.set(userId, { count: 1, resetAt: now + USER_HOUR_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > USER_HOUR_LIMIT_MAX;
}

// ─── Security: Origin / Internal-Secret guard ─────────────────────────────────
function isRequestAuthorized(req: NextApiRequest): { ok: boolean; reason?: string } {
  const internalSecret = process.env.INTERNAL_API_SECRET;
  if (internalSecret) {
    const sentSecret = req.headers["x-internal-secret"] as string | undefined;
    if (!sentSecret || sentSecret !== internalSecret)
      return { ok: false, reason: "Missing or invalid internal secret." };
  }
  const origin  = req.headers["origin"]  as string | undefined;
  const referer = req.headers["referer"] as string | undefined;
  const host    = req.headers["host"]    as string | undefined;
  if (origin) {
    let h: string;
    try { h = new URL(origin).host; } catch { return { ok: false, reason: "Malformed Origin." }; }
    const isLocal = h.startsWith("localhost") || h.startsWith("127.0.0.1");
    if (!isLocal && h !== host) return { ok: false, reason: `Forbidden origin: ${h}` };
  } else if (referer) {
    let h: string;
    try { h = new URL(referer).host; } catch { return { ok: false, reason: "Malformed Referer." }; }
    const isLocal = h.startsWith("localhost") || h.startsWith("127.0.0.1");
    if (!isLocal && h !== host) return { ok: false, reason: `Forbidden referer: ${h}` };
  }
  return { ok: true };
}

// ─── Crypto helpers (mirrors the StudySpark frontend bundle) ──────────────────

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.byteLength; i++) s += String.fromCharCode(bytes[i]);
  return Buffer.from(s, "binary").toString("base64");
}

function b64ToBuf(b64: string): ArrayBuffer {
  const bin = Buffer.from(b64, "base64");
  const buf = new ArrayBuffer(bin.length);
  new Uint8Array(buf).set(bin);
  return buf;
}

function parsePem(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PUBLIC KEY-----/, "")
    .replace(/-----END PUBLIC KEY-----/, "")
    .replace(/\s/g, "");
  return b64ToBuf(b64);
}

// Extract UUID (vid) from any CDN URL, e.g. CloudFront or PW CDN
// e.g. https://d1d34p8vz63oiq.cloudfront.net/b1085e9a-f937-4977-b5d7-5cbebd968318/master.mpd
//   → "b1085e9a-f937-4977-b5d7-5cbebd968318"
function extractVid(url: string): string {
  const match = url.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  return match ? match[1] : "";
}

// ─── Method 1: StudySpark /api-server/v2/videos/get-info ─────────────────────

async function getVideoFromStudySpark(videoId: string): Promise<any | null> {
  try {
    // 1. Fetch RSA public key
    const pkRes = await fetch(`${STUDYSPARK}/api-server/pubkey`, { signal: AbortSignal.timeout(5000) });
    const pkJson = await pkRes.json();
    if (!pkJson.success || !pkJson.pubkey) return null;

    // 2. Import RSA public key
    const rsaKey = await subtle.importKey(
      "spki",
      parsePem(pkJson.pubkey),
      { name: "RSA-OAEP", hash: "SHA-256" },
      false,
      ["encrypt"]
    );

    // 3. Generate AES-256-GCM session key
    const aesKey = await subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
    const rawAes  = await subtle.exportKey("raw", aesKey);

    // 4. Encrypt AES key with RSA → x-payload-key
    const encAes = await subtle.encrypt({ name: "RSA-OAEP" }, rsaKey, rawAes);
    const payloadKeyB64 = bufToB64(encAes);

    // 5. Call get-info
    const res = await fetch(
      `${STUDYSPARK}/api-server/v2/videos/get-info?id=${encodeURIComponent(videoId)}`,
      {
        headers: {
          "accept": "*/*",
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
          "x-payload-key": payloadKeyB64,
        },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!res.ok) return null;

    const isEncrypted = res.headers.get("x-response-encrypted") === "true";
    const body = await res.json();

    let data: any;
    if (isEncrypted) {
      // 6. Decrypt AES-GCM response: ciphertext || tag combined
      const iv         = b64ToBuf(body.iv);
      const ciphertext = b64ToBuf(body.ciphertext);
      const tag        = b64ToBuf(body.tag);
      const combined   = new Uint8Array(ciphertext.byteLength + tag.byteLength);
      combined.set(new Uint8Array(ciphertext), 0);
      combined.set(new Uint8Array(tag), ciphertext.byteLength);
      const plain = await subtle.decrypt({ name: "AES-GCM", iv }, aesKey, combined.buffer);
      data = JSON.parse(new TextDecoder().decode(plain));
    } else {
      data = body;
    }

    if (!data?.success || !data?.data?.videoUrl) return null;

    const d = data.data;
    const rawUrl: string = d.videoUrl || "";
    const vid = extractVid(rawUrl);

    console.log(`[get-url] StudySpark videoUrl=${rawUrl} → vid=${vid}`);

    return {
      url:         rawUrl, // Keep it raw, let the frontend structure it if vid is present
      fallbackUrl: "",
      downloadUrl: rawUrl,
      vid,
      title:     d.name     || "",
      topic:     d.name     || "",
      thumbnail: d.image    || "",
      duration:  d.duration || "",
      clearKeys: null,
    };
  } catch (err: any) {
    console.warn("[get-url] StudySpark get-info failed:", err.message);
    return null;
  }
}

// ─── Method 2: Paid token from DB (batch enrolled tokens) ────────────────────

async function getVideoFromPaidToken(
  parentId: string,
  childId: string,
  accessToken: string,
  randomId: string,
  container: string = "DASH"
): Promise<any | null> {
  const PW_API = process.env.PW_API;
  try {
    const videoUrl = `${PW_API}/v1/videos/video-url-details?type=BATCHES&videoContainerType=${container}&reqType=query&childId=${childId}&parentId=${parentId}&clientVersion=201`;
    const res = await fetch(videoUrl, {
      headers: getVideoHeaders(accessToken, randomId) as Record<string, string>,
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const url: string = json?.data?.url || "";
    if (!url) return null;

    const vid = extractVid(url);

    console.log(`[get-url] PW API url=${url} → vid=${vid}`);

    let clearKeys: Record<string, string> | null = null;

    if (url.includes(".mpd")) {
      const fullMpdUrl = url + (json?.data?.signedUrl || "");
      const kid = await extractKidFromMpd(fullMpdUrl);

      if (kid) {
        console.log(`[get-url] Found KID: ${kid}, attempting key resolution...`);
        clearKeys = await getClearKeyLocally(kid, accessToken, randomId);
        
        if (!clearKeys) {
          console.log("[get-url] Local resolution failed, falling back to pwthor resolver...");
          clearKeys = await fetchClearKeysFromPwThor(kid);
        }

        if (clearKeys) {
          console.log("[get-url] ClearKey successfully resolved and injected!");
        }
      }
    }

    return {
      url:         url, // Keep it raw, let the frontend structure it if vid is present
      fallbackUrl: "",
      downloadUrl: url,
      vid,
      title:     "",
      topic:     "",
      thumbnail: "",
      duration:  "",
      clearKeys,
      signedUrl: json?.data?.signedUrl || "", // return the signed parameters separately
    };
  } catch (err: any) {
    console.warn("[get-url] Paid token fetch failed:", err.message);
    return null;
  }
}

// Fetch video URL and Clearkey from Pimaxer API
async function getVideoFromPimaxer(
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
    const vid = extractVid(d.url);
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
            console.log(`[get-url] Mapped key to manifest KID: ${cleanManifestKid}`);
          } else {
            clearKeys["7211165ec6609edc247a70daaccc2878"] = contentKey;
            console.log("[get-url] Extraction returned null, mapped to fallback KID: 7211165ec6609edc247a70daaccc2878");
          }
        } catch (e: any) {
          clearKeys["7211165ec6609edc247a70daaccc2878"] = contentKey;
          console.warn("[get-url] Failed to extract manifest KID, mapped to fallback KID:", e.message);
        }
      }
    }

    return {
      url: d.url,
      fallbackUrl: "",
      downloadUrl: d.url,
      vid,
      title: "",
      topic: "",
      thumbnail: "",
      duration: "",
      clearKeys,
    };
  } catch (err: any) {
    console.warn("[get-url] Pimaxer API fetch failed:", err.message);
    return null;
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET")
    return res.status(405).json({ success: false, message: "Method not allowed" });

  if (isRateLimited(req))
    return res.status(429).json({ success: false, message: "Too many requests. Slow down." });

  const auth = isRequestAuthorized(req);
  if (!auth.ok) {
    console.warn(`[get-url] Blocked: ${auth.reason} | IP: ${getRateLimitKey(req)}`);
    return res.status(403).json({ success: false, message: "Forbidden." });
  }

  const { parentId, childId, videoId, signature, timestamp, container } = req.query;

  if (!parentId || typeof parentId !== "string" || !childId || typeof childId !== "string")
    return res.status(400).json({ success: false, message: "`parentId` and `childId` are required." });

  const containerStr = typeof container === "string" ? container : "DASH";

  const internalSecret = process.env.INTERNAL_API_SECRET;
  const sentSecret = req.headers["x-internal-secret"] as string | undefined;
  const isInternalRequest = !!(internalSecret && sentSecret === internalSecret);

  let user;
  if (!isInternalRequest) {
    // 1. Session Auth check
    try {
      user = await authenticateUser(req, res);
    } catch (err: any) {
      console.warn(`[get-url] Unauthorized access blocked: ${err.message}`);
      return res.status(401).json({ success: false, message: err.message || "Unauthorized" });
    }

    // 1.5. User-Session Rate Limiting
    const userId = user._id.toString();
    if (isUserMinRateLimited(userId) || isUserHourRateLimited(userId)) {
      console.warn(`[get-url] User ${user.UserName} (ID: ${userId}) exceeded rate limit.`);
      return res.status(429).json({ success: false, message: "Too many requests. Please try again later." });
    }

    // 2. Ephemeral Signature check
    if (!signature || !timestamp || typeof signature !== "string" || typeof timestamp !== "string") {
      console.warn(`[get-url] Missing signature or timestamp parameters.`);
      return res.status(400).json({ success: false, message: "Missing request signature." });
    }

    const timeVal = parseInt(timestamp, 10);
    if (isNaN(timeVal)) {
      return res.status(400).json({ success: false, message: "Invalid signature timestamp." });
    }

    const now = Date.now();
    if (Math.abs(now - timeVal) > 60_000) {
      console.warn(`[get-url] Expired signature timestamp: ${timeVal} (now: ${now}).`);
      return res.status(403).json({ success: false, message: "Request signature expired." });
    }

    const secret = process.env.JWT_SECRET || "fallback_secret";
    const expectedData = `${childId}:${timestamp}`;
    const expectedSignature = crypto.createHmac("sha256", secret).update(expectedData).digest("hex");

    try {
      const sigBuf = Buffer.from(signature, "hex");
      const expBuf = Buffer.from(expectedSignature, "hex");
      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        console.warn(`[get-url] Invalid signature: ${signature} (expected: ${expectedSignature}).`);
        return res.status(403).json({ success: false, message: "Invalid request signature." });
      }
    } catch (err) {
      console.warn(`[get-url] Signature parsing/comparison failed.`);
      return res.status(403).json({ success: false, message: "Invalid request signature." });
    }
  }

  const videoIdStr = typeof videoId === "string" ? videoId : Array.isArray(videoId) ? videoId[0] : "";

  await dbConnect();

  // ── Method 1: Paid token — find the batch in DB, try each enrolled token ──
  try {
    const batch = await Batch.findOne({ batchId: parentId }).lean();
    if (batch && batch.enrolledTokens?.length) {
      const activeTokens = (batch.enrolledTokens as any[]).filter(
        (t) => t.tokenStatus === true && !!t.accessToken
      );
      console.log(`[get-url] Found ${activeTokens.length} active token(s) for batchId=${parentId}`);

      for (const token of activeTokens) {
        console.log(`[get-url] Trying batch token for ownerId=${token.ownerId}`);
        const result = await getVideoFromPaidToken(
          parentId,
          childId,
          token.accessToken,
          token.randomId || "",
          containerStr
        );
        if (result?.url) {
          console.log(`[get-url] Batch token succeeded! ownerId=${token.ownerId}`);
          return res.status(200).json(result);
        }
        console.log(`[get-url] Token for ownerId=${token.ownerId} returned no URL, trying next...`);
      }
    } else {
      console.log(`[get-url] No batch or no enrolled tokens found for batchId=${parentId}`);
    }
  } catch (err: any) {
    console.error("[get-url] DB token resolution error:", err.message);
  }

  // ── Method 2: Pimaxer API ──
  console.log(`[get-url] Trying Pimaxer video-url-details for parentId=${parentId}, childId=${childId}`);
  const pimaxerResult = await getVideoFromPimaxer(parentId, childId);
  if (pimaxerResult?.url) {
    console.log(`[get-url] Pimaxer succeeded: ${pimaxerResult.url}`);
    return res.status(200).json(pimaxerResult);
  }

  // ── Method 3: StudySpark API (requires videoId) ───────────────────────────
  if (videoIdStr) {
    console.log(`[get-url] Trying StudySpark get-info for videoId=${videoIdStr}`);
    const result = await getVideoFromStudySpark(videoIdStr);
    if (result?.url) {
      console.log(`[get-url] StudySpark succeeded: ${result.url.substring(0, 80)}`);
      return res.status(200).json(result);
    }
    console.log(`[get-url] StudySpark failed.`);
  }

  return res.status(403).json({
    success: false,
    message: "No active token has access to this video.",
  });
}
