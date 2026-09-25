// pages/api/primary-stream.ts — lecture stream resolver (recorded lectures).
//
// HLS (primary, admin panel API):
//   https://og-stream.raghutiwari554-34f.workers.dev/api/{batch_id}/{subject_id}/{lecture_id}
// That provider hands back a proxied playlist. It is used only when it really
// plays: the link is verified server-side first, because an unsigned/cold
// proxy answers with a CDN 403 which used to reach the player as "error, works
// after refresh".
//
// When it does not play, the signed HLS manifest from the paid stream worker is
// used instead (same lecture folder, valid CloudFront signature).
//
// DASH: the paid stream worker's proxy_stream_url, sent alongside so the player
// can switch between HLS and DASH.
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { DEFAULT_PRIMARY_STREAM_API, getAppSettings } from "@/lib/appSettings";
import { fetchPaidStream, manifestPlayable } from "@/lib/paidStream";
import { extractKidFromMpd, fetchClearKeysFromPwThor } from "@/utils/drmResolver";
import {
  SESSION_COOKIE,
  TOKEN_TTL_MS,
  decoy,
  envelope,
  readCookie,
  seal,
  sessionHash,
} from "@/lib/streamVault";

function pick(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) || "";
}

/** Fill {batch_id}/{subject_id}/{lecture_id} placeholders. */
function fillTemplate(
  template: string,
  ids: { batchId: string; subjectId: string; lectureId: string }
) {
  return template
    .replace(/\{batch_?id\}/gi, encodeURIComponent(ids.batchId))
    .replace(/\{subject_?id\}/gi, encodeURIComponent(ids.subjectId))
    .replace(/\{lecture_?id\}/gi, encodeURIComponent(ids.lectureId))
    // legacy 4-id templates: the topic slot is not used any more
    .replace(/\/\{topic_?id\}/gi, "");
}

/**
 * The provider sometimes double-wraps its own proxy:
 *   .../api/stream.m3u8?url=<encoded .../api/stream.m3u8?url=<encoded cdn>>
 * Collapse that to a single proxy layer — the extra hop is what makes the first
 * load crawl.
 */
