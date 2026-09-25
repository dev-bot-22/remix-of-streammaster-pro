"use client";

import { useEffect, useState } from "react";
import HLSPlayer from "@/app/components/HLSPlayer";
import { toast } from "sonner";

export default function LivePage() {
  const [url, seturl] = useState<string | null>(null);
  const [signedUrl, setsignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const batchId = params.get("batchId");
    const subjectId = params.get("SubjectId");
    const childId = params.get("ChildId");
    const startTimeParam = params.get("startTime");

    if (!batchId || !subjectId || !childId) {
      const err = "Missing required query parameters.";
      toast.error(err);
      setErrorMsg(err);
      setLoading(false);
      return;
    }

    const promise = toast.promise(
      fetch(`/api/get-live-url?batchId=${encodeURIComponent(batchId)}&childId=${encodeURIComponent(childId)}&container=HLS`)
        .then(async (res) => {
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.message || "Failed to fetch live video URL");
          }
          const data = await res.json();

          if (!data.success || !data.url) {
            throw new Error("Invalid response from server");
          }

          let fullUrl = data.fullUrl || (data.url + (data.signedUrl || ""));

          // Append start time for DVR/timeline seeking
          if (startTimeParam) {
            const parsedDate = new Date(startTimeParam);
            if (!isNaN(parsedDate.getTime())) {
              const startSecs = Math.floor(parsedDate.getTime() / 1000).toString();
              try {
                const urlObj = new URL(fullUrl);
                urlObj.searchParams.set("start", startSecs);
                fullUrl = urlObj.toString();
              } catch {
                const sep = fullUrl.includes("?") ? "&" : "?";
                fullUrl = `${fullUrl}${sep}start=${startSecs}`;
              }
            }
          }

          // Split base URL from signed query params for HLSPlayer
          const qIdx = fullUrl.indexOf("?");
          if (qIdx !== -1) {
            seturl(fullUrl.slice(0, qIdx));
            setsignedUrl(fullUrl.slice(qIdx));
          } else {
            seturl(fullUrl);
            setsignedUrl("");
          }

          return data;
        }),
      {
        loading: "Loading live stream...",
        success: "Live stream loaded!",
        error: (err) => {
          setErrorMsg(err.message || "Error loading live stream");
          return err.message || "Error loading live stream";
        },
      }
    );

    promise.unwrap().finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen text-white">
        <span>Loading live stream...</span>
      </div>
    );
  }

  if (errorMsg || !url) {
    return (
      <div className="text-red-500 text-center p-4">
        <p>{errorMsg || "Unknown error occurred."}</p>
      </div>
    );
  }

  return <HLSPlayer baseUrl={url} signedQuery={signedUrl || ""} />;
}
