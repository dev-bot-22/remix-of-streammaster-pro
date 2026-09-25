import dbConnect from "@/lib/mongodb";
import ServerConfig from "@/models/ServerConfig";
import { getPublicServerConfig } from "@/lib/publicServerConfig";

export async function getAllServerConfigs() {
  try {
    await dbConnect();
    const configs = await ServerConfig.find({}).lean();
    if (configs.length) return configs;
  } catch (err) {
    console.error("[serverConfig] read failed:", (err as Error).message);
  }

  // No row yet (fresh database) — fall back to branding/app settings so the
  // site still renders correctly.
  const pub = await getPublicServerConfig();
  return [
    {
      _id: 1,
      webName: pub.webName,
      sidebarTitle: pub.sidebarTitle,
      sidebarLogoUrl: pub.sidebarLogoUrl,
      tg_channel: pub.tg_channel,
      tg_username: pub.tg_username,
      tg_bot: pub.tg_bot,
      isDirectLoginOpen: pub.isDirectLoginOpen,
      registrationOpen: true,
      shortner_servers: [],
    } as any,
  ];
}
