"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { WifiOff } from "lucide-react";

export default function OfflineOverlay() {
  const [isOffline, setIsOffline] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // Check initial state
    if (typeof navigator !== "undefined") {
      setIsOffline(!navigator.onLine);
    }

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Only show on study pages (excluding watch)
  if (!isOffline) return null;
  if (!pathname?.startsWith("/study") && !pathname?.startsWith("/watch")) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-[#0F1908]/95 backdrop-blur-md text-white flex flex-col items-center justify-center p-8 text-center animate-fadeIn">
      <div className="bg-spring-leaf/10 p-6 rounded-full mb-6">
        <WifiOff className="w-16 h-16 text-spring-mint animate-pulse" />
      </div>
      <h1 className="text-4xl font-bold mb-4 text-[#E8F5E9]">You are Offline</h1>
      <p className="text-xl text-spring-mint/80 max-w-md">
        It looks like you've lost your internet connection. Please check your connection and try again.
      </p>
    </div>
  );
}
