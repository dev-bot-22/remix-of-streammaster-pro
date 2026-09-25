"use client";

import React, { useEffect, useState } from "react";
import { Heart, Lock, AlertTriangle } from "lucide-react";

export default function DevToolsDetector() {
  const [isDevToolsOpen, setIsDevToolsOpen] = useState(false);

  // Check if we are running in development or localhost
  const isDev =
    process.env.NODE_ENV === "development" ||
    (typeof window !== "undefined" &&
      (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1"));

  useEffect(() => {
    if (isDev) return;

    // 1. Keyboard Shortcut Blocking
    const handleKeyDown = (e: KeyboardEvent) => {
      // F12
      if (e.key === "F12") {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C
      if (
        e.ctrlKey &&
        e.shiftKey &&
        (e.key === "I" ||
          e.key === "J" ||
          e.key === "C" ||
          e.key === "i" ||
          e.key === "j" ||
          e.key === "c")
      ) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // Ctrl+U (View Source)
      if (e.ctrlKey && (e.key === "U" || e.key === "u")) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    // 2. Right Click Context Menu Blocking
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("contextmenu", handleContextMenu, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("contextmenu", handleContextMenu, true);
    };
  }, [isDev]);

  useEffect(() => {
    // Advanced detection vectors removed due to false positives
    // Keyboard and Context Menu blocking is handled by the first useEffect
  }, [isDev]);

  if (isDev || !isDevToolsOpen) return null;

  return (
    <div className="fixed inset-0 z-[999999] flex flex-col items-center justify-center p-6 bg-gradient-to-br from-[#1E2A22]/95 via-[#131b16]/98 to-[#0a0f0c]/99 select-none backdrop-blur-xl transition-all duration-300">
      {/* Decorative Glowing Elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#4CAF6A]/10 rounded-full blur-[100px] animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#7ED957]/10 rounded-full blur-[100px] animate-pulse delay-700" />

      {/* Main Locked Card */}
      <div className="relative max-w-lg w-full bg-[#1E2A22]/85 border border-[#4CAF6A]/30 backdrop-blur-md rounded-3xl p-10 text-center shadow-2xl shadow-[#4CAF6A]/20 transition-all duration-500 scale-100">
        {/* Pulsing Glowing Icons */}
        <div className="flex justify-center items-center gap-4 mb-8">
          <div className="relative">
            <div className="absolute inset-0 bg-[#FF9ECF]/30 rounded-full blur-md animate-ping" />
            <Heart className="w-16 h-16 text-[#FF9ECF] fill-[#FF9ECF] relative z-10 animate-pulse" />
          </div>
          <div className="relative">
            <div className="absolute inset-0 bg-[#4CAF6A]/30 rounded-full blur-md animate-ping delay-300" />
            <Lock className="w-16 h-16 text-[#4CAF6A] relative z-10 animate-bounce" />
          </div>
        </div>

        {/* Large Aesthetic Typography */}
        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-4">
          dont do it bro
        </h1>

        <p className="text-lg text-[#7ED957] font-semibold mb-6">
          Access Restricted ~ Developer Tools Detected
        </p>

        <div className="h-px bg-gradient-to-r from-transparent via-[#4CAF6A]/30 to-transparent my-6" />

        <p className="text-sm text-gray-300 leading-relaxed">
          To protect study materials and video integrity, inspecting this website is disabled. 
          Please close the Developer Tools menu to unlock access.
        </p>

        {/* Small warning disclaimer */}
        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-gray-500">
          <AlertTriangle className="w-4 h-4 text-[#FFD84D]" />
          <span>If this is a mistake, close DevTools and the screen will auto-unlock.</span>
        </div>
      </div>
    </div>
  );
}
