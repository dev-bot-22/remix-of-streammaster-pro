// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import ClientShell from "@/app/components/ClientShell";
import OfflineOverlay from "@/app/components/OfflineOverlay";
import { Providers } from "@/app/components/Providers";
import { BRAND_LOGO } from "@/lib/branding";

const inter = { className: "font-sans" };

export async function generateMetadata(): Promise<Metadata> {
  // Use environment variables only, no server-side fetch during build
  return {
    title: process.env.NEXT_PUBLIC_APP_NAME || "PW-MARCO",
    description: "PW-MARCO ~ Learn, Code, Grow",
    manifest: "/manifest.json",
    authors: [
      { name: "PW-MARCO", url: "https://t.me/official_marco_22" },
    ],
    creator: "PW-MARCO",
    icons: {
      icon: "/favicon.png?v=pw-marco-2026c",
      shortcut: "/favicon.png?v=pw-marco-2026c",
      apple: "/apple-touch-icon.png?v=pw-marco-2026c",
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Don't fetch server info on the server - let client handle it
  // This avoids server-side MongoDB connection issues during initial render
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} antialiased`}>
        {/* Preload the brand logo so it never flashes the old artwork */}
        <link rel="preload" as="image" href={BRAND_LOGO} fetchPriority="high" />
        <Providers>
          <OfflineOverlay />
          <ClientShell>{children}</ClientShell>
        </Providers>
      </body>
    </html>
  );
}
