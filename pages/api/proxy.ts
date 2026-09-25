import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import dbConnect from "@/lib/mongodb";
import Batch from "@/models/Batch";
import { getVideoHeaders } from "@/utils/auth";
import { Buffer } from "buffer";

async function replaceAsync(
  str: string,
  regex: RegExp,
  asyncFn: (match: string, ...args: any[]) => Promise<string>
): Promise<string> {
  const promises: Promise<string>[] = [];
  str.replace(regex, (match, ...args) => {
    const promise = asyncFn(match, ...args);
    promises.push(promise);
    return match;
  });
  const data = await Promise.all(promises);
  return str.replace(regex, () => data.shift() || "");
}

function makeAbsolute(relative: string, base: string): string {
  try {
    const resolvedUrl = new URL(relative, base);
    const baseUrlObj = new URL(base);
    if (baseUrlObj.search) {
      baseUrlObj.searchParams.forEach((value, key) => {
        if (!resolvedUrl.searchParams.has(key)) {
          resolvedUrl.searchParams.set(key, value);
        }
      });
    }
    return resolvedUrl.href;
  } catch (e) {
    return relative;
  }
}

async function resolveHlsKey(keyUrl: string, bId: string): Promise<string | null> {
  try {
    await dbConnect();
    const batch = await Batch.findOne({ batchId: bId }).lean();
    if (!batch || !batch.enrolledTokens?.length) return null;
    const activeToken = batch.enrolledTokens.find((t: any) => t.tokenStatus === true && !!t.accessToken);
    if (!activeToken) return null;

    const res = await axios.get(keyUrl, {
      headers: getVideoHeaders(activeToken.accessToken, activeToken.randomId || ""),
      responseType: "arraybuffer",
      timeout: 6000,
    });
    return Buffer.from(res.data).toString("hex");
  } catch (err: any) {
    console.error("[proxy resolveHlsKey] Failed to resolve HLS key:", err.message);
    return null;
  }
}

async function rewriteM3U8(manifestText: string, baseUrl: string, batchId: string, keyHex = ""): Promise<string> {
  // Extract signature query params from the signed baseUrl to append to segment proxy URLs
  let sigParams = "";
  try {
    const bu = new URL(baseUrl);
    bu.searchParams.delete("batchId");
    bu.searchParams.delete("keyHex");
    sigParams = bu.search ? bu.search.slice(1) : ""; // strip leading '?'
  } catch (e) {}

  const lines = manifestText.split(/\r?\n/);
  const rewrittenLines = await Promise.all(lines.map(async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return line;

    if (trimmed.startsWith("#")) {
      // Rewrite URI="..." attributes in tag lines
      if (trimmed.includes("URI=")) {
        const rewritten = await replaceAsync(trimmed, /URI\s*=\s*["']([^"'"]*)["']/g, async (match, p1) => {
          if (p1.includes("get-hls-key")) {
            // Use pre-resolved keyHex if available, otherwise look up from DB
            const hexKey = keyHex || await resolveHlsKey(p1, batchId);
            if (hexKey) {
              return `URI="/api/stream/key?hex=${hexKey}"`;
            }
          }
          if (p1.startsWith("http://") || p1.startsWith("https://") || p1.startsWith("data:") || p1.startsWith("blob:")) {
            return match;
          }
          const absolute = makeAbsolute(p1, baseUrl);
          return `URI="${absolute}"`;
        });
        return rewritten;
      }
      return line;
    }

    // Route all segment URLs (including absolute CDN URLs) through /api/proxy with signatures
    const segUrl = (trimmed.startsWith("http://") || trimmed.startsWith("https://"))
      ? trimmed
      : makeAbsolute(trimmed, baseUrl);

    // data: or blob: — return unchanged
    if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) return line;

    if (segUrl.startsWith("http")) {
      const segObj = new URL(segUrl);
      const hasSignature = segObj.searchParams.has("Signature") || 
                           segObj.searchParams.has("signature") || 
                           segObj.searchParams.has("Expires") ||
                           segObj.searchParams.has("expires");
      if (!hasSignature && sigParams) {
        const sep = segObj.search ? "&" : "?";
        return `/api/proxy?url=${encodeURIComponent(segUrl + sep + sigParams)}`;
      }
    }

    return `/api/proxy?url=${encodeURIComponent(segUrl)}`;
  }));
  return rewrittenLines.join("\n");
}

