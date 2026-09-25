import ServerConfig from "@/models/ServerConfig";
import { getAppSettings } from "@/lib/appSettings";
import { APP_NAME, BRAND_LOGO, TELEGRAM_BOT_USERNAME, TELEGRAM_LINK, TELEGRAM_USERNAME } from "@/lib/branding";

export type PublicServerConfig = {
  webName: string;
  sidebarLogoUrl: string;
  sidebarTitle: string;
  tg_channel: string;
  tg_username: string;
  isDirectLoginOpen: boolean;
  tg_bot: string;
  loginEnabled: boolean;
};

export async function getPublicServerConfig(): Promise<PublicServerConfig> {
  const settings = await getAppSettings();

  let config: any = null;
  try {
    config = await ServerConfig.findOne({ _id: 1 }).lean();
  } catch (err) {
    console.error("[publicServerConfig] read failed:", (err as Error).message);
  }

  const appName = settings.appName || config?.webName || APP_NAME;
  const telegram = settings.telegramLink || config?.tg_channel || TELEGRAM_LINK;

  return {
    webName: appName,
    sidebarLogoUrl: BRAND_LOGO,
    sidebarTitle: appName,
    tg_channel: telegram,
    tg_username: config?.tg_username || TELEGRAM_USERNAME,
    isDirectLoginOpen: config?.isDirectLoginOpen ?? true,
    tg_bot: config?.tg_bot || TELEGRAM_BOT_USERNAME,
    loginEnabled: settings.loginEnabled,
  };
}
