// pages/api/primary-stream.ts — single lecture stream API.
//
// One provider only:
//   https://og-stream.raghutiwari554-34f.workers.dev/api/{batch_id}/{subject_id}/{lecture_id}
//
// The link it returns is already a proxied (heroku) playlist that carries the
// signed bunny URL (Policy / Signature / Key-Pair-Id) inside it. That link is
// handed to the player exactly as received — unwrapping it to the raw bunny URL
// returns 403 Access Denied, which is what used to break playback.
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { DEFAULT_PRIMARY_STREAM_API, getAppSettings } from "@/lib/appSettings";
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
 *   .../api/stream.m3u8?url=<encoded .../api/stream.m3u8?url=<encoded bunny>>
 * Collapse that to a single proxy layer (proxy + signed bunny link) — never all
 * the way down to the bare bunny link, which the CDN refuses with 403.
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
  // keep the outermost proxy prefix + the innermost signed link
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const batchId = pick(req.query.batchId);
  const subjectId = pick(req.query.subjectId);
  const lectureId = pick(req.query.lectureId);
  const altLectureId = pick(req.query.altLectureId);

  if (!batchId || !subjectId || !lectureId) {
    return res.status(400).json(decoy());
  }

  // Always the single worker API — stored admin settings / env on the host
  // pointed to an old provider that returns 404, so they are ignored here.
  void getAppSettings;
  const template = DEFAULT_PRIMARY_STREAM_API;

  // Lecture lists expose two ids (video id and content/schedule id). Try the
  // one the watch page prefers, then the other, so every lecture resolves.
  const lectureIds = [lectureId, altLectureId].filter(
    (id, i, arr) => id && arr.indexOf(id) === i
  ) as string[];

  let lastError = "";
  for (const id of lectureIds) {
    const apiUrl = fillTemplate(template, { batchId, subjectId, lectureId: id });

    // small retry: the provider can be briefly slow/cold
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { ok, status, text } = await fetchOnce(apiUrl, 20000);
        if (!ok) {
          lastError = `stream API HTTP ${status}`;
          if (status === 404 || status === 400) break; // wrong id — try the other one
        } else {
          let parsed: any = text;
          try {
            parsed = JSON.parse(text);
          } catch {
            /* plain text response */
          }
          const links = extractLinks(parsed);
          if (links.length === 0) {
            lastError = parsed?.message || "stream API returned no url";
            break; // valid answer, just no link for this id
          }
          const url = normalizeProxyLayers(links[0]);
          // Seal the untouched signed link — the browser only ever gets an
          // opaque token path, never the real stream address.
          let sid = readCookie(req.headers.cookie, SESSION_COOKIE);
          if (!/^[a-f0-9]{48}$/.test(sid)) {
            sid = crypto.randomBytes(24).toString("hex");
            const secure = (req.headers["x-forwarded-proto"] || "").toString().includes("https");
            res.setHeader(
              "Set-Cookie",
              `${SESSION_COOKIE}=${sid}; Path=/api/v; HttpOnly; SameSite=Strict; Max-Age=21600${secure ? "; Secure" : ""}`
            );
          }
          const token = seal({
            k: "p",
            u: url,
            s: sessionHash(sid),
            e: Date.now() + TOKEN_TTL_MS,
            x: crypto.randomBytes(16).toString("hex"),
          });
          res.setHeader("Cache-Control", "no-store");
          return res.status(200).json(
            envelope({
              success: true,
              src: `/api/v/${token}.m3u8`,
              title: parsed?.title || parsed?.data?.title || "",
            })
          );
        }
      } catch (e: any) {
        lastError = e?.name === "AbortError" ? "stream API timed out" : e?.message || String(e);
      }
      if (attempt < 2) await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
  }

  res.setHeader("Cache-Control", "no-store");
  console.warn("[primary-stream]", lastError);
  return res.status(502).json(decoy());
}

