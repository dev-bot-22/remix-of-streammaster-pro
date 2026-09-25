import { defineModel } from "@/lib/pgstore";

export interface IVideoStream {
  _id: string;
  uuid: string;
  signedQuery: string;
  expiresAt: string | Date;
  keyHex?: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  save: () => Promise<any>;
}

const VideoStream = defineModel({
  collection: "video_streams",
  idFrom: "uuid",
  defaults: () => ({ uuid: "", signedQuery: "", expiresAt: null, keyHex: "" }),
});

export default VideoStream;
