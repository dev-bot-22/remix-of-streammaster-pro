import { defineModel } from "@/lib/pgstore";

const TgBot = defineModel({
  collection: "tg_bots",
  defaults: () => ({
    ownerId: "",
    log_channel_Id: "",
    webUrl: "",
    ownerUsername: "",
    channels: [],
  }),
});

export default TgBot;
