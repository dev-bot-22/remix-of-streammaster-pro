// pages/api/v/[...t].ts — opaque stream vault.
//
// Everything the browser touches is a token:
//   /api/v/<token>.m3u8  → playlist (all inner links rewritten to tokens)
//   /api/v/<token>.ts    → segment, AES-128 encrypted on the wire
//   /api/v/<token>.key   → the AES key, session-bound
//
// Real upstream addresses (signed bunny/heroku links) never leave the server.
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import {
  SESSION_COOKIE,
  TOKEN_TTL_MS,
  decoy,
  open as openToken,
  readCookie,
  seal,
  sessionHash,
} from "@/lib/streamVault";

export const config = { api: { responseLimit: false } };

function junk(res: NextApiResponse, status = 200) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");
  return res.status(status).json(decoy());
}

async function upstream(url: string) {
  return fetch(url, {
    headers: { accept: "*/*", "user-agent": "Mozilla/5.0" },
    cache: "no-store",
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const parts = Array.isArray(req.query.t) ? req.query.t : [req.query.t || ""];
  const last = String(parts[parts.length - 1] || "");
  const dot = last.lastIndexOf(".");
  const token = dot > 0 ? last.slice(0, dot) : last;
  const ext = dot > 0 ? last.slice(dot + 1).toLowerCase() : "";

  const payload = openToken(token);
  if (!payload) return junk(res, 200);

  const sid = readCookie(req.headers.cookie, SESSION_COOKIE);
  if (!sid || sessionHash(sid) !== payload.s) return junk(res, 200);

  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  const keyHex = payload.x || "";

  try {
    // ── AES key delivery ────────────────────────────────────────────────
    if (payload.k === "key") {
      if (!keyHex) return junk(res);
      res.setHeader("Content-Type", "application/octet-stream");
      return res.status(200).send(Buffer.from(keyHex, "hex"));
    }

    // ── Segment: fetch upstream, encrypt before it hits the wire ────────
    if (payload.k === "s") {
      const r = await upstream(payload.u || "");
      if (!r.ok) return junk(res);
      const body = Buffer.from(await r.arrayBuffer());
      res.setHeader("Content-Type", "video/mp2t");
      if (!keyHex || !payload.i) return res.status(200).send(body);
      const c = crypto.createCipheriv(
        "aes-128-cbc",
        Buffer.from(keyHex, "hex"),
        Buffer.from(payload.i, "hex")
      );
      return res.status(200).send(Buffer.concat([c.update(body), c.final()]));
    }

    // ── Playlist: rewrite every inner link into a token ─────────────────
    const r = await upstream(payload.u || "");
    if (!r.ok) return junk(res);
    const text = await r.text();
    const exp = Date.now() + TOKEN_TTL_MS;
    const base = payload.u || "";

    // Resolve relative upstream links while carrying over the signed query
    // string: CloudFront signs the whole lecture folder with one policy, and
    // that signature lives in the master playlist's query params. Dropping it
    // when resolving "hls/720/main.m3u8" makes every variant request 403.
    const abs = (u: string) => {
      try {
        const resolved = new URL(u, base);
        if (!u.includes("?") && base.includes("?")) {
          resolved.search = base.slice(base.indexOf("?") + 1);
        }
        return resolved.toString();
      } catch {
        return u;
      }
    };

    let index = 0;
    const out: string[] = [];
    const upstreamEncrypted = /#EXT-X-KEY:(?![^\n]*METHOD=NONE)/.test(text);

    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();

      if (!line) {
        out.push("");
        continue;
      }

      if (line.startsWith("#")) {
        // Upstream key/map/media URIs also get tokenised
        if (/URI="/.test(line)) {
          out.push(
            line.replace(/URI="([^"]+)"/g, (_m, u) => {
              const t = seal({ k: "s", u: abs(u), s: payload.s, e: exp });
              return `URI="/api/v/${t}.ts"`;
            })
          );
          continue;
        }
        out.push(line);
        continue;
      }

      // media line
      const absUrl = abs(line);
      if (/\.m3u8(\?|$)/i.test(absUrl)) {
        const t = seal({ k: "p", u: absUrl, s: payload.s, e: exp, x: keyHex });
        out.push(`/api/v/${t}.m3u8`);
        continue;
      }

      const segKey = upstreamEncrypted ? "" : keyHex;
      if (segKey) {
        const iv = crypto.createHash("md5").update(`${payload.s}:${index}:${absUrl}`).digest("hex");
        const kt = seal({ k: "key", s: payload.s, e: exp, x: segKey });
        // key tag goes before this segment's #EXTINF
        let at = out.length;
        for (let j = out.length - 1; j >= 0; j--) {
          if (out[j].startsWith("#EXTINF")) { at = j; break; }
          if (!out[j].startsWith("#")) break;
        }
        out.splice(at, 0, `#EXT-X-KEY:METHOD=AES-128,URI="/api/v/${kt}.key",IV=0x${iv}`);
        out.push(`/api/v/${seal({ k: "s", u: absUrl, s: payload.s, e: exp, x: segKey, i: iv })}.ts`);
      } else {
        out.push(`/api/v/${seal({ k: "s", u: absUrl, s: payload.s, e: exp })}.ts`);
      }
      index++;
    }

    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    return res.status(200).send(out.join("\n"));
  } catch (e: any) {
    console.warn("[vault]", e?.message || e);
    return junk(res);
  }
}
