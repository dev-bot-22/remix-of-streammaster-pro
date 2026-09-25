import { defineModel } from "@/lib/pgstore";
import { APP_NAME, TELEGRAM_LINK, TELEGRAM_USERNAME } from "@/lib/branding";

export interface IShortnerServer {
  name: string;
  enabled: boolean;
  api_url: string;
  api_key: string;
}

export interface IServerConfig {
  _id: number | string;
  webName: string;
  registrationOpen: boolean;
  sidebarLogoUrl: string;
  sidebarTitle: string;
  isDirectLoginOpen: boolean;
  password: string;
  tg_bot: string;
  tg_channel: string;
  tg_username: string;
  username: string;
  shortner_servers: IShortnerServer[];
  updatedAt: string | Date;
}

// Single settings row (id = "1"). `password` is hashed automatically on write.
const ServerConfig = defineModel({
  collection: "server_config",
  hashFields: ["password"],
  defaults: () => ({
    _id: 1,
    webName: APP_NAME,
    registrationOpen: true,
    sidebarLogoUrl: "",
    sidebarTitle: APP_NAME,
    isDirectLoginOpen: true,
    password: "",
    tg_bot: "",
    tg_channel: TELEGRAM_LINK,
    tg_username: TELEGRAM_USERNAME,
    username: "admin",
    shortner_servers: [],
  }),
});

export default ServerConfig;
