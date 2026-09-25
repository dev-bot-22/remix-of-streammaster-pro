import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import Batch from "@/models/Batch";
import { v4 as uuidv4 } from "uuid";
import { verifyOtpViaWorker } from "@/lib/pwAuth";

const TELEGRAM_BOT_TOKEN = process.env.BOT_TOKEN!;
const TELEGRAM_CHANNEL_ID = process.env.LOG_CHANNEL_ID!;
const BASE_URL = process.env.PW_API;

async function sendTelegramLog(message: string) {
  try {
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
  phone = phone.trim().replace(/[^\d+]/g, "");
  return phone.startsWith("+") ? phone : "+91" + phone;
}

function resolveBatchImage(batch: any, batchDetails: any): string {
  if (batchDetails?.iosPreviewImageUrl) {
    return batchDetails.iosPreviewImageUrl;
  }

  if (batch?.previewImage?.baseUrl && batch?.previewImage?.key) {
    return batch.previewImage.baseUrl + batch.previewImage.key;
  }

  if (batchDetails?.previewImage?.baseUrl && batchDetails?.previewImage?.key) {
    return batchDetails.previewImage.baseUrl + batchDetails.previewImage.key;
  }

  return "";
}

async function fetchPurchasedBatches(accessToken: string) {
  const randomId = uuidv4();
  const response = await fetch(
    `${BASE_URL}/batch-service/v1/batches/purchased-batches?page=1&type=ALL&amount=paid`,
    {
      method: "GET",
      headers: {
        accept: "application/json, text/plain, */*",
        authorization: `Bearer ${accessToken}`,
        "client-id": "5eb393ee95fab7468a79d189",
        "client-type": "WEB",
        "client-version": "1.1.1",
        randomid: randomId,
      },
    }
  );
  const data = await response.json();
  if (!data.success || !Array.isArray(data.data)) return [];
  return data.data.map((item: any) => item.batch || item);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phoneNumber, otp } = body;

    if (!phoneNumber || !otp) {
      return NextResponse.json(
        { success: false, message: "Phone number and OTP are required" },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    await dbConnect();

    const randomId = uuidv4();
    const verified = await verifyOtpViaWorker(phoneNumber, otp);

    if (!verified.ok || !verified.tokenData) {
      return NextResponse.json(
        { success: false, message: verified.message || "OTP verification failed!" },
        { status: 401 }
      );
    }

    const data = { data: verified.tokenData };

    let user = await User.findOne({ phoneNumber: normalizedPhone });
    if (!user) {
      const last4Digits = normalizedPhone.slice(-4);
      user = await User.create({
        UserName:
          data.data.user?.firstName + " " + data.data.user?.lastName ||
          `Donor_${last4Digits}`,
        phoneNumber: normalizedPhone,
        telegramId: null,
        photoUrl:
          data.data.user?.imageId?.baseUrl && data.data.user?.imageId?.key
            ? data.data.user?.imageId.baseUrl + data.data.user?.imageId.key
            : "https://cdn-icons-png.flaticon.com/512/3607/3607444.png",
        tag: "user",
        tagExpiry: null,
        hasLoggedIn: false,
        enrolledBatches: [],
      });
    }

    const realAccessToken = data.data.access_token;
    const realRefreshToken = data.data.refresh_token;

    user.ActualToken = realAccessToken;
    user.ActualRefresh = realRefreshToken;
    user.randomId = randomId;

    // Batch Sync Logic
    const { getBatchInfo } = await import("@/lib/batch");

    const purchasedBatches = await fetchPurchasedBatches(realAccessToken);
    let syncedCount = 0;
    
    for (const batch of purchasedBatches) {
      const batchDetails = await getBatchInfo(batch._id, "details");
      const batchDoc = {
        batchId: batch._id,
        batchName: batchDetails?.name || batch.name || "Unknown Batch",
        batchPrice: batchDetails?.fee?.total || 0,
        batchImage: resolveBatchImage(batch, batchDetails),
        template: batchDetails?.template || "NORMAL",
        BatchType: "FREE",
        language: batchDetails?.language || "English",
        byName: batchDetails?.byName || "Unknown",
        startDate: batchDetails?.startDate || "",
        endDate: batchDetails?.endDate || "",
        batchStatus: !(batchDetails?.isBlocked || batch.isBlocked) || true,
      };

      const enrolledToken = {
        ownerId: user._id,
        accessToken: realAccessToken,
        refreshToken: realRefreshToken,
        tokenStatus: true,
        randomId,
        updatedAt: new Date(),
      };

      const existingBatch = await Batch.findOne({ batchId: batch._id });
      if (!existingBatch) {
        await Batch.create({ ...batchDoc, enrolledTokens: [enrolledToken] });
      } else {
        const tokenIdx = existingBatch.enrolledTokens.findIndex(
          (t: { ownerId: { toString: () => any } }) =>
            t.ownerId.toString() === user._id.toString()
        );
        if (tokenIdx !== -1) {
          existingBatch.enrolledTokens[tokenIdx] = enrolledToken;
        } else {
          existingBatch.enrolledTokens.push(enrolledToken);
        }
        Object.assign(existingBatch, batchDoc);
        await existingBatch.save();
      }
      syncedCount++;
    }

    // Refresh existing tokens for this donor across all batches they are enrolled in
    const updateResult = await Batch.updateMany(
      { "enrolledTokens.ownerId": user._id },
      {
        $set: {
          "enrolledTokens.$[elem].accessToken": realAccessToken,
          "enrolledTokens.$[elem].refreshToken": realRefreshToken,
          "enrolledTokens.$[elem].updatedAt": new Date(),
          "enrolledTokens.$[elem].randomId": randomId,
          "enrolledTokens.$[elem].tokenStatus": true,
        },
      },
      {
        arrayFilters: [{ "elem.ownerId": user._id }],
      }
    );

    await user.save();

    const now = new Date().toLocaleString("en-GB", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });

    await sendTelegramLog(`
💝 *Batch Donated by ${user.UserName || "Donor"}*

🗓 *Time:* ${now}
📱 *Phone:* ${normalizedPhone}
🧠 *Donor ID:* \`${user._id}\`
📚 *Batches Found:* ${syncedCount}
🔁 *Batches Refreshed:* ${updateResult.modifiedCount}
    `);

    return NextResponse.json({
      success: true,
      message: "Batch successfully donated! Thank you ❤️",
    });
  } catch (err: any) {
    console.error("OTP Donation Sync Error:", err);
    return NextResponse.json(
      { success: false, message: "Server error", err: err?.message || err },
      { status: 500 }
    );
  }
}
