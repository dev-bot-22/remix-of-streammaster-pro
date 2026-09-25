"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Heart, ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { SpringPetals } from "@/app/components/SpringPetals";
import "../../globals.css";

const appName = process.env.NEXT_PUBLIC_APP_NAME || "PW-MARCO";

function DonateContent() {
  const router = useRouter();

  const [batchId, setBatchId] = useState("");
  const [step, setStep] = useState<"phone" | "otp" | "success">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(15);
  const [canResend, setCanResend] = useState(false);
  const [currentUserPhone, setCurrentUserPhone] = useState("");

  // Retrieve batchId from sessionStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedId = sessionStorage.getItem("donate_batch_id");
      if (savedId) {
        setBatchId(savedId);
      }
    }
  }, []);

  // Fetch logged in user's phone on mount
  useEffect(() => {
    async function fetchCurrentUser() {
      try {
        const res = await fetch("/api/AboutMe");
        const data = await res.json();
        if (res.ok && data?.user?.phoneNumber) {
          setCurrentUserPhone(data.user.phoneNumber);
        }
      } catch (err) {
        console.error("Failed to fetch current user details:", err);
      }
    }
    fetchCurrentUser();
  }, []);

  const startResendCountdown = () => {
    setResendTimer(15);
    setCanResend(false);

    const timer = setInterval(() => {
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

  const requestOtp = async (e: React.FormEvent, smsType: number = 0) => {
    e.preventDefault();
    if (!phone || !/^[6-9][0-9]{9}$/.test(phone)) {
      setError("Please enter a valid 10-digit mobile number.");
      toast.error("Please enter a valid 10-digit mobile number.");
      return;
    }

    const normalizedInput = phone.startsWith("+") ? phone : "+91" + phone;
    if (currentUserPhone && normalizedInput === currentUserPhone) {
      setError("Ask your friend who has the batch, do not login with your own number.");
      toast.error("Ask your friend who has the batch, do not login with your own number.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await fetch(`/api/auth/login?smsType=${smsType}&mode=donate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: phone, smsType, mode: "donate" }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "Failed to send OTP.");
        toast.error(data.message || "Failed to send OTP.");
        return;
      }
      toast.success("OTP Sent Successfully!");
      setStep("otp");
    } catch (err) {
      console.error(err);
      setError("Something went wrong while sending OTP.");
      toast.error("Something went wrong while sending OTP.");
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async (smsType: number) => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/auth/resend-otp?smsType=${smsType}&mode=donate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: phone, smsType, mode: "donate" }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "Failed to resend OTP");
        toast.error(data.message || "Failed to resend OTP");
        return;
      }

      startResendCountdown();
      toast.success("OTP Resent Successfully!");
    } catch (err) {
      console.error(err);
      setError("An error occurred while resending OTP.");
      toast.error("An error occurred while resending OTP.");
    } finally {
      setLoading(false);
    }
  };

  const verifyAndDonate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length < 4) {
      setError("Please enter the OTP.");
      toast.error("Please enter the OTP.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/donate-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: phone, otp }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "Verification failed");
        toast.error(data.message || "Verification failed");
        return;
      }

      toast.success("Donation Successful! Thank you ❤️");
      setStep("success");
    } catch (err) {
      console.error(err);
      setError("An error occurred while verifying details.");
      toast.error("An error occurred while verifying details.");
    } finally {
      setLoading(false);
    }
  };

  if (step === "success") {
    return (
      <div className="w-full max-w-md p-8 text-center animate-scaleIn rounded-[24px] backdrop-blur-[18px] bg-white/80 dark:bg-[#1c2b22]/80 shadow-lg border border-emerald-500/20 dark:border-emerald-500/10">
        <div className="flex justify-center mb-6">
          <div className="relative">
            <Heart className="w-20 h-20 text-red-500 fill-red-500 animate-float" />
            <Sparkles className="absolute -top-2 -right-2 text-yellow-400 w-8 h-8 animate-pulse" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-[#1E2A22] dark:text-[#E8F5E9]">
          Donation Successful!
        </h2>
        <p className="text-sm text-[#1E2A22]/70 dark:text-[#E8F5E9]/70 mt-3 leading-relaxed">
          Thank you so much! The batch has been added to our database and is now available for all students to study.
        </p>

        <button
          onClick={() => {
            if (batchId) {
              if (typeof window !== "undefined") {
                sessionStorage.removeItem("donate_batch_id");
              }
              router.replace(`/study/batches/${batchId}`);
            } else {
              router.replace("/study");
            }
          }}
          className="w-full mt-8 spring-btn-primary flex items-center justify-center font-semibold"
        >
          Go Back to Study
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm p-6 md:p-8 space-y-6 z-10 animate-scaleIn rounded-[22px] backdrop-blur-[18px] bg-white/85 dark:bg-[#1c2b22]/85 shadow-[0_20px_40px_rgba(0,0,0,0.1)] border border-[rgba(76,175,106,0.15)]">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
      >
        <ArrowLeft size={14} />
        Back
      </button>

      <div className="text-center">
        <div className="flex justify-center mb-3">
          <Heart className="w-12 h-12 text-red-500 fill-red-500 animate-pulse drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]" />
        </div>
        <h1 className="text-2xl font-bold text-[#1E2A22] dark:text-[#E8F5E9]">
          {step === "phone" ? "Donate Batch" : "Verify Donor"}
        </h1>
        <p className="text-sm font-medium text-[#1E2A22]/70 dark:text-[#E8F5E9]/70 mt-3 leading-relaxed">
          {step === "phone"
            ? "Your one login can help many students."
            : `We've sent a one-time passcode to +91-${phone}`}
        </p>
      </div>

      <form onSubmit={step === "phone" ? requestOtp : verifyAndDonate} className="space-y-4">
        {step === "phone" ? (
          <div className="flex items-center rounded-[14px] bg-white/90 dark:bg-black/20 backdrop-blur-[8px] border border-[rgba(76,175,106,0.15)] overflow-hidden focus-within:border-[rgba(76,175,106,0.5)] focus-within:shadow-[0_0_20px_rgba(76,175,106,0.15)]">
            <span className="px-4 py-3 text-[#1E2A22] dark:text-[#E8F5E9] font-medium border-r border-[rgba(76,175,106,0.15)]">
              +91
            </span>
            <input
              type="tel"
              maxLength={10}
              value={phone}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "");
                setPhone(val);
                if (error) setError("");
              }}
              className="flex-1 px-4 py-3 bg-transparent text-[#1E2A22] dark:text-[#E8F5E9] placeholder-[rgba(30,42,34,0.4)] dark:placeholder-gray-500 outline-none"
              placeholder="Mobile Number"
              disabled={loading}
            />
          </div>
        ) : (
          <>
            <div className="flex items-center rounded-[14px] bg-white/90 dark:bg-black/20 backdrop-blur-[8px] border border-[rgba(76,175,106,0.15)] overflow-hidden focus-within:border-[rgba(76,175,106,0.5)] focus-within:shadow-[0_0_20px_rgba(76,175,106,0.15)]">
              <input
                type="text"
                maxLength={6}
                value={otp}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  setOtp(val);
                  if (error) setError("");
                }}
                className="flex-1 px-4 py-3 bg-transparent text-[#1E2A22] dark:text-[#E8F5E9] placeholder-[rgba(30,42,34,0.4)] dark:placeholder-gray-500 outline-none text-center tracking-[0.5em] text-lg font-mono"
                placeholder="Enter OTP"
                disabled={loading}
              />
            </div>

            {canResend ? (
              <div className="flex flex-col gap-2 pt-2">
                <p className="text-xs text-[#1E2A22]/70 dark:text-[#E8F5E9]/70 text-center">Didn't receive the OTP?</p>
                <div className="flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => resendOtp(0)}
                    className="text-xs font-semibold text-[var(--spring-leaf)] hover:underline"
                  >
                    Resend SMS
                  </button>
                  <span className="text-gray-400">·</span>
                  <button
                    type="button"
                    onClick={() => resendOtp(1)}
                    className="text-xs font-semibold text-[var(--spring-leaf)] hover:underline"
                  >
                    Send WhatsApp
                  </button>
                  <span className="text-gray-400">·</span>
                  <button
                    type="button"
                    onClick={() => resendOtp(2)}
                    className="text-xs font-semibold text-[var(--spring-leaf)] hover:underline"
                  >
                    OTP by Call
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#1E2A22]/50 dark:text-[#E8F5E9]/50 text-center">
                You can resend in <span className="text-[var(--spring-leaf)] font-semibold">{resendTimer}s</span>
              </p>
            )}
          </>
        )}

        {error && (
          <p className="text-xs text-red-500 mt-1 text-center font-medium leading-relaxed">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full spring-btn-primary flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed font-semibold"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading
            ? "Please wait..."
            : step === "phone"
              ? "Get OTP on SMS"
              : "Verify & Donate ❤️"}
        </button>

        {step === "phone" && (
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={loading}
              onClick={(e) => requestOtp(e, 1)}
              className="w-full py-3 rounded-[14px] text-sm font-semibold border border-[rgba(76,175,106,0.3)] text-[#1E2A22] dark:text-[#E8F5E9] hover:bg-[rgba(76,175,106,0.08)] disabled:opacity-60 transition-colors"
            >
              OTP on WhatsApp
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={(e) => requestOtp(e, 2)}
              className="w-full py-3 rounded-[14px] text-sm font-semibold border border-[rgba(76,175,106,0.3)] text-[#1E2A22] dark:text-[#E8F5E9] hover:bg-[rgba(76,175,106,0.08)] disabled:opacity-60 transition-colors"
            >
              OTP by Call
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

export default function DonatePage() {
  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
      {/* Spring Gradient Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-[#eef7f0] via-[#e4f6e8] to-[#f5f8ff] dark:from-[#0F1908] dark:via-[#1C2B22] dark:to-[#151D1A]" />
        {/* Soft sunlight glow */}
        <div className="absolute top-0 left-0 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-[rgba(255,255,200,0.25)] to-transparent blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full bg-gradient-to-tl from-[rgba(200,255,220,0.2)] to-transparent blur-[100px] pointer-events-none" />
      </div>

      <SpringPetals />

      <Suspense fallback={<div className="text-center text-gray-500">Loading donation panel...</div>}>
        <DonateContent />
      </Suspense>
    </div>
  );
}
