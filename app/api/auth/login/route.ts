import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { getPublicServerConfig } from "@/lib/publicServerConfig";
import { sendOtpViaWorker } from "@/lib/pwAuth";
import { rateLimit } from "@/utils/rateLimiter";

const TELEGRAM_BOT_TOKEN = process.env.BOT_TOKEN!;
const TELEGRAM_CHANNEL_ID = process.env.LOG_CHANNEL_ID!;

async function sendTelegramLog(message: string) {
  try {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHANNEL_ID) {
      console.warn("Telegram bot token or channel ID not configured");
      return;
    }
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHANNEL_ID,
        text: message,
        parse_mode: "Markdown",
      }),
    });
  } catch (err: any) {
    console.error("Failed to send Telegram log:", err);
  }
}

function normalizePhoneNumber(phone: string): string {
  phone = phone.trim().replace(/[^\d+]/g, ""); // keep digits and plus only
  if (!phone.startsWith("+")) {
    return "+91" + phone;
  }
  return phone;
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
    if (!rateLimit(ip, 3, 10 * 60 * 1000)) {
      return NextResponse.json(
        { success: false, message: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { phoneNumber } = body;
    // Donate flow logs in someone else's PW account, so the number will not
    // exist in our own users table — skip the "registered user" check there.
    const isDonateFlow =
      String(body?.mode || body?.purpose || request.nextUrl.searchParams.get("mode") || "")
        .toLowerCase() === "donate";
    const smsType =
      request.nextUrl.searchParams.get("smsType") ??
      request.nextUrl.searchParams.get("smstype") ??
      body?.smsType ??
      0;

    if (!phoneNumber) {
      return NextResponse.json(
        { success: false, message: "Phone number is required" },
        { status: 400 }
      );
    }

    let normalizedPhone: string;

    try {
      normalizedPhone = normalizePhoneNumber(phoneNumber);
    } catch (error) {
      return NextResponse.json(
        { success: false, message: "Invalid phone number format" },
        { status: 400 }
      );
    }

    await dbConnect();
    const config = await getPublicServerConfig();

    // ✅ If direct login is NOT enabled, validate user existence
    if (!config.isDirectLoginOpen && !isDonateFlow) {
      const user = await User.findOne({ phoneNumber: normalizedPhone });
      if (!user) {
        return NextResponse.json(
          { success: false, message: "User not found!" },
          { status: 401 }
        );
      }
    }

    // Send OTP through the PW auth worker (smsType 0 = SMS, 1 = WhatsApp, 2 = Call)
    const result = await sendOtpViaWorker(phoneNumber, smsType);

    if (!result.ok) {
      const msg = String(result.message || "");
      if (/does not exist/i.test(msg)) {
        return NextResponse.json(
          { success: false, message: "This number is not registered on the real PW app." },
          { status: 404 }
        );
      }

      await sendTelegramLog(
        `🚨 *OTP send failed*\n*Status:* ${result.status}\n*Response:* \`\`\`json\n${JSON.stringify(
          result.data,
          null,
          2
        ).substring(0, 3000)}\n\`\`\``
      );

      return NextResponse.json(
        { success: false, message: msg || "Failed to send OTP" },
        { status: result.status === 200 ? 400 : result.status || 500 }
      );
    }

    return NextResponse.json(
      { success: true, message: "OTP sent successfully" },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Login error:", err);
    return NextResponse.json(
      { success: false, message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