function rewriteMPD(mpdText: string, baseUrl: string): string {
  const baseDir = baseUrl.substring(0, baseUrl.lastIndexOf("/") + 1);
  
  // Find <MPD tag
  const mpdTagMatch = mpdText.match(/<MPD[^>]*>/i);
  if (mpdTagMatch) {
    const mpdTag = mpdTagMatch[0];
    const insertIndex = mpdText.indexOf(mpdTag) + mpdTag.length;
    // Check if BaseURL already exists as a direct child of MPD
    if (!mpdText.includes("<BaseURL>")) {
      return (
        mpdText.slice(0, insertIndex) +
        `\n  <BaseURL>${baseDir}</BaseURL>` +
        mpdText.slice(insertIndex)
      );
    }
  }
  return mpdText;
}

function fixCloudfrontDomain(url: string): string {
  try {
    if (url.includes("cloudfront.net")) {
      const urlObj = new URL(url);
      const policyBase64 = urlObj.searchParams.get("Policy");
      if (policyBase64) {
        let normalizedBase64 = policyBase64.replace(/-/g, "+").replace(/_/g, "/");
        while (normalizedBase64.length % 4) {
          normalizedBase64 += "=";
        }
        const decoded = Buffer.from(normalizedBase64, "base64").toString("utf-8");
        const policyObj = JSON.parse(decoded);
        const resource = policyObj?.Statement?.[0]?.Resource;
        if (resource && typeof resource === "string") {
          const resourceUrl = resource.replace(/\*$/, "");
          const resourceObj = new URL(resourceUrl);
          if (resourceObj.host && resourceObj.host !== urlObj.host) {
            console.log(`[proxy fixCloudfrontDomain] Rewriting host from ${urlObj.host} to ${resourceObj.host}`);
            urlObj.host = resourceObj.host;
            return urlObj.toString();
          }
        }
      }
    }
  } catch (e) {
    console.error("Failed to fix cloudfront domain in proxy:", e);
  }
  return url;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { url: queryUrl } = req.query;

  if (!queryUrl || typeof queryUrl !== "string") {
    return res.status(400).json({ error: "Missing or invalid url parameter." });
  }

  // Extract batchId BEFORE appending params to targetUrl
  const batchIdParam = typeof req.query.batchId === "string" ? req.query.batchId : "";
  
  let targetUrl = queryUrl;
  try {
    const urlObj = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
    const params = new URLSearchParams(urlObj.search);
    params.delete("url");
    params.delete("batchId"); // Never forward batchId to CDN
    params.delete("keyHex");  // Never forward keyHex to CDN
    if (params.toString()) {
      const separator = targetUrl.includes("?") ? "&" : "?";
      targetUrl = `${targetUrl}${separator}${params.toString()}`;
    }
  } catch (e) {
    console.error("[proxy] Error rebuilding target URL:", e);
  }

  targetUrl = fixCloudfrontDomain(targetUrl);

  try {
    const response = await axios.get(targetUrl, {
      responseType: "arraybuffer",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://physicswallah.live/",
        Origin: "https://physicswallah.live",
      },
      timeout: 15000,
    });

    const contentType = response.headers["content-type"] || "application/octet-stream";
    res.setHeader("Content-Type", contentType);

    let data = Buffer.from(response.data);

    // If it's a manifest, convert to string, rewrite paths, and disable aggressive caching
    const isM3U8 = targetUrl.includes(".m3u8") || contentType.includes("mpegurl") || contentType.includes("mpegURL");
    const isMPD = targetUrl.includes(".mpd") || contentType.includes("dash+xml");

    if (isM3U8 || isMPD) {
      let text = data.toString("utf-8");
      if (isM3U8) {
        const keyHexParam = typeof req.query.keyHex === "string" ? req.query.keyHex : "";
        text = await rewriteM3U8(text, targetUrl, batchIdParam, keyHexParam);
      } else {
        text = rewriteMPD(text, targetUrl);
      }
      data = Buffer.from(text, "utf-8");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    } else {
      res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=3600");
    }

    return res.status(200).send(data);
  } catch (error: any) {
    console.error("Proxy error for URL:", targetUrl, error.message);
    const status = error.response?.status || 500;
    return res.status(status).json({
      error: `Proxy failed fetching target: ${error.message}`,
    });
  }
}
