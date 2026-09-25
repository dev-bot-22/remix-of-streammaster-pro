"use client";
import React, { useEffect, useState } from "react";
import { ArrowLeft, InfoIcon, TriangleAlert, Shield, CheckCircle, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SpringCard, SpringButton, SpringBadge } from "@/components/spring";

export default function KeyGenerateClient({
  anon_id,
  batchId,
  iphash,
  useragent,
  token,
  batchName,
  batchImage,
  shortnerServers = [],
  rawVerifyUrl = "",
}: {
  anon_id: string;
  batchId: string;
  iphash: string;
  useragent: string;
  token: string;
  batchName: string;
  batchImage: string;
  shortnerServers?: Array<{ name: string; api_url: string; api_key: string; _id?: string; shortenedUrl?: string }>;
  rawVerifyUrl?: string;
}) {
  const [serverInfo, setServerInfo] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    async function fetchServerInfo() {
      try {
        const res = await fetch("/api/auth/serverInfo");
        if (!res.ok) throw new Error("Failed to fetch server info");
        const data = await res.json();
        setServerInfo(data);
      } catch (err) {
        setError("Could not load server info");
      } finally {
        setLoading(false);
      }
    }
    fetchServerInfo();
  }, []);

  return (
    <div className="min-h-screen spring-bg-gradient flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative Drifting Petals for Spring Theme */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-10 left-[10%] w-4 h-4 bg-spring-pink/30 rounded-full blur-[1px] petal-drift petal-drift-1"></div>
        <div className="absolute top-20 right-[15%] w-3 h-3 bg-spring-lavender/30 rounded-full blur-[1px] petal-drift petal-drift-2"></div>
        <div className="absolute top-40 left-[30%] w-5 h-4 bg-spring-pink/40 rounded-full blur-[2px] petal-drift petal-drift-3"></div>
        <div className="absolute top-60 right-[25%] w-3 h-4 bg-spring-mint/30 rounded-full blur-[1px] petal-drift petal-drift-4"></div>
        <div className="absolute top-80 left-[75%] w-4 h-3 bg-spring-yellow/40 rounded-full blur-[1px] petal-drift petal-drift-5"></div>
      </div>

      <div className="w-full max-w-2xl relative z-10">
        {/* Back Button */}
        <div className="mb-6">
          <SpringButton 
            variant="secondary" 
            size="sm"
            onClick={() => router.push("/study/batches")}
          >
            <div className="flex items-center gap-2">
              <ArrowLeft size={16} />
              <span>Back to Batches</span>
            </div>
          </SpringButton>
        </div>

        {/* Main Card */}
        <SpringCard hover={false} className="w-full border border-spring-leaf/20 bg-white/95 dark:bg-spring-forest-surface/90 shadow-2xl p-6 sm:p-8">
          {/* Batch Info */}
          <div className="text-center mb-8">
            {batchImage && (
              <div className="relative mb-6">
                <img
                  src={batchImage}
                  alt={batchName}
                  className="w-full h-48 sm:h-64 object-cover rounded-xl shadow-lg border border-spring-leaf/20 mx-auto max-w-md"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-spring-forest/40 to-transparent rounded-xl"></div>
              </div>
            )}
            
            <h1 className="text-2xl sm:text-3xl font-bold text-spring-forest dark:text-spring-forest-dark mb-3">
              {batchName || <span className="text-spring-pink-accent font-semibold">(Batch name not available)</span>}
            </h1>
            
            <div className="flex justify-center mb-4">
              <SpringBadge variant="success">
                <div className="flex items-center gap-1">
                  <Shield size={14} />
                  <span>Verification Required</span>
                </div>
              </SpringBadge>
            </div>

            <p className="text-spring-forest/80 dark:text-spring-forest-dark/80 text-sm max-w-md mx-auto">
              Complete the verification process to access your selected batch content
            </p>
          </div>

          {/* Warning Alert */}
          <div className="mb-8 p-4 bg-spring-yellow/10 dark:bg-spring-forest-surface/40 border border-spring-yellow-accent/30 rounded-xl">
            <div className="flex items-start gap-3">
              <TriangleAlert className="w-5 h-5 text-spring-yellow-accent mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-spring-leaf dark:text-spring-mint mb-2">Important Notice</h3>
                <div className="text-sm text-spring-forest/90 dark:text-spring-forest-dark/95 space-y-1 font-medium">
                  <p>• You must verify your identity before accessing this batch</p>
                  <p>• For other batches, please go back and verify for your required batch</p>
                  <p>• Verification is a one-time process per batch</p>
                </div>
              </div>
            </div>
          </div>

          {/* Verification Methods */}
          {shortnerServers.length > 0 ? (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-spring-forest dark:text-spring-forest-dark mb-2">Choose Verification Method</h3>
                <p className="text-spring-forest/80 dark:text-spring-forest-dark/80 text-sm">
                  Select one of the available verification methods below to proceed
                </p>
                <div className="flex justify-center mt-2">
                  <button
                    className="inline-flex items-center gap-1.5 text-spring-leaf dark:text-spring-mint text-xs font-semibold hover:underline focus:outline-none focus:underline transition-all"
                    onClick={() => router.push("/key-generate/guide")}
                    type="button"
                  >
                    <InfoIcon size={14} className="text-spring-leaf dark:text-spring-mint" />
                    <span>How to open verification link?</span>
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {shortnerServers.map((server, idx) => {
                  // Use shortened URL if available, otherwise fall back to raw verify URL
                  const verifyLink = server.shortenedUrl || rawVerifyUrl;
                  const isAvailable = !!verifyLink;
                  return (
                    <button
                      key={server._id || server.name || idx}
                      className={`w-full group relative p-4 rounded-xl transition-all duration-300 hover:scale-[1.01] focus:outline-none focus:ring-2 focus:ring-spring-leaf focus:ring-offset-2 focus:ring-offset-spring-cream ${
                        isAvailable 
                          ? 'bg-gradient-to-r from-spring-mint to-spring-leaf dark:from-spring-mint-dark dark:to-spring-leaf-dark text-white shadow-[0_4px_15px_rgba(76,175,106,0.25)] hover:shadow-[0_8px_28px_rgba(76,175,106,0.35)]' 
                          : 'bg-spring-sand/50 dark:bg-spring-forest-surface/20 border border-spring-leaf/10 opacity-50 cursor-not-allowed text-spring-forest/60 dark:text-spring-forest-dark/40'
                      }`}
                      onClick={() => {
                        if (verifyLink) {
                          window.location.href = verifyLink;
                        }
                      }}
                      disabled={!isAvailable}
                      title={isAvailable ? `Verify via ${server.name}` : 'Verification method not available'}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                          isAvailable 
                            ? 'bg-white/20 text-white' 
                            : 'bg-spring-sand text-spring-forest/40'
                        }`}>
                          {isAvailable ? (
                            <ExternalLink size={18} />
                          ) : (
                            <InfoIcon size={18} />
                          )}
                        </div>
                        
                        <div className="flex-1 text-left">
                          <h4 className="font-bold text-sm">
                            {server.name}
                          </h4>
                          <p className={`text-xs mt-1 ${isAvailable ? 'text-white/80' : 'text-spring-forest/50'}`}>
                            {server.shortenedUrl ? 'Click to verify' : isAvailable ? 'Direct verification link' : 'Currently unavailable'}
                          </p>
                        </div>

                        {isAvailable && (
                          <div className="flex-shrink-0">
                            <CheckCircle className="w-5 h-5 text-spring-yellow" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="flex justify-center mb-4">
                <button
                  className="inline-flex items-center gap-1.5 text-spring-leaf dark:text-spring-mint text-xs font-semibold hover:underline focus:outline-none focus:underline transition-all"
                  onClick={() => router.push("/key-generate/guide")}
                  type="button"
                >
                  <InfoIcon size={14} className="text-spring-leaf dark:text-spring-mint" />
                  <span>How to open verification link?</span>
                </button>
              </div>
              <div className="w-16 h-16 mx-auto mb-4 bg-spring-sand rounded-full flex items-center justify-center">
                <InfoIcon className="w-8 h-8 text-spring-leaf/75" />
              </div>
              <h3 className="text-lg font-bold text-spring-forest dark:text-spring-forest-dark mb-2">No Verification Methods Available</h3>
              <p className="text-spring-forest/70 dark:text-spring-forest-dark/70 text-sm">
                Currently no verification methods are found. Please try again later or contact support.
              </p>
            </div>
          )}
        </SpringCard>
      </div>
    </div>
  );
} 