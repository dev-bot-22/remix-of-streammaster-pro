"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import "../globals.css";
import { SpringPetals } from "@/app/components/SpringPetals";
import { LucideTriangleAlert } from "lucide-react";
import { toast } from "sonner";

const appName = process.env.NEXT_PUBLIC_APP_NAME;

export default function Login() {
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(15);
  const [canResend, setCanResend] = useState(false);
  const [serverInfo, setServerInfo] = useState<any>(null);
  const [verified, setVerified] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams?.get("redirect_to") || "/study";

  // Get server info from global window object
  useEffect(() => {
    const globalServerInfo = (window as any).__SERVER_INFO__;
    if (globalServerInfo) {
      setServerInfo(globalServerInfo);
    } else {
      async function fetchServerInfo() {
        try {
          const res = await fetch("/api/auth/serverInfo");
          if (!res.ok) throw new Error("Failed to fetch server info");
          const data = await res.json();
          setServerInfo(data);
        } catch (err) {
          setError("Could not load server info");
        }
      }
      fetchServerInfo();
    }
  }, []);
  const isDirectLogin: boolean = serverInfo?.isDirectLoginOpen ?? false;
  const botUsername = serverInfo?.tg_bot;

  const startResendCountdown = () => {
    setResendTimer(15);
    setCanResend(false);

    let timer = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    if (step === "otp") {
      startResendCountdown();
    }
  }, [step]);

  const resendOtp = async (smsType: number) => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/auth/resend-otp?smsType=${smsType}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: phone }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "Failed to resend OTP");
        toast.error(data.message || "Failed to resend OTP");
        return;
      }

      startResendCountdown();
    } catch (err) {
      console.error(err);
      setError("An error occurred while resending OTP.");
      toast.error("An error occurred while resending OTP.");
    } finally {
      setLoading(false);
    }
  };

  const requestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !/^[6-9][0-9]{9}$/.test(phone)) {
      setError("Please enter a valid 10-digit mobile number.");
      toast.error("Please enter a valid 10-digit mobile number.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phoneNumber: phone }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "OTP request failed");
        toast.error(data.message || "OTP request failed");
        return;
      }
      if (data.success) {
        toast.success(data.message || "Otp Sent!");
      }
      setStep("otp");
    } catch (err: any) {
      console.error(err);
      setError("An error occurred while sending OTP.");
      toast.error("An error occurred while sending OTP.");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length < 4) {
      setError("Please enter the OTP.");
      toast.error("Please enter the OTP.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phoneNumber: phone, otp }),
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "OTP verification failed");
        toast.error(data.message || "OTP verification failed");
        return;
      }
      if (data.success) {
        toast.success(data.message || "Otp Verified!");
      }
      if (data.user) {
        localStorage.setItem("USER_DATA", JSON.stringify(data.user));
      }
      setVerified(true);
      setTimeout(() => {
        router.replace(redirectTo);
      }, 800);
    } catch (err: any) {
      setError("An error occurred during OTP verification.");
      toast.error("An error occurred during OTP verification.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
      {/* Spring Gradient Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-[#eef7f0] via-[#e4f6e8] to-[#f5f8ff]" />
        {/* Soft sunlight glow */}
        <div className="absolute top-0 left-0 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-[rgba(255,255,200,0.35)] to-transparent blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full bg-gradient-to-tl from-[rgba(200,255,220,0.3)] to-transparent blur-[100px] pointer-events-none" />
      </div>

      <SpringPetals />

      <form
        onSubmit={step === "phone" ? requestOtp : verifyOtp}
        className="w-full max-w-sm p-6 md:p-8 space-y-6 z-10 animate-scaleIn rounded-[22px] backdrop-blur-[18px] bg-[rgba(255,255,255,0.75)] shadow-[0_20px_40px_rgba(0,0,0,0.12)] border border-[rgba(76,175,106,0.15)]"
      >
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[#1E2A22]">
            {step === "phone" ? "Sign In" : "Verify OTP"}
          </h1>
          <p className="text-sm text-[#1E2A22] opacity-70 mt-2">
            {step === "phone"
              ? "Enter your mobile number to continue"
              : `OTP sent to +91-${phone}`}
          </p>
        </div>

        <div className="space-y-4">
          {step === "phone" ? (
            <>
              <div className="flex items-center rounded-[14px] bg-[rgba(255,255,255,0.8)] backdrop-blur-[8px] border border-[rgba(76,175,106,0.15)] overflow-hidden focus-within:border-[rgba(76,175,106,0.5)] focus-within:shadow-[0_0_20px_rgba(76,175,106,0.15)]">
                <span className="px-4 py-3 text-[#1E2A22] font-medium border-r border-[rgba(76,175,106,0.15)]">+91</span>
                <input
                  type="tel"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    setPhone(val);
                    if (error) setError("");
                  }}
                  className="flex-1 px-4 py-3 bg-transparent text-[#1E2A22] placeholder-[rgba(30,42,34,0.4)] outline-none"
                  placeholder="Mobile Number"
                />
              </div>
              <label className="flex items-center text-sm text-[#1E2A22] opacity-70 space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  className="w-4 h-4 text-[#4CAF6A] bg-transparent border-[#4CAF6A] rounded accent-[#4CAF6A]"
                />
                <span>I'm not a robot</span>
              </label>
            </>
          ) : (
            <>
              <div className="flex items-center rounded-[14px] bg-[rgba(255,255,255,0.8)] backdrop-blur-[8px] border border-[rgba(76,175,106,0.15)] overflow-hidden focus-within:border-[rgba(76,175,106,0.5)] focus-within:shadow-[0_0_20px_rgba(76,175,106,0.15)]">
                <input
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    setOtp(val);
                    if (error) setError("");
                  }}
                  className="flex-1 px-4 py-3 bg-transparent text-[#1E2A22] placeholder-[rgba(30,42,34,0.4)] outline-none text-center tracking-[0.5em] text-lg font-mono"
                  placeholder="Enter OTP"
                />
              </div>
              {canResend ? (
                <div className="flex flex-wrap items-center space-y-2 text-sm text-[#1E2A22] opacity-70">
                  <p className="text-[#1E2A22] opacity-70">Didn't get the OTP?</p>
                  <div className="flex flex-col text-center gap-2 item-center w-full justify-center">
                    <button
                      type="button"
                      onClick={() => resendOtp(0)}
                      className="text-[#4CAF6A] px-3 py-1.5 rounded-xl hover:bg-[rgba(76,175,106,0.1)] transition-all duration-200"
                    >
                      Resend via SMS
                    </button>
                    <button
                      type="button"
                      onClick={() => resendOtp(1)}
                      className="text-[#4CAF6A] px-3 py-1.5 rounded-xl hover:bg-[rgba(76,175,106,0.1)] transition-all duration-200"
                    >
                      Send on WhatsApp
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[#1E2A22] opacity-50 text-center">
                  You can resend OTP in <span className="text-[#4CAF6A] font-semibold">{resendTimer}s</span>
                </p>
              )}
            </>
          )}

          {error && (
            <p className="text-sm text-red-500 -mt-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              {error}
            </p>
          )}

          <button
            disabled={loading || verified}
            type="submit"
            className="w-full btn-garden btn-primary-garden py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {loading
              ? "Please wait..."
              : verified
                ? "✓ Verified"
                : step === "phone"
                  ? "Send OTP"
                  : "Verify OTP"}
          </button>
        </div>

        <p className="text-xs text-center text-[#1E2A22] opacity-60">
          Made with ❤️ by{" "}
          <span className="font-semibold text-[#4CAF6A]">
            {appName}
          </span>
        </p>

        {/* Bot Authorization Info */}
        {!isDirectLogin && (
          <div className="rounded-[18px] p-4 bg-[rgba(76,175,106,0.08)] backdrop-blur-[10px] border border-[rgba(76,175,106,0.15)]">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <svg
                  className="w-5 h-5 text-[#4CAF6A] mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-[#4CAF6A] mb-2 inline-flex items-center">
                  <LucideTriangleAlert
                    size={17}
                    className="mr-2"
                    color="#FFD84D"
                  />{" "}
                  Authorization Required
                </h3>
                <p className="text-xs text-[#1E2A22] opacity-70 leading-relaxed mb-3">
                  Before logging in, you need to authorize yourself with our bot
                  first.
                </p>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-[#1E2A22] opacity-70">Bot Username:</span>
                  <a
                    href={`https://telegram.me/${botUsername?.replace(
                      "@",
                      ""
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[#4CAF6A] bg-[rgba(76,175,106,0.1)] px-3 py-1 rounded-lg text-xs hover:bg-[rgba(76,175,106,0.15)] transition-all duration-200 border border-[rgba(76,175,106,0.2)]"
                  >
                    {botUsername}
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
