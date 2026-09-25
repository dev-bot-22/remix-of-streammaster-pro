// lib/pwAuth.ts — OTP send/verify through the PW auth worker.
// Endpoints:
//   GET /api/send-otp?num=91XXXXXXXXXX&smstype=0|1|2   (0 = SMS, 1 = WhatsApp, 2 = Call)
//   GET /api/verify?num=91XXXXXXXXXX&otp=XXXX

export const PW_AUTH_BASE = (
  process.env.PW_AUTH_API || "https://p-auth.raghutiwari554-34f.workers.dev"
).replace(/\/$/, "");

export type SmsType = 0 | 1 | 2;

/** Worker expects the number as 91XXXXXXXXXX (no plus, with country code). */
export function toWorkerNumber(phone: string): string {
  let digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10) digits = "91" + digits;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return digits;
}

export function normalizeSmsType(value: unknown): SmsType {
  const n = Number(value);
  return n === 1 || n === 2 ? (n as SmsType) : 0;
}

export async function sendOtpViaWorker(phone: string, smsType: unknown) {
  const num = toWorkerNumber(phone);
  const type = normalizeSmsType(smsType);
  const res = await fetch(
    `${PW_AUTH_BASE}/api/send-otp?num=${encodeURIComponent(num)}&smstype=${type}`,
    { headers: { accept: "application/json" }, cache: "no-store" }
  );

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  return {
    ok: Boolean(res.ok && data?.success),
    status: res.status,
    message: data?.message || data?.raw?.message || "Failed to send OTP",
    data,
  };
}

export async function verifyOtpViaWorker(phone: string, otp: string) {
  const num = toWorkerNumber(phone);
  const res = await fetch(
    `${PW_AUTH_BASE}/api/verify?num=${encodeURIComponent(num)}&otp=${encodeURIComponent(otp)}`,
    { headers: { accept: "application/json" }, cache: "no-store" }
  );

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  // The worker wraps PW's response; tokens can live in a few shapes.
  const tokenData =
    data?.data?.access_token ? data.data
      : data?.raw?.data?.access_token ? data.raw.data
      : data?.raw?.access_token ? data.raw
      : data?.access_token ? data
      : null;

  return {
    ok: Boolean(res.ok && data?.success && tokenData?.access_token),
    status: res.status,
    message: data?.message || data?.raw?.message || "OTP verification failed!",
    tokenData,
    data,
  };
}
