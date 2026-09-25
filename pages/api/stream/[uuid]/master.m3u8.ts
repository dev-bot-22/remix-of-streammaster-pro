import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import dbConnect from "@/lib/mongodb";
import Batch from "@/models/Batch";
import VideoStream from "@/models/VideoStream";
import { getVideoHeaders } from "@/utils/auth";
import { Buffer } from "buffer";

const PW_API = process.env.PW_API;

async function getAnyActiveToken() {
  await dbConnect();
  const batch = await Batch.findOne({ "enrolledTokens.tokenStatus": true }).lean();
  if (!batch?.enrolledTokens?.length) return null;
  return (batch.enrolledTokens as any[]).find(
    (t: any) => t.tokenStatus === true && !!t.accessToken
  ) as { accessToken: string; randomId: string } | null;
}

async function getSignedUrlFromPW(batchId: string, lectureId: string, token: any): Promise<string> {
  const endpoint = `${PW_API}/v1/videos/video-url-details?type=BATCHES&videoContainerType=DASH&reqType=query&childId=${lectureId}&parentId=${batchId}&clientVersion=201`;
  const res = await axios.get(endpoint, {
    headers: getVideoHeaders(token.accessToken, token.randomId || ""),
    timeout: 8000,
  });
  return res.data?.data?.signedUrl || "";
}

async function resolveHlsKey(keyUrl: string, token: any): Promise<string | null> {
  try {
    const res = await axios.get(keyUrl, {
      headers: getVideoHeaders(token.accessToken, token.randomId || ""),
      responseType: "arraybuffer",
      timeout: 6000,
    });
    return Buffer.from(res.data).toString("hex");
  } catch {
    return null;
  }
}

function buildProxyManifest(masterText: string, uuid: string, signedQuery: string, keyHex: string): string {
  const baseUrl = `https://sec-prod-mediacdn.pw.live/${uuid}/`;
  const sigParams = signedQuery.startsWith("?") ? signedQuery.slice(1) : signedQuery;
  const keyParam = keyHex ? `&keyHex=${keyHex}` : "";

  return masterText.split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return line;
    if (trimmed.startsWith("#")) {
      return trimmed.replace(/(URI\s*=\s*["'])([^"']*)(["'])/g, (match, p1, p2, p3) => {
        if (p2.startsWith("http") || p2.startsWith("data:")) return match;
        const abs = new URL(p2, baseUrl).href;
        return `${p1}/api/proxy?url=${encodeURIComponent(abs)}${keyParam}&${sigParams}${p3}`;
      });
    }
    const absUrl = trimmed.startsWith("http") ? trimmed : new URL(trimmed, baseUrl).href;
    return `/api/proxy?url=${encodeURIComponent(absUrl)}${keyParam}&${sigParams}`;
  }).join("\n");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { uuid, bid, vid } = req.query;
  const cdnUuid = Array.isArray(uuid) ? uuid[0] : uuid || "";

  if (!cdnUuid) return res.status(400).json({ error: "Missing video UUID" });

  await dbConnect();

  let signedQuery = "";
  let keyHex = "";

  // 1. Check cache first
  const cached = await VideoStream.findOne({ uuid: cdnUuid }).lean();
  if (cached && cached.expiresAt > new Date()) {
    signedQuery = cached.signedQuery;
    keyHex = cached.keyHex || "";
    console.log(`[stream/${cdnUuid}] Using cached signed URL (expires ${cached.expiresAt.toISOString()})`);
  }

  // 2. If bid+vid provided, fetch fresh signed URL from PW API
  if (!signedQuery && bid && vid) {
    try {
      const token = await getAnyActiveToken();
      if (token) {
        const bId = Array.isArray(bid) ? bid[0] : bid;
        const vId = Array.isArray(vid) ? vid[0] : vid;
        signedQuery = await getSignedUrlFromPW(bId, vId, token);
        if (signedQuery) {
          // Cache it for next time
          const expiresMatch = signedQuery.match(/Expires=(\d+)/);
          const expiresAt = expiresMatch
            ? new Date(parseInt(expiresMatch[1]) * 1000)
            : new Date(Date.now() + 6 * 60 * 60 * 1000);
          await VideoStream.findOneAndUpdate(
            { uuid: cdnUuid },
            { uuid: cdnUuid, signedQuery, expiresAt },
            { upsert: true }
          );
          console.log(`[stream/${cdnUuid}] Fetched + cached signed URL from PW API`);
        }
      }
    } catch (e: any) {
      console.warn(`[stream/${cdnUuid}] Failed to fetch signed URL from PW API:`, e.message);
    }
  }

  // 3. Fetch the master manifest from CDN
  const masterUrl = `https://sec-prod-mediacdn.pw.live/${cdnUuid}/master.m3u8${signedQuery}`;
  let masterText: string;
  try {
    const masterRes = await axios.get(masterUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://physicswallah.live/",
        Origin: "https://physicswallah.live",
      },
      timeout: 10000,
    });
    masterText = masterRes.data.toString();
  } catch (err: any) {
    return res.status(502).json({
      error: signedQuery
        ? "Failed to fetch HLS manifest from CDN"
        : "No cached signed URL found for this UUID. Play the video on the watch page first, or provide ?bid=BATCH_ID&vid=VIDEO_ID"
    });
  }

  // 4. Pre-resolve the HLS key if not cached
  if (!keyHex) {
    try {
      const token = await getAnyActiveToken();
      if (token) {
        const firstVariantMatch = masterText.match(/^(?!#)(.+\.m3u8.*)$/m);
        if (firstVariantMatch) {
          const subPath = firstVariantMatch[1].trim();
          const baseUrl = `https://sec-prod-mediacdn.pw.live/${cdnUuid}/`;
          const subUrl = subPath.startsWith("http") ? subPath : new URL(subPath, baseUrl).href + signedQuery;
          const subRes = await axios.get(subUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              Referer: "https://physicswallah.live/",
              Origin: "https://physicswallah.live",
            },
            timeout: 10000,
          });
          const subText = subRes.data.toString();
          const keyMatch = subText.match(/URI="([^"]*get-hls-key[^"]*)"/);
          if (keyMatch) {
            const resolved = await resolveHlsKey(keyMatch[1], token);
            if (resolved) {
              keyHex = resolved;
              // Update cache with keyHex
              await VideoStream.findOneAndUpdate({ uuid: cdnUuid }, { keyHex }).catch(() => {});
            }
          }
        }
      }
    } catch (e: any) {
      console.warn(`[stream/${cdnUuid}] Key pre-resolve failed:`, e.message);
    }
  }

  // 5. Build and return the proxied manifest
  const manifest = buildProxyManifest(masterText, cdnUuid, signedQuery, keyHex);

  res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("X-Cache-Status", cached ? "HIT" : "MISS");
  return res.status(200).send(manifest);
}
