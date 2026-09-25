"use client";
import { useEffect } from "react";

// Fallback UUID generator
function fallbackUUID() {
  // RFC4122 version 4 compliant UUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function ClientRootLayout({ 
  children, 
  serverInfo 
}: { 
  children: React.ReactNode;
  serverInfo?: any;
}) {
  useEffect(() => {
    let anon_id = document.cookie.split('; ').find(row => row.startsWith('anon_id='))?.split('=')[1];
    if (!anon_id) {
      anon_id = (window.crypto?.randomUUID ? window.crypto.randomUUID() : fallbackUUID());
      document.cookie = `anon_id=${anon_id}; path=/; max-age=${60 * 60 * 24 * 30}`;
    }
    fetch('/api/track-anon', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        anon_id,
        useragent: navigator.userAgent,
        ip: '' // IP will be handled server-side if needed
      }),
      keepalive: true,
    });
  }, []);

  // Capture PWA install prompt event globally
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      (window as any).deferredAppPrompt = e;
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  // Make serverInfo available globally
  useEffect(() => {
    if (serverInfo) {
      (window as any).__SERVER_INFO__ = serverInfo;
    }
  }, [serverInfo]);

  return (
    <>
      {/* Floating Flower Petals Background */}
      <div className="petal" style={{ top: '-50px' }} />
      <div className="petal" style={{ top: '-100px' }} />
      <div className="petal" style={{ top: '-75px' }} />
      <div className="petal" style={{ top: '-150px' }} />
      <div className="petal" style={{ top: '-60px' }} />
      <div className="petal" style={{ top: '-120px' }} />
      <div className="petal" style={{ top: '-90px' }} />
      <div className="petal" style={{ top: '-140px' }} />
      <div className="petal" style={{ top: '-110px' }} />
      
      {children}
    </>
  );
} 