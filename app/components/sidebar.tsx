"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Contact, GraduationCap, Presentation, Send, Heart } from "lucide-react";
import Image from "next/image";
import { APP_NAME, BRAND_LOGO } from "@/lib/branding";

interface SidebarProps {
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  sidebarTitle?: string;
  sidebarLogoUrl?: string;
  BookLibrary?: string;
  tgChannel?: string;
}

export function Sidebar({
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  sidebarTitle,
  sidebarLogoUrl,
  BookLibrary,
  tgChannel,
}: SidebarProps) {
  const pathname = usePathname();

  const sidebarItems = [
    { icon: BookOpen, text: "Study", href: "/study/" },
    { icon: Presentation, text: "Batches", href: "/study/batches" },
    { icon: GraduationCap, text: "My Batches", href: "/study/mybatches" },
    { icon: Send, text: "Join Telegram", href: tgChannel || "" },
    { icon: Heart, text: "Donate Batch", href: "/study/donate" },
    { icon: Contact, text: "Contact Us", href: "/contact" },
  ];

  return (
    <>
      {/* Backdrop for mobile */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 xl:hidden transition-opacity duration-300"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`
    z-50 w-64 
    bg-gradient-to-b from-spring-leaf/8 to-spring-mint/4
    dark:from-spring-leaf/12 dark:to-spring-mint/6
    border-r border-spring-leaf/10 dark:border-spring-mint/15
    backdrop-blur-[8px]
    transform transition-all duration-300 ease-in-out
    ${isMobileMenuOpen
            ? "fixed top-0 left-0 translate-x-0 h-full"
            : "fixed top-0 left-0 -translate-x-full h-full"
          }
    xl:sticky xl:top-0 xl:translate-x-0 xl:h-screen xl:z-auto
  `}
      >
        {/* Logo */}
        <div className="p-4 border-b border-spring-leaf/10 dark:border-spring-mint/10 sticky top-0 z-10 flex items-center gap-3 bg-transparent">
          <div className="w-10 h-10 rounded-full dark:bg-spring-mint/10 overflow-hidden ring-2 ring-spring-leaf/20 dark:ring-spring-mint/30">
            <Image
              src={BRAND_LOGO}
              alt={APP_NAME}
              width={40}
              height={40}
              priority={true}
            />
          </div>
          <span className="font-semibold bg-gradient-to-r from-spring-leaf to-spring-mint dark:from-spring-mint to-spring-mint-dark bg-clip-text text-transparent">
            {APP_NAME}
          </span>
          <GraduationCap className="text-spring-leaf dark:text-spring-mint animate-leaf-sway" />
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-1.5 overflow-y-auto h-[calc(100vh-5rem)]">
          {sidebarItems.map((item) => {
            let isActive = false;

            if (item.href === "/study/") {
              isActive = pathname === "/study" || pathname === "/study/";
            } else if (item.href === "/study/batches") {
              isActive =
                pathname === "/study/batches" ||
                pathname?.startsWith("/study/batches/") || false;
            } else if (item.href === "/study/mybatches") {
              isActive =
                pathname === "/study/mybatches" ||
                pathname?.startsWith("/study/mybatches/") || false;
            } else {
              isActive = pathname === item.href;
            }

            return (
              <Link key={item.text} href={item.href as string}>
                <div
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer text-sm transition-all duration-200 ${isActive
                    ? "bg-spring-leaf/15 dark:bg-spring-mint/15 text-spring-leaf dark:text-spring-mint border border-spring-leaf/30 dark:border-spring-mint/30 shadow-spring-sm"
                    : "text-foreground/70 hover:text-foreground hover:bg-spring-leaf/8 dark:hover:bg-spring-mint/8"
                    }`}
                >
                  <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-spring-leaf dark:text-spring-mint" : ""}`} />
                  <span className="font-medium">{item.text}</span>
                  {isActive && <span className="ml-auto text-lg">🍃</span>}
                </div>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
