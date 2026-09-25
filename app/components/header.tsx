"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sun,
  LogOut,
  Menu,
  ChevronLeft,
  Moon,
  Computer,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { VerificationHeaderTimer } from "@/app/components/VerificationHeaderTimer";

interface HeaderProps {
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
}
type Theme = "LIGHT" | "DARK" | "SYSTEM";

export function Header({ isMobileMenuOpen, setIsMobileMenuOpen }: HeaderProps) {
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>("LIGHT");

  const [user, setUser] = useState<{
    name?: string;
    telegramId?: string;
    photoUrl?: string;
  } | null>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem("USER_THEME") as Theme | null;

    if (
      savedTheme === "LIGHT" ||
      savedTheme === "DARK" ||
      savedTheme === "SYSTEM"
    ) {
      setTheme(savedTheme);
    } else {
      localStorage.setItem("USER_THEME", "LIGHT");
      setTheme("LIGHT");
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;

    const apply = (t: Theme) => {
      if (t === "DARK") {
        root.classList.add("dark");
      } else if (t === "LIGHT") {
        root.classList.remove("dark");
      } else {
        const prefersDark = window.matchMedia(
          "(prefers-color-scheme: dark)"
        ).matches;
        root.classList.toggle("dark", prefersDark);
      }
    };

    apply(theme);
    localStorage.setItem("USER_THEME", theme);

    if (theme === "SYSTEM") {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = (e: MediaQueryListEvent) => {
        root.classList.toggle("dark", e.matches);
      };
      media.addEventListener("change", handler);
      return () => media.removeEventListener("change", handler);
    }
  }, [theme]);

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Failed to logout");
      }

      localStorage.clear();
      router.push("/auth");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  useEffect(() => {
    const storedUser = localStorage.getItem("USER_DATA");
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser({
          name:
            parsedUser.name && parsedUser.name.trim() !== ""
              ? parsedUser.name
              : "There",
          telegramId: parsedUser.telegramId,
          photoUrl: parsedUser.photoUrl,
        });
      } catch (error) {
        console.error("Failed to parse user from localStorage:", error);
        setUser({ name: "There", photoUrl: "" });
      }
    } else {
      setUser({ name: "There", photoUrl: "" });
    }
  }, []);

  return (
    <header className="sticky top-0 z-30 glass-navbar bg-gradient-to-r from-spring-leaf/5 to-spring-mint/5 dark:from-spring-leaf/8 dark:to-spring-mint/8 border-b border-spring-leaf/10 dark:border-spring-mint/15 shadow-spring-sm p-2 sm:p-4 flex items-center justify-between">
      <div className="flex items-center gap-2 rounded-xl sm:px-2 py-2 md:ml-0">
        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="icon"
          className="xl:hidden rounded-xl"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          <Menu className="h-6 w-6" />
        </Button>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-xl hover:bg-spring-leaf/10 dark:hover:bg-spring-mint/10 hover:text-spring-leaf dark:hover:text-spring-mint transition-all duration-200"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
      </div>

      <div className="flex items-center gap-3">
        {/* Verification Expiration Countdown Timer */}
        <VerificationHeaderTimer />

        {/* Theme Toggle */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative rounded-xl" suppressHydrationWarning>
              {theme === "LIGHT" ? (
                <Sun className="h-5 w-5 text-amber-500" />
              ) : (
                <Moon className="h-5 w-5 text-blue-400" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onClick={() => setTheme("LIGHT")}
              className="cursor-pointer"
            >
              <Sun className="mr-2 h-4 w-4 text-amber-500" />
              <span>Light</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setTheme("DARK")}
              className="cursor-pointer"
            >
              <Moon className="mr-2 h-4 w-4 text-blue-400" />
              <span>Dark</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setTheme("SYSTEM")}
              className="cursor-pointer"
            >
              <Computer className="mr-2 h-4 w-4" />
              <span>System</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="hidden sm:inline truncate max-w-40 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium">
          Hi, {user?.name}
        </span>

        {/* Profile Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0 ring-2 ring-primary/20 hover:ring-primary/40 transition-all duration-300" suppressHydrationWarning>
              <Avatar>
                <AvatarImage src={user?.photoUrl} />
                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-cyan-400 text-white font-bold">
                  {user?.name && user.name.length > 0
                    ? user.name.slice(0, 2).toUpperCase()
                    : "SR"}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onClick={handleLogout}
              className="cursor-pointer text-red-500 focus:text-red-500"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
