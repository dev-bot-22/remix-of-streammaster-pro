"use client";

import { useState, useEffect } from "react";
import { ArrowRight, Leaf } from "lucide-react";
import Link from "next/link";

export default function Home() {
  const [serverInfo, setServerInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchServerInfo() {
      try {
        const res = await fetch("/api/auth/serverInfo");
        if (!res.ok) throw new Error("Failed to fetch server info");
        const data = await res.json();
        setServerInfo(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchServerInfo();
  }, []);

  const appName = serverInfo?.webName || process.env.NEXT_PUBLIC_APP_NAME || "PW-MARCO";

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">
      {/* Spring Garden Hero Section */}
      <div className="hero-garden">
        {/* Decorative Leaf Icon */}
        <div className="hero-leaf-icon">🌿</div>

        {/* Main Title with Soft Glow */}
        <h1 className="hero-title" style={{
          textShadow: "0 4px 20px rgba(100,180,120,0.35)"
        }}>
          Welcome to {appName}
        </h1>

        {/* Subtitle */}
        <p className="hero-subtitle">
          A calm and beautiful place to learn every day.
        </p>

        {/* Action Buttons with Glass Panel */}
        <div className="hero-buttons-container">
          <div className="hero-buttons">
            <Link href="/study">
              <button className="btn-garden btn-primary-garden">
                Start Studying 🌿
              </button>
            </Link>
            {serverInfo?.loginEnabled ? (
              <Link href="/auth">
                <button className="btn-garden btn-secondary-garden">
                  Login 🔐
                </button>
              </Link>
            ) : (
              <Link href="/study/mybatches">
                <button className="btn-garden btn-secondary-garden">
                  My Batches 📚
                </button>
              </Link>
            )}
          </div>
        </div>

        {/* Description Tags */}
        <div className="hero-description">
          100% Free • Smooth Learning • Made for Students
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-20 py-6 text-center text-sm opacity-70">
        <p className="text-forest-dark">
          © {new Date().getFullYear()} {appName}. Grow your skills every day. 🌱
        </p>
      </footer>
    </div>
  );
}