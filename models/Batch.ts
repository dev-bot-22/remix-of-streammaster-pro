import { defineModel } from "@/lib/pgstore";

export interface IEnrolledToken {
  ownerId: string;
  accessToken: string;
  refreshToken: string;
  tokenStatus: boolean;
  randomId?: string;
  updatedAt: string | Date;
}

export interface IBatch {
  _id: string;
  batchId: string;
  batchName: string;
  batchPrice: number;
  batchImage: string;
  template: string;
  BatchType: string;
  language: string;
  byName: string;
  startDate: string;
  endDate: string;
  batchStatus: boolean;
  enrolledTokens: IEnrolledToken[];
  createdAt: string | Date;
  updatedAt: string | Date;
  save: () => Promise<any>;
}

const Batch = defineModel({
  collection: "batches",
  idFrom: "batchId",
  defaults: () => ({
    batchId: "",
    batchName: "",
    batchPrice: 0,
    batchImage: "",
    template: "NORMAL",
    BatchType: "FREE",
    language: "",
    byName: "",
    startDate: "",
    endDate: "",
    batchStatus: true,
    enrolledTokens: [],
  }),
});

export default Batch;
