import { defineModel, Model } from "@/lib/pgstore";

export interface IDownloadToken {
  _id: string;
  tokenId: string;
  videoUrl: string;
  lectureName: string;
  thumbnail?: string;
  duration?: number;
  createdAt: string | Date;
}

const DownloadToken = defineModel({
  collection: "download_tokens",
  idFrom: "tokenId",
  defaults: () => ({
    tokenId: "",
    videoUrl: "",
    lectureName: "",
    thumbnail: "",
    duration: 0,
  }),
});

/** Kept for backwards compatibility with the old multi-connection helper. */
export function getDownloadTokenModel(_connection?: unknown): Model {
  return DownloadToken;
}

export default DownloadToken;
