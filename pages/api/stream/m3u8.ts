import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import dbConnect from "@/lib/mongodb";
import Batch from "@/models/Batch";
import { getVideoHeaders } from "@/utils/auth";
import { Buffer } from "buffer";

// Resolve the HLS decryption key from PenPencil API using any available batch token
async function resolveHlsKey(keyUrl: string, bId: string): Promise<string | null> {
  try {
    await dbConnect();

    // Try to find an active token - first from the specific batch, then from any batch
    let activeToken: any = null;

    if (bId) {
      const batch = await Batch.findOne({ batchId: bId }).lean();
      if (batch && batch.enrolledTokens?.length) {
        activeToken = (batch.enrolledTokens as any[]).find(
          (t: any) => t.tokenStatus === true && !!t.accessToken
        );
      }
    }

    // Fall back to any active token from any batch
    if (!activeToken) {
      const anyBatch = await Batch.findOne({ "enrolledTokens.tokenStatus": true }).lean();
      if (anyBatch && anyBatch.enrolledTokens?.length) {
        activeToken = (anyBatch.enrolledTokens as any[]).find(
          (t: any) => t.tokenStatus === true && !!t.accessToken
        );
      }
    }

    if (!activeToken) {
      console.warn("[m3u8] No active token found to resolve HLS key");
      return null;
    }

    const res = await axios.get(keyUrl, {
      headers: getVideoHeaders(activeToken.accessToken, activeToken.randomId || ""),
      responseType: "arraybuffer",
      timeout: 6000,
    });
    return Buffer.from(res.data).toString("hex");
  } catch (err: any) {
    console.error("[m3u8] Failed to resolve HLS key:", err.message);
    return null;
  }
}

// Construct a valid local HLS format out of the DASH CDN source
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { vid, signed, batchId } = req.query;

  if (!vid || typeof vid !== "string") {
    return res.status(400).json({ error: "Missing 'vid' parameter" });
  }

  const bId = typeof batchId === "string" ? batchId : "";

  // Extract and rebuild the full query parameters (URLPrefix, Expires, KeyName, Signature)
  // because Next.js req.query splits them into separate variables.
  let queryStr = "";
  let signatureParams = "";
  try {
    const urlObj = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
    const params = new URLSearchParams(urlObj.search);
    params.delete("vid");
    params.delete("batchId");

    const signedVal = params.get("signed");
    if (signedVal) {
      params.delete("signed");
      const cleanSigned = signedVal.startsWith("?") ? signedVal.slice(1) : signedVal;
      queryStr = "?" + cleanSigned;
      params.forEach((value, key) => {
        queryStr += `&${key}=${value}`;
      });
      signatureParams = cleanSigned;
      params.forEach((value, key) => {
        signatureParams += `&${key}=${value}`;
      });
    } else {
      const allParams = Array.from(params.entries()).map(([k, v]) => `${k}=${v}`).join("&");
      queryStr = "?" + allParams;
      signatureParams = allParams;
    }
  } catch (e) {
    console.error("[m3u8] Error parsing query params:", e);
    queryStr = typeof signed === "string" ? signed : "";
    signatureParams = queryStr.replace(/^\?/, "");
  }

  // The official streaming HLS base location
  const hlsManifestUrl = `https://sec-prod-mediacdn.pw.live/${vid}/master.m3u8${queryStr}`;

  try {
    const masterResponse = await axios.get(hlsManifestUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://physicswallah.live/",
        Origin: "https://physicswallah.live",
      },
      timeout: 10000,
    });

    const manifestText = masterResponse.data.toString();

    // Pre-resolve the HLS key by fetching the first sub-manifest and extracting the key URL
    let keyHex = "";
    const firstVariantMatch = manifestText.match(/^(?!#)(.+\.m3u8.*)$/m);
    if (firstVariantMatch) {
      try {
        const firstVariantPath = firstVariantMatch[1].trim();
        const baseUrl = `https://sec-prod-mediacdn.pw.live/${vid}/`;
        const subManifestUrl = firstVariantPath.startsWith("http")
          ? firstVariantPath
          : new URL(firstVariantPath, baseUrl).href + queryStr;

        const subResponse = await axios.get(subManifestUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Referer: "https://physicswallah.live/",
            Origin: "https://physicswallah.live",
          },
          timeout: 10000,
        });

        const subText = subResponse.data.toString();
        const keyMatch = subText.match(/URI="([^"]*get-hls-key[^"]*)"/);
        if (keyMatch) {
          const resolved = await resolveHlsKey(keyMatch[1], bId);
          if (resolved) keyHex = resolved;
        }
      } catch (e: any) {
        console.error("[m3u8] Failed to pre-resolve key:", e.message);
      }
    }

    // Rewrite quality sub-manifest URLs to go through our local proxy
    const baseUrl = `https://sec-prod-mediacdn.pw.live/${vid}/`;
    const lines = manifestText.split(/\r?\n/);
    const rewrittenLines = lines.map((line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      // Rewrite URI attributes (like alternative renditions)
      if (trimmed.startsWith("#")) {
        return trimmed.replace(/(URI\s*=\s*["'])([^"']*)(["'])/g, (match, p1, p2, p3) => {
          if (p2.startsWith("http") || p2.startsWith("data:")) return match;
          const absolute = new URL(p2, baseUrl).href;
          const keyParam = keyHex ? `&keyHex=${keyHex}` : "";
          return `${p1}/api/proxy?url=${encodeURIComponent(absolute)}&batchId=${bId}${keyParam}&${signatureParams}${p3}`;
        });
      }

      // Sub-manifest URL line — route through proxy with batchId + keyHex + signatures
      const absoluteVariant = trimmed.startsWith("http") ? trimmed : new URL(trimmed, baseUrl).href;
      const keyParam = keyHex ? `&keyHex=${keyHex}` : "";
      return `/api/proxy?url=${encodeURIComponent(absoluteVariant)}&batchId=${bId}${keyParam}&${signatureParams}`;
    });

    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Access-Control-Allow-Origin", "*");

    return res.status(200).send(rewrittenLines.join("\n"));
  } catch (error: any) {
    console.error("[m3u8] Failed to generate HLS manifest:", error.message);
    return res.status(500).json({ error: "Failed to generate manifest: " + error.message });
  }
}
