"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { jwtDecode } from "jwt-decode";
import GuestAuthGate from "./GuestAuthGate";

interface JwtPayload {
  exp: number; // expiry time in seconds since epoch
}
export default function ClientLayout({
  children,
  sidebarTitle,
  sidebarLogoUrl,
  BookLibrary,
  tgChannel,
}: {
  children: React.ReactNode;
  sidebarTitle?: string;
  sidebarLogoUrl?: string;
  BookLibrary?: string;
  tgChannel?: string;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const router = useRouter();
  const pathname = usePathname();

  return (
    <><GuestAuthGate />
    <div className="flex min-h-screen bg-gradient-to-br from-white via-spring-mint/5 to-spring-leaf/5 dark:from-slate-950 dark:via-spring-leaf/8 dark:to-spring-mint/8">
      <Sidebar
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        sidebarTitle={sidebarTitle}
        sidebarLogoUrl={sidebarLogoUrl}
        BookLibrary={BookLibrary}
        tgChannel={tgChannel}
      />
      <div className="flex-1 flex flex-col min-w-0 bg-gradient-to-br from-transparent via-spring-mint/3 to-spring-leaf/3 dark:via-spring-mint/5 dark:to-spring-leaf/5">
        <Header
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
        />
        <main className="flex-1 bg-gradient-to-b from-spring-leaf/2 dark:from-spring-leaf/4">{children}</main>
      </div>
    </div>
    </>
  );
}
