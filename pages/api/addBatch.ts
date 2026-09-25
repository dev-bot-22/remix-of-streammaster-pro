import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/mongodb";
import Batch from "@/models/Batch";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    await dbConnect();

    const {
      batchId,
      batchName,
      batchPrice,
      batchImage,
      template = "NORMAL",
      language,
      byName,
      startDate,
      endDate,
      batchStatus = true,
      enrolledTokens = [],
    } = req.body;

    if (!batchId || !batchName) {
      return res.status(400).json({ message: "Batch ID and Name are required." });
    }

    const existingBatch = await Batch.findOne({ batchId });

    if (existingBatch) {
      // Merge enrolled tokens
      for (const token of enrolledTokens) {
        if (!token.ownerId || !token.accessToken || !token.refreshToken) continue;
        const idx = existingBatch.enrolledTokens.findIndex(
          (t: any) => t.ownerId.toString() === token.ownerId.toString()
        );
        if (idx > -1) {
          existingBatch.enrolledTokens[idx] = {
            ...existingBatch.enrolledTokens[idx],
            accessToken: token.accessToken,
            refreshToken: token.refreshToken,
            tokenStatus: true,
            updatedAt: new Date(),
          };
        } else {
          existingBatch.enrolledTokens.push({
            ownerId: token.ownerId,
            accessToken: token.accessToken,
            refreshToken: token.refreshToken,
            tokenStatus: true,
            updatedAt: new Date(),
          });
        }
      }

      existingBatch.batchName = batchName;
      existingBatch.batchPrice = Number(batchPrice) || 0;
      existingBatch.batchImage = batchImage;
      existingBatch.template = template;
      existingBatch.language = language;
      existingBatch.byName = byName || "Unknown";
      existingBatch.startDate = startDate;
      existingBatch.endDate = endDate;
      existingBatch.batchStatus = batchStatus;

      await existingBatch.save();
      return res.status(200).json({ success: true, batch: existingBatch });
    } else {
      const newBatch = await Batch.create({
        batchId,
        batchName,
        batchPrice: Number(batchPrice) || 0,
        batchImage,
        template,
        language,
        byName: byName || "Unknown",
        startDate,
        endDate,
        batchStatus,
        enrolledTokens: enrolledTokens.map((token: any) => ({
          ownerId: token.ownerId,
          accessToken: token.accessToken,
          refreshToken: token.refreshToken,
          tokenStatus: true,
          updatedAt: new Date(),
        })),
      });

      return res.status(200).json({ success: true, batch: newBatch });
    }
  } catch (error: any) {
    console.error("Error in addBatch API:", error);
    return res.status(500).json({ message: error.message || "Failed to add batch" });
  }
}
