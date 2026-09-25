'use client';
export const dynamic = 'force-dynamic';

import { useEffect } from 'react';
import "./globals.css";

export default function NotFound() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      console.warn('404 - Page not found:', window.location.pathname);

      fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: window.location.pathname,
          timestamp: new Date().toISOString(),
        }),
      }).catch((err) => console.error('Logging 404 failed:', err));
    }
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center relative overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0f0f23] via-[#1a1028] to-[#0f0f23]" />
        <div className="absolute top-[20%] left-[10%] w-[30vw] h-[30vw] rounded-full bg-purple-600/10 blur-[100px] animate-float" />
        <div className="absolute bottom-[10%] right-[10%] w-[25vw] h-[25vw] rounded-full bg-cyan-500/10 blur-[80px] animate-float" style={{ animationDelay: "2s" }} />
      </div>

      <div className="glass-modal p-12 text-center animate-scaleIn">
        <h1 className="text-8xl font-extrabold bg-gradient-to-r from-purple-400 to-cyan-300 bg-clip-text text-transparent mb-4">
          404
        </h1>
        <p className="text-xl text-foreground/70 mb-8">
          This page could not be found.
        </p>
        <a href="/study" className="btn-3d px-8 py-3 inline-block text-base">
          Go back home
        </a>
      </div>
    </div>
  );
}