function normalizeProxyLayers(url: string): string {
  const PARAM = /^(.*?[?&]url=)(.+)$/i;
  const layers: string[] = [];
  let cur = url;

  for (let i = 0; i < 6; i++) {
    const m = cur.match(PARAM);
    if (!m) break;
    let inner = m[2];
    try {
      inner = decodeURIComponent(inner);
    } catch {
      /* keep as-is */
    }
    if (!/^https?:\/\//i.test(inner) || inner === cur) break;
    layers.push(m[1]);
    cur = inner;
  }

  if (layers.length <= 1) return url;
  return `${layers[0]}${encodeURIComponent(cur)}`;
}

/** Pull every usable link out of the provider response, in preference order. */
function extractLinks(payload: any): string[] {
  if (!payload) return [];
  if (typeof payload === "string") {
    const m = payload.match(/https?:\/\/[^\s"']+/i);
    return m ? [m[0]] : [];
  }
  const order = [
    payload.streamUrl,
    payload.stream_url,
    payload.stream,
    payload.m3u8Url,
    payload.m3u8_url,
    payload.m3u8,
    payload.url,
    payload.playbackUrl,
    payload.playback_url,
    payload.hls,
    payload.hlsUrl,
  ];
  const out: string[] = [];
  for (const c of order) {
    if (typeof c === "string" && c.startsWith("http") && !out.includes(c)) out.push(c);
  }
  if (payload.data) for (const c of extractLinks(payload.data)) if (!out.includes(c)) out.push(c);
  return out;
}

async function fetchOnce(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const upstream = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json, text/plain, */*" },
      cache: "no-store",
    });
    const text = await upstream.text();
    return { ok: upstream.ok, status: upstream.status, text };
  } finally {
    clearTimeout(timer);
  }
}

/** og-stream lookup: returns a link only when it actually plays. */
async function resolveOgStreamLink(
  ids: { batchId: string; subjectId: string; lectureIds: string[] },
  template: string
): Promise<{ url: string; title: string } | null> {


  for (const id of ids.lectureIds) {
    const apiUrl = fillTemplate(template, {
      batchId: ids.batchId,
      subjectId: ids.subjectId,
      lectureId: id,
    });

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { ok, status, text } = await fetchOnce(apiUrl, 8000);
        if (!ok) {
          if (status === 404 || status === 400) break; // wrong id — try the other one
        } else {
          let parsed: any = text;
          try {
            parsed = JSON.parse(text);
          } catch {
            /* plain text response */
          }
          const links = extractLinks(parsed);
          if (links.length === 0) break;
          const url = normalizeProxyLayers(links[0]);
          if (await manifestPlayable(url)) {
            return { url, title: parsed?.title || parsed?.data?.title || "" };
          }
          break; // provider answered but the link is dead (CDN 403) — use signed HLS
        }
      } catch {
        /* timeout / network — retry once */
      }
      if (attempt === 0) await new Promise((r) => setTimeout(r, 400));
    }
  }
  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const batchId = pick(req.query.batchId);
  const subjectId = pick(req.query.subjectId);
  const lectureId = pick(req.query.lectureId);
  const altLectureId = pick(req.query.altLectureId);

  if (!batchId || !subjectId || !lectureId) {
    return res.status(400).json(decoy());
  }

  // Admin panel template wins when it still carries the id placeholders.
  let template = DEFAULT_PRIMARY_STREAM_API;
  try {
    const settings = await getAppSettings();
    const custom = (settings?.primaryStreamApi || "").trim();
    if (/^https:\/\//i.test(custom) && /\{lecture_?id\}/i.test(custom)) template = custom;
  } catch {
    /* settings unavailable — use the shipped default */
  }

  const lectureIds = [lectureId, altLectureId].filter(
    (id, i, arr) => id && arr.indexOf(id) === i
  ) as string[];

  // HLS (og-stream) and the paid worker (signed HLS fallback + DASH) in parallel
  const [og, paid] = await Promise.all([
    resolveOgStreamLink({ batchId, subjectId, lectureIds }, template),

    (async () => {
      for (const id of lectureIds) {
        const s = await fetchPaidStream({ batchId, subjectId, childId: id }, { retries: 1 });
        if (s) return s;
      }
      return null;
    })(),
  ]);

  const hlsLink = og?.url || paid?.hlsUrl || "";
  const dashLink = paid?.proxyStreamUrl || paid?.mpdUrl || "";

  if (!hlsLink && !dashLink) {
    res.setHeader("Cache-Control", "no-store");
    console.warn("[primary-stream] no playable link for", batchId, lectureId);
    return res.status(502).json(decoy());
  }

  // ClearKeys for the DASH manifest (best effort — HLS does not need them).
  let clearKeys: Record<string, string> | null = null;
  if (paid?.mpdUrl) {
    try {
      const kid = await extractKidFromMpd(paid.mpdUrl);
      if (kid) clearKeys = await fetchClearKeysFromPwThor(kid);
    } catch {
      /* ignore — player will report if the stream is protected */
    }
  }

  // Seal the HLS link — the browser only ever gets an opaque token path.
  let sid = readCookie(req.headers.cookie, SESSION_COOKIE);
  if (!/^[a-f0-9]{48}$/.test(sid)) {
    sid = crypto.randomBytes(24).toString("hex");
    const secure = (req.headers["x-forwarded-proto"] || "").toString().includes("https");
    res.setHeader(
      "Set-Cookie",
      `${SESSION_COOKIE}=${sid}; Path=/api/v; HttpOnly; SameSite=Strict; Max-Age=21600${secure ? "; Secure" : ""}`
    );
  }

  let src = "";
  if (hlsLink) {
    const token = seal({
      k: "p",
      u: hlsLink,
      s: sessionHash(sid),
      e: Date.now() + TOKEN_TTL_MS,
      x: crypto.randomBytes(16).toString("hex"),
    });
    src = `/api/v/${token}.m3u8`;
  }

  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json(
    envelope({
      success: true,
      src,
      dash: dashLink,
      clearKeys,
      title: og?.title || "",
    })
  );
}
