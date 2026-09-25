import dbConnect from "@/lib/mongodb";
import Verification from "@/models/Verification";

export default async function handler(req: any, res: any) {
  const anon_id = req.body?.anon_id || req.query?.anon_id;
  const batchId = req.body?.batchId || req.query?.batchId;

  if (!anon_id) return res.status(400).json({ error: "anon_id is required" });

  await dbConnect();
  const doc = await Verification.findOne({ anon_id });
  
  // Set security headers to prevent caching
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  if (!doc) {
    return res.status(200).json({ verified: false, verifiedBatches: [] });
  }

  const now = new Date();

  // If batchId is provided, check if that specific batch is verified & active
  if (batchId) {
    const vb = doc.verifiedBatch?.find(
      (b: any) => b.batchId === batchId && b.expireAt && new Date(b.expireAt) > now
    );
    return res.status(200).json({ 
      verified: !!vb,
      expireAt: vb ? vb.expireAt : null,
      batchId: batchId
    });
  }

  // Return all active verified batches with their expiration times
  const activeBatches = (doc.verifiedBatch || [])
    .filter((vb: any) => vb.expireAt && new Date(vb.expireAt) > now)
    .map((vb: any) => ({
      batchId: vb.batchId,
      expireAt: vb.expireAt
    }));

  return res.status(200).json({ 
    verified: doc.verified,
    verifiedBatches: activeBatches
  });
} 