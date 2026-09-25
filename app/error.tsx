'use client';

import { useEffect } from 'react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Global error caught:', error);

    fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      }),
    });
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center relative overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a0a0a] via-[#2a1020] to-[#1a0a0a]" />
        <div className="absolute top-[20%] left-[10%] w-[30vw] h-[30vw] rounded-full bg-red-600/10 blur-[100px] animate-float" />
        <div className="absolute bottom-[10%] right-[10%] w-[25vw] h-[25vw] rounded-full bg-orange-500/10 blur-[80px] animate-float" style={{ animationDelay: "2s" }} />
      </div>

      <div className="glass-modal p-12 text-center animate-scaleIn border-red-500/20">
        <div className="w-16 h-16 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto mb-6">
          <span className="text-3xl">⚠️</span>
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-3">
          Something went wrong
        </h1>
        <p className="text-muted-foreground mb-8 max-w-md">
          {error.message}
        </p>
        <button
          className="btn-3d px-8 py-3 !bg-gradient-to-r !from-red-500 !to-orange-500 hover:!from-red-600 hover:!to-orange-600"
          onClick={() => reset()}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
