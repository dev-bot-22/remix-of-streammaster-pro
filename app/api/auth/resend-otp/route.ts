import { NextRequest, NextResponse } from "next/server";
import { sendOtpViaWorker } from "@/lib/pwAuth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { phoneNumber } = body || {};
    const smsType =
      request.nextUrl.searchParams.get("smsType") ??
      request.nextUrl.searchParams.get("smstype") ??
      body?.smsType ??
      0;

    if (!phoneNumber) {
      return NextResponse.json(
        { success: false, message: "Missing phone number" },
        { status: 400 }
      );
    }

    const result = await sendOtpViaWorker(phoneNumber, smsType);

    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status === 200 ? 400 : result.status }
      );
    }

    return NextResponse.json({ success: true, message: result.message }, { status: 200 });
  } catch (err) {
    console.error("Resend OTP error:", err);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
