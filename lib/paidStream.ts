// lib/paidStream.ts — server-only helper around the paid stream worker.
//
//   https://pw-paid-stream.raghutiwari554-34f.workers.dev/api/get-video-url
//     ?batchId=..&subjectId=..&childId=..&videoType=penpencilvdo
//
// The worker answers with the PW media-service payload:
//   data.url        → CloudFront manifest (master.mpd for recorded, index.m3u8 for live)
//   data.signedUrl  → "?Signature=..&Key-Pair-Id=..&Policy=.."
//   proxy_stream_url→ the same manifest behind the worker's own proxy
//
// The CloudFront policy covers the whole lecture folder, so the signed HLS
// manifest (master.m3u8) can be derived from the signed MPD — that link is what
// makes recorded HLS playback reliable.
export const PAID_STREAM_API =
  process.env.PAID_STREAM_API ||
  "https://pw-paid-stream.raghutiwari554-34f.workers.dev/api/get-video-url";

export type PaidStream = {
  /** raw manifest url without signature */
  url: string;
  /** "?Signature=..." query string */
  signedUrl: string;
  /** url + signedUrl (direct CloudFront, playable as-is) */
  fullUrl: string;
  /** signed HLS manifest (master.m3u8 / index.m3u8) */
  hlsUrl: string;
  /** signed DASH manifest, empty when the lecture is HLS-only */
  mpdUrl: string;
  /** worker proxy for the DASH manifest */
  proxyStreamUrl: string;
  container: string;
  urlType: string;
  videoId: string;
};

export async function fetchPaidStream(
  ids: { batchId: string; subjectId: string; childId: string },
  opts: { timeoutMs?: number; retries?: number } = {}
): Promise<PaidStream | null> {
  const timeoutMs = opts.timeoutMs ?? 10000;
  const retries = opts.retries ?? 2;

  const api = `${PAID_STREAM_API}?batchId=${encodeURIComponent(
    ids.batchId
  )}&subjectId=${encodeURIComponent(ids.subjectId)}&childId=${encodeURIComponent(
    ids.childId
  )}&videoType=penpencilvdo`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(api, {
        headers: { accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error(`paid stream HTTP ${res.status}`);
      const json: any = await res.json();
      const d = json?.data;
      if (!json?.success || !d?.url) throw new Error(json?.message || "no url");

      const url: string = d.url;
      const signedUrl: string = d.signedUrl || "";
      const fullUrl = url + signedUrl;
      const isMpd = /\.mpd(\?|$)/i.test(url);

      return {
        url,
        signedUrl,
        fullUrl,
        hlsUrl: isMpd ? url.replace(/master\.mpd$/i, "master.m3u8") + signedUrl : fullUrl,
        mpdUrl: isMpd ? fullUrl : "",
        proxyStreamUrl: json?.proxy_stream_url || "",
        container: d.videoContainer || "",
        urlType: d.urlType || "",
        videoId: d.videoId || "",
      };
    } catch (err: any) {
      if (attempt === retries) {
        console.warn("[paidStream]", err?.message || err);
        return null;
      }
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  return null;
}

/** Quick sanity check that a playlist/manifest link really plays (no CDN 403). */
export async function manifestPlayable(link: string, timeoutMs = 7000): Promise<boolean> {
  try {
    const res = await fetch(link, {
      headers: { accept: "*/*", "user-agent": "Mozilla/5.0" },
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return false;
    const head = (await res.text()).slice(0, 400);
    if (/#EXT-X-ERROR/i.test(head)) return false;
    return /#EXTM3U/i.test(head) || /<MPD/i.test(head);
  } catch {
    return false;
  }
}
