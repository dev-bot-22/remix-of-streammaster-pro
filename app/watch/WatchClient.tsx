"use client";

import React, { useEffect, useState } from "react";
import { openEnvelope } from "@/utils/streamEnvelope";
import dynamic from "next/dynamic";
import { useSearchParams, useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { BRAND_LOGO } from "@/lib/branding";
import "../globals.css";
import { toast } from "sonner";

const YouTubePlayer = dynamic(() => import("@/app/components/YouTubePlayer"), {
  ssr: false,
});

const DashPlayer = dynamic(() => import("@/app/components/dashPlayer"), {
  ssr: false,
});

const HLSPlayer = dynamic(() => import("@/app/components/HLSPlayer"), {
  ssr: false,
});

export default function WatchPageClient() {
  const params = useSearchParams();
  const router = useRouter();

  const [videoType, setVideoType] = useState<"youtube" | "penpencilvdo" | null>(
    null
  );
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [clearKeys, setClearKeys] = useState<any>(null);
  const [signedUrlQuery, setSignedUrlQuery] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [downloadUrl, setDownloadUrl] = useState<string>("");
  const [isBatchUnavailable, setIsBatchUnavailable] = useState(false);
  const [lectureData, setLectureData] = useState<any>(null);

  // Params
  const batchId = params?.get("batchId") || "";
  const subjectId = params?.get("SubjectId") || "";
  const topicId = params?.get("topicId") || "";
  const ContentId = params?.get("ContentId") || params?.get("ChildId") || "";
  const videoId = params?.get("videoId") || "";
  // The primary stream service expects the nested videoDetails ID, while the
  // enrolled-batch fallback expects the schedule/content ID.
  const primaryLectureId = videoId || ContentId;

  const saveWatchHistory = (lecture: {
    id: string;
    title: string;
    thumbnail: string;
    duration: string;
    batchId: string;
    subjectId: string;
    type: string;
    videoUrl: string;
    isLocked: boolean;
  }) => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("watchHistory") || "[]";
      const history = JSON.parse(raw);

      const now = new Date();
      const timeString = now.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const dateString = now.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
      });

      const historyItem = {
        ...lecture,
        formattedTime: `${dateString} at ${timeString}`,
        timestamp: now.getTime(),
      };

      const filtered = history.filter((item: any) => item.id !== lecture.id);
      filtered.unshift(historyItem);

      const limited = filtered.slice(0, 4);
      localStorage.setItem("watchHistory", JSON.stringify(limited));
    } catch (err) {
      console.error("Failed to save watch history:", err);
    }
  };

  // Clean up VideoUrl from query params to keep the address bar clean
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has("VideoUrl") || urlParams.has("videoUrl")) {
        urlParams.delete("VideoUrl");
        urlParams.delete("videoUrl");
        const newSearch = urlParams.toString();
        const newPath = window.location.pathname + (newSearch ? `?${newSearch}` : "");
        window.history.replaceState(null, "", newPath);
      }
    }
  }, []);

  useEffect(() => {
    if (!batchId || !subjectId || !ContentId) return;

    const controller = new AbortController();
    const signal = controller.signal;

    const typeParam = params?.get("Type") || "";
    const titleParam = params?.get("title") || "";

    const fetchVideoData = async () => {
      setLoading(true);
      setIsBatchUnavailable(false);
      setFallbackUrl(null);
      setSignedUrlQuery("");
      setClearKeys(null);
      setDownloadUrl("");

      // YouTube lectures keep their existing behaviour (no stream API needed).
      if (typeParam === "youtube") {
        try {
          const scheduleRes = await fetch(
            `/api/Schedule?BatchId=${batchId}&SubjectId=${subjectId}&ContentId=${ContentId}`,
            { signal }
          );
          const scheduleData = scheduleRes.ok ? await scheduleRes.json() : null;
          if (signal.aborted) return;
          const url = scheduleData?.data?.url || "";
          if (!url) {
            setVideoType(null);
            return;
          }
          const meta = {
            id: ContentId,
            title: scheduleData?.data?.topic || titleParam || "Lecture",
            thumbnail: scheduleData?.data?.videoDetails?.image || "/assets/img/video-placeholder.svg",
            duration: scheduleData?.data?.videoDetails?.duration || "",
            batchId,
            subjectId,
            type: "youtube",
            videoUrl: url,
            isLocked: false,
          };
          setVideoType("youtube");
          setVideoUrl(url);
          setLectureData(meta);
          saveWatchHistory(meta);
        } catch (err: any) {
          if (err?.name !== "AbortError" && !signal.aborted) setVideoType(null);
        } finally {
          if (!signal.aborted) setLoading(false);
        }
        return;
      }

      // Every other lecture: ONE api call, and its url is played as-is.
      try {
        // lecture lists carry two ids (video id and content id); pass both so
        // the api can fall back to the other one if the first does not resolve
        const altLectureId = videoId ? ContentId : videoId;
        const res = await fetch(
          `/api/primary-stream?batchId=${encodeURIComponent(batchId)}&subjectId=${encodeURIComponent(
            subjectId
          )}&lectureId=${encodeURIComponent(primaryLectureId)}&altLectureId=${encodeURIComponent(
            altLectureId
          )}`,
          { signal, cache: "no-store" }
        );
        if (signal.aborted) return;

        const env = res.ok ? await res.json() : null;
        const data: any = env ? await openEnvelope(env) : null;
        if (signal.aborted) return;
        const streamUrl: string = data?.src || "";
        const dashUrl: string = data?.dash || "";

        const hasHls = typeof streamUrl === "string" && streamUrl.startsWith("/api/v/");
        const hasDash = typeof dashUrl === "string" && dashUrl.startsWith("http");

        if (!data?.success || (!hasHls && !hasDash)) {
          setVideoType(null);
          setIsBatchUnavailable(true);
          toast.error("Lecture stream not available right now. Please try again.");
          return;
        }

        const meta = {
          id: primaryLectureId,
          title: data?.title || titleParam || "Lecture",
          thumbnail: "/assets/img/video-placeholder.svg",
          duration: "",
          batchId,
          subjectId,
          type: "penpencilvdo",
          videoUrl: "",
          isLocked: false,
        };

        if (data?.clearKeys) setClearKeys(data.clearKeys);
        // both formats stay available: HLS plays first, DASH is one tap away
        setFallbackUrl(hasHls && hasDash ? dashUrl : null);
        setVideoType("penpencilvdo");
        setVideoUrl(hasHls ? streamUrl : dashUrl);
        setLectureData(meta);
        saveWatchHistory(meta);

      } catch (err: any) {
        if (err?.name === "AbortError" || signal.aborted) return;
        console.error("Video setup failed:", err);
        setVideoType(null);
        toast.error("Could not load this lecture. Please try refreshing the page.");
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    };

    fetchVideoData();

    return () => {
      controller.abort();
    };
  }, [batchId, subjectId, topicId, ContentId, primaryLectureId, videoId]);


  // ✅ Auto-rotate to landscape for all video types
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleFullscreenChange = () => {
      const isFullscreen = !!document.fullscreenElement;

      if (isFullscreen && (screen.orientation && typeof (screen.orientation as any).lock === "function")) {
        (screen.orientation as any).lock("landscape").catch((err: unknown) => {
          console.warn("Orientation lock failed:", err);
        });
      } else if (screen.orientation?.unlock) {
        screen.orientation.unlock?.();
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // The player never swaps formats on its own — the viewer decides.
  const handleHLSError = (error: any) => {
    console.warn("HLS playback error", error);
    if (fallbackUrl) {
      toast.error("Playback problem. Tap 'Change player' to try the other format.");
    } else {
      toast.error("Video streaming failed. Please try again.");
    }
  };

  const switchPlayer = () => {
    if (!fallbackUrl || !videoUrl) return;
    const next = fallbackUrl;
    setFallbackUrl(videoUrl);
    setVideoUrl(next);
    toast.info(next.includes(".m3u8") ? "Switched to HLS player" : "Switched to DASH player");
  };


  return (
    <div className="h-[100%] md:overflow-auto lg:overflow-hidden select-none">
      <div className="relative" style={{ height: "100%" }}>
        {loading && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-[#0b1220] via-[#101c2b] to-[#0b1a18] text-white">
            <div className="flex flex-col items-center max-w-sm w-full mx-4 text-center">
              {/* Pulsing connection rings around the app logo */}
              <div className="relative w-28 h-28 mb-8 flex items-center justify-center">
                <span className="absolute inset-0 rounded-full border border-emerald-400/40 animate-ping" style={{ animationDuration: "2s" }} />
                <span className="absolute inset-3 rounded-full border border-emerald-400/30 animate-ping" style={{ animationDuration: "2.6s" }} />
                <span className="absolute inset-6 rounded-full bg-emerald-500/10 blur-md" />
                <img
                  src={BRAND_LOGO}
                  alt="PW-MARCO"
                  fetchPriority="high"
                  className="relative w-16 h-16 object-contain drop-shadow-[0_0_18px_rgba(16,185,129,0.55)]"
                />
              </div>

              <h3 className="text-xl font-bold tracking-tight">
                Connecting to PW-MARCO
              </h3>

              <p className="mt-2 text-sm text-emerald-300/90 flex items-center justify-center gap-1">
                Getting video URL
                <span className="inline-flex gap-0.5">
                  <span className="w-1 h-1 rounded-full bg-emerald-300 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1 h-1 rounded-full bg-emerald-300 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1 h-1 rounded-full bg-emerald-300 animate-bounce" style={{ animationDelay: "300ms" }} />
                </span>
              </p>

              {/* Sliding connection beam */}
              <div className="w-56 h-[3px] mt-8 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-marco-beam" />
              </div>

              <p className="mt-4 text-[11px] uppercase tracking-[0.2em] text-white/40">
                Secure stream handshake
              </p>
            </div>
          </div>
        )}

        {!loading && !isBatchUnavailable && videoType === "youtube" && videoUrl && (
          <YouTubePlayer videoId={extractYouTubeVideoId(videoUrl)} ContentId={ContentId} />
        )}

        {!loading && !isBatchUnavailable && videoType === "penpencilvdo" && videoUrl ? (
          <>
            {fallbackUrl && (
              <button
                onClick={switchPlayer}
                className="absolute top-3 right-3 z-40 rounded-full bg-black/60 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur-md hover:bg-black/80 active:scale-95 transition"
              >
                Change player
              </button>
            )}
            {videoUrl.includes(".m3u8") ? (
              <HLSPlayer
                baseUrl={videoUrl}
                signedQuery={signedUrlQuery}
                attachments={attachments}
                downloadUrl={downloadUrl || undefined}
                lectureTitle={lectureData?.title || ""}
                lectureThumbnail={lectureData?.thumbnail || ""}
                onError={handleHLSError}
              />
            ) : (
              <DashPlayer
                src={videoUrl}
                type="dash"
                attachments={attachments}
                signedUrlQuery={signedUrlQuery}
                drmConfig={clearKeys ? { clearKeys } : undefined}
                ContentId={ContentId}
                lectureTitle={lectureData?.title || ""}
                lectureThumbnail={lectureData?.thumbnail || ""}
                batchId={batchId}
              />
            )}
          </>
        ) : !loading && (videoType === null || isBatchUnavailable) ? (

          <div className="flex flex-col items-center justify-center min-h-[400px] h-full p-6 text-center bg-gradient-to-br from-[#eef7f0] via-[#e4f6e8] to-[#f5f8ff] dark:from-[#0F1908] dark:via-[#1C2B22] dark:to-[#151D1A] transition-colors duration-300">
            <div className="w-full max-w-md p-8 rounded-2xl bg-white/80 dark:bg-[#1c2b22]/80 backdrop-blur-md shadow-xl border border-red-500/10 flex flex-col items-center animate-scaleIn">
              <Heart className="w-16 h-16 text-red-500 fill-red-500 animate-pulse mb-4 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3 leading-snug">
                This batch is unavailable. Ask your friend to donate this.
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
                If your friend has this batch, then login here and that batch will be automatically added.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
                <button
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      sessionStorage.setItem("donate_batch_id", batchId);
                    }
                    router.push("/study/donate");
                  }}
                  className="px-6 py-2.5 spring-btn-primary flex items-center justify-center gap-2 shadow-md"
                >
                  <Heart size={15} fill="#ffffff" />
                  Donate Batch
                </button>
                <button
                  onClick={() => router.back()}
                  className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-xl transition-all duration-300 active:scale-95"
                >
                  Go Back
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// Extract YouTube video ID helper
function extractYouTubeVideoId(url: string): string {
  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.hostname === "youtu.be") {
      return parsedUrl.pathname.slice(1);
    }

    const vParam = parsedUrl.searchParams.get("v");
    if (vParam && vParam.length === 11) {
      return vParam;
    }

    const match = parsedUrl.pathname.match(
      /\/(embed|v|shorts)\/([a-zA-Z0-9_-]{11})/
    );
    if (match && match[2]) {
      return match[2];
    }

    return "";
  } catch {
    return "";
  }
}
