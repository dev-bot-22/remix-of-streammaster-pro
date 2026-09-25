import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import SubjectClientPage from "./SubjectClientPage";
import dbConnect from "@/lib/mongodb";
import Verification from "@/models/Verification";
import ServerConfig from "@/models/ServerConfig";

export default async function Page({ params }: { params: Promise<{ batchid: string, subjectid: string }> }) {
  const { batchid } = await params;

  await dbConnect();
  const config = await ServerConfig.findOne({ _id: 1 });
  const isVerificationEnabled = config?.shortner_servers?.some((s: any) => s.enabled) || false;

  if (isVerificationEnabled) {
    const anon_id = (await cookies()).get("anon_id")?.value;
    if (!anon_id) {
      redirect(`/key-generate?batchId=${batchid}`);
    }

    const verification = await Verification.findOne({ anon_id });
    let isVerified = false;

    if (verification) {
      const verifiedBatch = verification.verifiedBatch || [];
      isVerified = verifiedBatch.some(
        (vb: any) => vb.batchId === batchid && new Date() < new Date(vb.expireAt)
      );
    }

    if (!isVerified) {
      redirect(`/key-generate?batchId=${batchid}`);
    }
  }

  // If verified, render the client page
  return <SubjectClientPage />;
}
