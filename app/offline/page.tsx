"use client";

import React from "react";
import { WifiOff, RefreshCw } from "lucide-react";
import "../globals.css";

export default function OfflineFallbackPage() {
  const handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1908] text-white flex flex-col items-center justify-center p-6 text-center select-none relative overflow-hidden">
      {/* Dynamic background gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-spring-leaf/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-spring-mint/5 blur-[120px] pointer-events-none" />

      {/* Decorative leaf/garden pattern elements */}
      <div className="absolute top-10 left-10 text-3xl opacity-10">🌿</div>
      <div className="absolute bottom-10 right-10 text-3xl opacity-10">🌱</div>

      <div className="z-10 max-w-md w-full p-8 rounded-3xl bg-white/[0.03] border border-white/[0.05] backdrop-blur-xl shadow-2xl flex flex-col items-center animate-scaleIn">
        {/* Animated Icon Container */}
        <div className="bg-spring-leaf/10 p-6 rounded-full mb-6 relative group">
          <div className="absolute inset-0 rounded-full bg-spring-mint/10 blur-md group-hover:scale-110 transition-transform duration-300" />
          <WifiOff className="w-16 h-16 text-spring-mint animate-pulse relative z-10" />
        </div>

        {/* Title */}
        <h1 className="text-3xl font-extrabold mb-3 text-[#E8F5E9] tracking-tight bg-clip-text bg-gradient-to-r from-white via-gray-100 to-spring-mint">
          You are Offline
        </h1>

        {/* Description */}
        <p className="text-sm text-[#A5D6A7] mb-8 leading-relaxed">
          It looks like you've lost your internet connection. Please check your connection and try again.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 w-full">

          <button
            onClick={handleReload}
            className="flex items-center justify-center gap-2 px-6 py-3.5 bg-white/[0.04] border border-white/[0.08] text-[#E8F5E9] hover:bg-white/[0.08] hover:border-white/[0.12] transition-all duration-300 font-semibold rounded-2xl active:scale-98 text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Retry Connection
          </button>
        </div>
      </div>

      {/* Small subtle branding footer */}
      <div className="absolute bottom-6 left-0 right-0 text-center text-xs text-spring-mint/30">
        PW-MARCO Offline Mode 🌱
      </div>
    </div>
  );
}
