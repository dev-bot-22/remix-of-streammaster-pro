"use client";

import { useEffect, useState } from "react";
import { Clock, KeyRound, Plus } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";

export function VerificationHeaderTimer() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [expireAt, setExpireAt] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [currentBatchId, setCurrentBatchId] = useState<string>("");
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isWarning, setIsWarning] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    let isMounted = true;

    async function checkStatus() {
      try {
        // 1. Check if verification is globally enabled
        const enabledRes = await fetch("/api/auth/verification-enabled");
        if (!enabledRes.ok) return;
        const enabledData = await enabledRes.json();

        if (!enabledData.enabled) {
          if (isMounted) setIsEnabled(false);
          return;
        }
        if (isMounted) setIsEnabled(true);

        // 2. Get anon_id from cookie
        const cookieAnonId = document.cookie
          .split("; ")
          .find((row) => row.startsWith("anon_id="))
          ?.split("=")[1];

        if (!cookieAnonId) return;

        // Extract batchId from URL pathname or localStorage
        let activeBatchId = "";
        const pathMatch = pathname?.match(/\/batches\/([^\/]+)/);
        if (pathMatch && pathMatch[1]) {
          activeBatchId = pathMatch[1];
        } else {
          try {
            const savedBatch = localStorage.getItem("selectedBatch");
            if (savedBatch) {
              const parsed = JSON.parse(savedBatch);
              activeBatchId = parsed?.batchId || parsed?._id || "";
            }
          } catch (e) {}
        }

        if (isMounted) setCurrentBatchId(activeBatchId);

        // 3. Fetch verification info from API
        const url = activeBatchId
          ? `/api/auth/check-verification?anon_id=${encodeURIComponent(cookieAnonId)}&batchId=${encodeURIComponent(activeBatchId)}`
          : `/api/auth/check-verification?anon_id=${encodeURIComponent(cookieAnonId)}`;

        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();

        if (isMounted) {
          if (data.verified && data.expireAt) {
            setIsVerified(true);
            setExpireAt(data.expireAt);
          } else if (Array.isArray(data.verifiedBatches) && data.verifiedBatches.length > 0) {
            const latest = data.verifiedBatches[0];
            if (latest?.expireAt) {
              setIsVerified(true);
              setExpireAt(latest.expireAt);
              if (!activeBatchId && latest.batchId) {
                setCurrentBatchId(latest.batchId);
              }
            }
          } else {
            setIsVerified(false);
            setExpireAt(null);
          }
        }
      } catch (err) {
        console.error("Failed to check verification status for timer:", err);
      }
    }

    checkStatus();

    // Listen to custom batch selection change and storage events
    window.addEventListener("selectedBatchChanged", checkStatus);
    window.addEventListener("storage", checkStatus);

    // Re-check status every 30 seconds
    const intervalId = setInterval(checkStatus, 30000);

    return () => {
      isMounted = false;
      window.removeEventListener("selectedBatchChanged", checkStatus);
      window.removeEventListener("storage", checkStatus);
      clearInterval(intervalId);
    };
  }, [pathname]);

  // Countdown clock effect (updates every 1 second)
  useEffect(() => {
    if (!expireAt || !isVerified) {
      setTimeLeft("");
      return;
    }

    const updateCountdown = () => {
      const remainingMs = new Date(expireAt).getTime() - Date.now();

      if (remainingMs <= 0) {
        setTimeLeft("Expired");
        setIsVerified(false);
        setIsWarning(true);
        return;
      }

      const totalSeconds = Math.floor(remainingMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      setIsWarning(totalSeconds < 1800); // Warning if less than 30 mins

      const pad = (n: number) => n.toString().padStart(2, "0");
      if (hours > 0) {
        setTimeLeft(`${hours}h ${pad(minutes)}m ${pad(seconds)}s`);
      } else {
        setTimeLeft(`${pad(minutes)}m ${pad(seconds)}s`);
      }
    };

    updateCountdown();
    const timerId = setInterval(updateCountdown, 1000);

    return () => clearInterval(timerId);
  }, [expireAt, isVerified]);

  if (!isEnabled) {
    return null;
  }

  // Active Verification State with Plus Button to Extend Time
  if (isVerified && expireAt && timeLeft && timeLeft !== "Expired") {
    return (
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shadow-sm transition-all duration-300 border ${
          isWarning
            ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 animate-pulse"
            : "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
        }`}
        title={`Verification valid until ${new Date(expireAt).toLocaleTimeString()}`}
      >
        <Clock className={`w-3.5 h-3.5 ${isWarning ? "text-amber-500" : "text-emerald-500"}`} />
        <span className="hidden sm:inline text-[11px] opacity-80">Key:</span>
        <span className="font-mono tracking-tight font-bold">{timeLeft}</span>

        {currentBatchId && (
          <Link
            href={`/key-generate?batchId=${currentBatchId}&force=true`}
            className={`ml-1 p-0.5 rounded-full transition-all duration-200 ${
              isWarning
                ? "bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-300"
                : "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-700 dark:text-emerald-300"
            }`}
            title="Add more time / Re-verify key"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          </Link>
        )}
      </div>
    );
  }

  // Unverified / Expired State for selected batch
  if (currentBatchId) {
    return (
      <Link
        href={`/key-generate?batchId=${currentBatchId}`}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-600 dark:text-rose-400 transition-all duration-200"
        title="Verification required for selected batch. Click to verify."
      >
        <KeyRound className="w-3.5 h-3.5 text-rose-500" />
        <span className="font-medium">Verify Key</span>
      </Link>
    );
  }

  return null;
}
