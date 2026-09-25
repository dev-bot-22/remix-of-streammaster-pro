"use client";

import { useEffect, useState } from "react";
import { Clock, ShieldAlert, Key } from "lucide-react";
import Link from "next/link";

interface BatchVerificationBadgeProps {
  batchId?: string;
  className?: string;
}

export function BatchVerificationBadge({ batchId, className = "" }: BatchVerificationBadgeProps) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [expireAt, setExpireAt] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isWarning, setIsWarning] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    async function checkStatus() {
      if (!batchId) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // 1. Check if verification is globally enabled
        const enabledRes = await fetch("/api/auth/verification-enabled");
        if (!enabledRes.ok) return;
        const enabledData = await enabledRes.json();

        if (!enabledData.enabled) {
          if (isMounted) {
            setIsEnabled(false);
            setLoading(false);
          }
          return;
        }

        if (isMounted) setIsEnabled(true);

        // 2. Get anon_id from cookie
        const cookieAnonId = document.cookie
          .split("; ")
          .find((row) => row.startsWith("anon_id="))
          ?.split("=")[1];

        if (!cookieAnonId) {
          if (isMounted) {
            setIsVerified(false);
            setLoading(false);
          }
          return;
        }

        // 3. Fetch verification info for this specific batch
        const url = `/api/auth/check-verification?anon_id=${encodeURIComponent(cookieAnonId)}&batchId=${encodeURIComponent(batchId)}`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();

        if (isMounted) {
          if (data.verified && data.expireAt) {
            setIsVerified(true);
            setExpireAt(data.expireAt);
          } else {
            setIsVerified(false);
            setExpireAt(null);
          }
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to check batch verification status:", err);
        if (isMounted) setLoading(false);
      }
    }

    checkStatus();
    // Re-check status every 60 seconds
    const intervalId = setInterval(checkStatus, 60000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [batchId]);

  // Countdown timer effect
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

  if (!isEnabled || !batchId || loading) {
    return null;
  }

  // Verified & Active state
  if (isVerified && timeLeft && timeLeft !== "Expired") {
    return (
      <div
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm transition-all duration-300 border ${
          isWarning
            ? "bg-amber-500/20 border-amber-500/40 text-amber-300 animate-pulse"
            : "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
        } ${className}`}
        title={`Batch verification active until ${new Date(expireAt!).toLocaleTimeString()}`}
      >
        <Clock className={`w-3.5 h-3.5 ${isWarning ? "text-amber-400" : "text-emerald-400"}`} />
        <span className="text-[11px] opacity-90 hidden xs:inline">Verified:</span>
        <span className="font-mono tracking-tight font-bold">{timeLeft}</span>
      </div>
    );
  }

  // Not Verified / Expired state -> Show Link to Key Generate
  return (
    <Link
      href={`/key-generate?batchId=${batchId}`}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 hover:text-rose-200 transition-all duration-200 active:scale-95 ${className}`}
      title="Click to verify this batch"
    >
      <Key className="w-3.5 h-3.5 text-rose-400" />
      <span>Verify Required</span>
    </Link>
  );
}
