import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { getPublicServerConfig } from "@/lib/publicServerConfig";

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    const {
      sidebarLogoUrl,
      sidebarTitle,
      tg_channel,
      tg_username,
      isDirectLoginOpen,
      webName,
      tg_bot,
      loginEnabled,
    } = await getPublicServerConfig();

    return NextResponse.json(
      {
        webName,
        sidebarLogoUrl,
        sidebarTitle,
        tg_channel,
        tg_username,
        isDirectLoginOpen,
        tg_bot,
        loginEnabled,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[serverInfo] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
