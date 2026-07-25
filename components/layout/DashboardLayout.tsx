// components/layout/DashboardLayout.tsx
"use client";

import { ReactNode, useState } from "react";
import { Sidebar } from "./Sidebar";
import { useAuth } from "@/context/AuthContext";
import { LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { GlobalSearch } from "../shared/GlobalSearch";
import { TENANT_CONFIG } from "@/config/tenant";

export const DashboardLayout = ({ children }: { children: ReactNode }) => {
  const { userData, logout } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const getInitials = (name?: string) => {
    return name
      ? name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
      : "ST";
  };

  return (
    <div className="min-h-screen bg-muted dark:bg-background">
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        isMobileOpen={isMobileSidebarOpen}
        setIsMobileOpen={setIsMobileSidebarOpen}
      />

      <main className={cn(
        "flex flex-col min-h-screen transition-all duration-300 ease-in-out dark bg-background text-foreground",
        isSidebarCollapsed ? "md:pl-20" : "md:pl-64"
      )}>
        <header className="h-16 border-b border-border bg-card sticky top-0 z-40 px-4 md:px-8 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger */}
            <Button variant="ghost" size="icon" className="md:hidden -ml-2 text-foreground hover:bg-muted" onClick={() => setIsMobileSidebarOpen(true)}>
              <Menu size={24} />
            </Button>
            <h2 className="text-2xl font-black tracking-tighter bg-gradient-to-r from-[#E5484D] to-[#8a1c20] bg-clip-text text-transparent uppercase drop-shadow-sm leading-none hidden md:block">
              {TENANT_CONFIG.logoText}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <GlobalSearch />

            {/* User Profile Section - Hover for Logout */}
          <div className="relative group">
            <div className="flex items-center gap-3 cursor-pointer py-1.5 px-2 rounded-lg hover:bg-muted transition-colors">
              <div className="text-right hidden md:block">
                <div className="text-sm font-semibold text-foreground leading-tight">
                  {userData?.name || "Staff Member"}
                </div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide bg-muted inline-block px-1.5 rounded-sm mt-0.5">
                  {userData?.role || "GUEST"}
                </div>
              </div>

              <div className="h-9 w-9 rounded-full bg-secondary border-2 border-border text-secondary-foreground flex items-center justify-center text-xs font-bold shadow-sm">
                {getInitials(userData?.name)}
              </div>
            </div>

            {/* Hover Dropdown */}
            <div className="absolute right-0 top-full pt-1 w-48 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform origin-top-right z-50">
              <div className="bg-card border border-border shadow-xl rounded-lg overflow-hidden ring-1 ring-black/5">
                <div className="p-3 border-b border-border md:hidden bg-muted">
                  <p className="font-semibold text-sm text-foreground">{userData?.name}</p>
                  <p className="text-xs text-muted-foreground uppercase">{userData?.role}</p>
                </div>
                <button
                  onClick={logout}
                  className="w-full text-left px-4 py-3 text-sm text-destructive hover:bg-destructive/10 flex items-center gap-2 transition-colors font-medium"
                >
                  <LogOut size={16} />
                  <span>Sign Out Account</span>
                </button>
              </div>
            </div>
          </div>
          </div>
        </header>

        <div className="flex-1 p-4 md:p-8 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
};
