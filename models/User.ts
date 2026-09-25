import { defineModel } from "@/lib/pgstore";

export interface IUser {
  _id: string;
  UserName: string;
  phoneNumber: string;
  telegramId?: string | null;
  photoUrl?: string | null;
  tag?: string | null;
  tagExpiry?: string | Date | null;
  hasLoggedIn: boolean;
  refreshToken?: string | null;
  ActualToken?: string | null;
  ActualRefresh?: string | null;
  randomId?: string | null;
  enrolledBatches: { batchId: string; name: string }[];
  createdAt: string | Date;
  updatedAt: string | Date;
  save: () => Promise<any>;
}

// Backed by Postgres (Neon) through the JSONB document store.
const User = defineModel({
  collection: "users",
  defaults: () => ({
    UserName: "",
    phoneNumber: "",
    telegramId: null,
    photoUrl: null,
    tag: null,
    tagExpiry: null,
    hasLoggedIn: false,
    refreshToken: null,
    ActualToken: null,
    ActualRefresh: null,
    randomId: null,
    enrolledBatches: [],
  }),
});

export default User;
