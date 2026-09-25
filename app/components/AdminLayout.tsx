"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Home,
  Users,
  Layers,
  Settings,
  LogOut,
  Info,
  User,
  ChevronDown,
  Menu,
  X,
  Link,
  UserCircle,
  KeyRound,
  ToggleRight
} from "lucide-react";
import { toast } from "sonner";

interface AdminLayoutProps {
  children: React.ReactNode;
  activePage?: string;
}

export default function AdminLayout({ children, activePage = "dashboard" }: AdminLayoutProps) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/admin/logout", {
        method: "POST",
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(data.message || "Logged out successfully");
        router.replace("/admin/login");
      } else {
        toast.error(data.message || "Logout failed");
      }
    } catch (error) {
      toast.error("An error occurred during logout");
      console.error("Logout error:", error);
    }
  };

  const handleProfileClick = () => {
    router.push("/admin/profile");
    setShowProfileMenu(false);
  };

  const handleDashboardClick = () => {
    router.push("/admin/dashboard");
    setShowMobileSidebar(false);
  };

  const handleNavClick = (page: string) => {
    setShowMobileSidebar(false);
    router.push(`/admin/${page}`);
  };

  return (
    <div className="flex h-screen">
      {/* Mobile Sidebar Overlay */}
      {showMobileSidebar && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
          onClick={() => setShowMobileSidebar(false)}
        />
      )}

      {/* Left Sidebar */}
      <div className={`fixed lg:static inset-y-0 left-0 z-50 w-64 glass-sidebar flex flex-col transform transition-all duration-300 ease-in-out ${showMobileSidebar ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}>
        {/* Logo */}
        <div className="p-6 border-b border-[var(--glass-border)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center shadow-btn-3d">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <span className="font-bold text-xl">Admin</span>
          </div>
          <button
            onClick={() => setShowMobileSidebar(false)}
            className="lg:hidden p-1.5 rounded-xl hover:bg-accent/50 transition-all duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1.5">
          <NavItem
            icon={<Home className="w-5 h-5" />}
            label="Dashboard"
            active={activePage === "dashboard"}
            onClick={handleDashboardClick}
          />
          <NavItem
            icon={<Users className="w-5 h-5" />}
            label="Users"
            active={activePage === "users"}
            onClick={() => handleNavClick("users")}
          />
          <NavItem
            icon={<UserCircle className="w-5 h-5" />}
            label="Guests"
            active={activePage === "guests"}
            onClick={() => handleNavClick("guests")}
          />
          <NavItem
            icon={<KeyRound className="w-5 h-5" />}
            label="Tokens"
            active={activePage === "tokens"}
            onClick={() => handleNavClick("tokens")}
          />
          <NavItem
            icon={<Layers className="w-5 h-5" />}
            label="Batches"
            active={activePage === "batches"}
            onClick={() => handleNavClick("batches")}
          />
          <NavItem
            icon={<ToggleRight className="w-5 h-5" />}
            label="Controls"
            active={activePage === "controls"}
            onClick={() => handleNavClick("controls")}
          />
          <NavItem
            icon={<Settings className="w-5 h-5" />}
            label="Settings"
            active={activePage === "settings"}
            onClick={() => handleNavClick("settings")}
          />
          <NavItem
            icon={<Link className="w-5 h-5" />}
            label="Shortner"
            active={activePage === "shortner"}
            onClick={() => handleNavClick("shortner")}
          />
        </nav>

        {/* Bottom Links */}
        <div className="p-3 border-t border-[var(--glass-border)] space-y-1">
          <button className="flex items-center gap-3 w-full px-4 py-2.5 text-muted-foreground hover:bg-accent/50 rounded-xl transition-all duration-200">
            <Info className="w-4 h-4" />
            <span className="text-sm">Help & information</span>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-2.5 text-red-500 hover:bg-red-500/10 rounded-xl transition-all duration-200"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm font-medium">Log out</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="glass-navbar p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowMobileSidebar(true)}
                className="lg:hidden p-2 rounded-xl hover:bg-accent/50 transition-all duration-200"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center shadow-btn-3d">
                  <span className="text-white font-bold text-sm">A</span>
                </div>
                <span className="font-bold text-xl">Admin</span>
              </div>
            </div>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-2 p-2 rounded-xl hover:bg-accent/50 transition-all duration-200"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-medium hidden sm:block">Admin</span>
                <ChevronDown className="w-4 h-4" />
              </button>
              {showProfileMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 glass-dropdown z-50 p-1.5">
                  <button
                    onClick={handleProfileClick}
                    className="w-full text-left px-4 py-2.5 hover:bg-accent/50 text-sm rounded-xl transition-all duration-200"
                  >
                    Profile Settings
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2.5 hover:bg-red-500/10 text-sm text-red-500 rounded-xl transition-all duration-200"
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-1">
          {children}
        </div>
      </div>
    </div>
  );
}

function NavItem({
  icon,
  label,
  active,
  onClick
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all duration-200 ${active
          ? 'bg-primary/15 text-primary border border-primary/20 shadow-sm font-semibold'
          : 'text-foreground/70 hover:bg-accent/50 hover:text-foreground'
        }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );
} 
