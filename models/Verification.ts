import { defineModel } from "@/lib/pgstore";

export interface IVerifiedBatch {
  batchId: string | null;
  expireAt: string | null;
  verifiedAt: string | null;
  verificationToken: string | null;
}

const Verification = defineModel({
  collection: "verifications",
  idFrom: "anon_id",
  defaults: () => ({
    anon_id: "",
    iphash: "",
    useragent: "",
    verified: false,
    timestamp: new Date().toISOString(),
    expireAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    verifiedBatch: [],
  }),
});

/** Drop verifiedBatch entries whose expiry has passed. */
export function pruneVerifiedBatches(doc: any) {
  if (!doc || !Array.isArray(doc.verifiedBatch)) return doc;
  const now = Date.now();
  doc.verifiedBatch = doc.verifiedBatch.filter(
    (b: IVerifiedBatch) => !b?.expireAt || new Date(b.expireAt).getTime() > now
  );
  return doc;
}

export default Verification;
