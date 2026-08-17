// components/layout/Sidebar.tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, Settings, PlusCircle, Car, FileText, LogOut,
  Users, LucideIcon, BarChart3, Shield, Truck, ChevronLeft, ChevronRight,
  X, UserCircle, History, Wallet, Layers, Receipt, ArrowLeftRight, BookOpen,
  ShoppingCart, PackagePlus, Landmark, ChevronDown, ChevronUp, Scale,
  Globe, MessageSquare, Package, Database, Newspaper,
  CreditCard, Calendar, CheckCircle2, PieChart
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permissionId?: string;
}

interface NavSection {
  key: string;
  label: string;
  icon: LucideIcon;
  color: string;           // Tailwind text color class for accent
  bgColor: string;         // Tailwind bg color for header when active
  permissionId?: string;
  items: NavItem[];
}

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
}

// ─── Nav Structure ────────────────────────────────────────────────────────────
const NAV_SECTIONS: NavSection[] = [
  {
    key: "accounts",
    label: "Accounts",
    icon: Wallet,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    items: [
      { href: "/dashboard/accounts", label: "Manage Accounts", icon: Wallet, permissionId: "accounts" },
      { href: "/dashboard/account-types", label: "Account Types", icon: Layers, permissionId: "account_types" },
      { href: "/dashboard/clients", label: "Manage Clients", icon: UserCircle, permissionId: "clients" },
      { href: "/dashboard/purchase-invoice", label: "Purchase Invoice", icon: PackagePlus, permissionId: "purchase_invoice" },
      { href: "/dashboard/purchase-invoices", label: "Purchase Invoice List", icon: FileText, permissionId: "purchase_invoice" },
      { href: "/dashboard/sale-invoice", label: "Sale Invoice", icon: ShoppingCart, permissionId: "sale_invoice" },
      { href: "/dashboard/purchase-inventory", label: "Purchase Inventory", icon: Package, permissionId: "inventory" },
      { href: "/dashboard/cash-voucher", label: "Cash Voucher", icon: Receipt, permissionId: "cash_voucher" },
      { href: "/dashboard/general-voucher", label: "General Voucher", icon: ArrowLeftRight, permissionId: "general_voucher" },
      { href: "/dashboard/general-ledger", label: "General Ledger", icon: BookOpen, permissionId: "general_ledger" },
    ],
  },

  {
    key: "installments",
    label: "Installments",
    icon: CreditCard,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    items: [
      { href: "/dashboard/installments/due", label: "Due This Month", icon: Calendar, permissionId: "sale_invoice" },
      { href: "/dashboard/installments/settled", label: "Settled Plans", icon: CheckCircle2, permissionId: "sale_invoice" },
    ],
  },
  {
    key: "reports",
    label: "Reports",
    icon: BarChart3,
    color: "text-rose-600",
    bgColor: "bg-rose-50",
    permissionId: "reports",
    items: [
      { href: "/dashboard/reports", label: "Analytics Overview", icon: BarChart3, permissionId: "reports" },
      { href: "/dashboard/reports/balance-sheet", label: "Balance Sheet", icon: Scale, permissionId: "reports" },
      { href: "/dashboard/reports/profit-distribution", label: "Partner Profit Share", icon: PieChart, permissionId: "reports" },
      { href: "/dashboard/general-voucher", label: "General Voucher", icon: ArrowLeftRight, permissionId: "general_voucher" },
      { href: "/dashboard/logs", label: "Activity Logs", icon: FileText, permissionId: "logs" },
    ],
  },
];

// Always visible top items (outside sections)
const TOP_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permissionId: "dashboard" },
  { href: "/dashboard/registry", label: "New Registration", icon: PlusCircle, permissionId: "registry" },
];

// Always visible bottom items
const BOTTOM_ITEMS: NavItem[] = [
  { href: "/dashboard/roles", label: "Roles", icon: Shield, permissionId: "roles" },
  { href: "/dashboard/users", label: "Users", icon: Users, permissionId: "users" },
  { href: "/dashboard/settings", label: "Configurations", icon: Settings, permissionId: "settings" },
];

// ─── Component ────────────────────────────────────────────────────────────────
export const Sidebar = ({ isCollapsed, setIsCollapsed, isMobileOpen, setIsMobileOpen }: SidebarProps) => {
  const pathname = usePathname();
  const { logout, userData } = useAuth();
  // Default open: the section whose child is currently active
  const initialOpen = () => {
    const s = new Set<string>();
    NAV_SECTIONS.forEach(section => {
      if (section.items.some(i => pathname === i.href || pathname.startsWith(i.href + "/"))) {
        s.add(section.key);
      }
    });
    if (s.size === 0) s.add("accounts"); // default open
    return s;
  };
  const [openSections, setOpenSections] = useState<Set<string>>(initialOpen);

  const hasPermission = (permissionId?: string) => {
    if (!permissionId) return true;
    if (!userData) return false;
    if (userData.role === "admin" || userData.role === "Super Admin") return true;
    if (userData.permissions?.includes("ALL")) return true;
    return userData.permissions?.includes(permissionId);
  };

  const toggleSection = (key: string) => {
    if (isCollapsed) return;
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ── Single nav link ──────────────────────────────────────────────────────────
  const NavLink = ({ item, compact = false }: { item: NavItem; compact?: boolean }) => {
    if (!hasPermission(item.permissionId)) return null;
    const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
    const Icon = item.icon;
    return (
      <Link
        href={item.href}
        onClick={() => setIsMobileOpen(false)}
        className={cn(
          "flex items-center rounded-md transition-all duration-150 group relative",
          compact
            ? "gap-2 px-2 py-1.5 text-xs"
            : "gap-3 px-3 py-2 text-sm font-medium",
          isActive
            ? "bg-slate-100 text-slate-900 font-semibold"
            : "text-slate-500 hover:bg-slate-50 hover:text-slate-800",
          isCollapsed && "justify-center px-2"
        )}
        title={isCollapsed ? item.label : undefined}
      >
        <Icon size={compact ? 14 : 18} className={cn("shrink-0", isActive && "text-slate-900")} />
        {!isCollapsed && <span className="truncate">{item.label}</span>}
        {isCollapsed && (
          <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 pointer-events-none">
            {item.label}
          </div>
        )}
      </Link>
    );
  };

  // ── Section ──────────────────────────────────────────────────────────────────
  const SidebarSection = ({ section }: { section: NavSection }) => {
    if (!hasPermission(section.permissionId)) return null;
    const isOpen = openSections.has(section.key);
    const Icon = section.icon;
    const anyActive = section.items.some(
      i => pathname === i.href || pathname.startsWith(i.href + "/")
    );

    return (
      <div className="mb-1">
        {/* Section Header */}
        <button
          onClick={() => toggleSection(section.key)}
          className={cn(
            "w-full flex items-center rounded-lg px-3 py-2 transition-all duration-150 group relative",
            anyActive
              ? `${section.bgColor} ${section.color} font-semibold`
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-800",
            isCollapsed && "justify-center px-2"
          )}
          title={isCollapsed ? section.label : undefined}
        >
          <Icon size={18} className="shrink-0" />
          {!isCollapsed && (
            <>
              <span className="ml-2.5 flex-1 text-left text-sm font-semibold tracking-wide">{section.label}</span>
              {isOpen
                ? <ChevronUp size={13} className="shrink-0 opacity-60" />
                : <ChevronDown size={13} className="shrink-0 opacity-60" />
              }
            </>
          )}
          {isCollapsed && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 pointer-events-none">
              {section.label}
            </div>
          )}
        </button>

        {/* Section Items */}
        {isOpen && !isCollapsed && (
          <div className={cn("mt-0.5 ml-2 pl-3 border-l-2 space-y-0.5", `border-l-${section.color.split("-")[1]}-100`)}>
            {section.items.map(item => (
              <NavLink key={item.href} item={item} compact />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside className={cn(
        "fixed left-0 top-0 bottom-0 bg-white border-r border-slate-200 flex flex-col z-50 transition-all duration-300 ease-in-out",
        isCollapsed ? "w-16" : "w-64",
        "transform md:transform-none",
        isMobileOpen ? "translate-x-0 w-64" : "-translate-x-full md:translate-x-0"
      )}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100 shrink-0">
          {!isCollapsed ? (
            <img src="/Vendora side.png" alt="Vendora" className="h-36 w-auto object-contain" />
          ) : (
            <div className="w-full flex justify-center">
              <div className="h-8 w-8 bg-slate-900 rounded flex items-center justify-center text-white font-bold text-sm">V</div>
            </div>
          )}
          <Button variant="ghost" size="icon" className="md:hidden absolute right-2 top-4" onClick={() => setIsMobileOpen(false)}>
            <X size={20} />
          </Button>
        </div>

        {/* Collapse Toggle (desktop only) */}
        {!isMobileOpen && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute -right-3 top-20 h-6 w-6 rounded-full border border-slate-200 bg-white p-0 shadow-sm hidden md:flex items-center justify-center hover:bg-slate-50 text-slate-400 hover:text-slate-600"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
          </Button>
        )}

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-0.5">
          {/* Dashboard (always on top, outside sections) */}
          {TOP_ITEMS.map(item => <NavLink key={item.href} item={item} />)}

          {/* Divider */}
          {!isCollapsed && <div className="mx-1 my-2 border-t border-slate-100" />}

          {/* Four main sections */}
          {NAV_SECTIONS.map(section => (
            <SidebarSection key={section.key} section={section} />
          ))}

          {/* Divider */}
          {!isCollapsed && <div className="mx-1 my-2 border-t border-slate-100" />}

          {/* Admin/Config items at bottom of nav */}
          {BOTTOM_ITEMS.map(item => <NavLink key={item.href} item={item} />)}
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-slate-100 shrink-0">
          {!isCollapsed && (
            <div className="mb-2 px-1 text-xs text-slate-400 truncate">
              {userData?.name && <span className="font-medium text-slate-600">{userData.name} · </span>}
              {userData?.role || "Staff"}
            </div>
          )}
          <Button
            variant="ghost"
            className={cn(
              "w-full text-red-600 hover:text-red-700 hover:bg-red-50 text-sm",
              isCollapsed ? "justify-center px-0" : "justify-start"
            )}
            onClick={logout}
            title={isCollapsed ? "Sign Out" : undefined}
          >
            <LogOut size={18} className={cn("shrink-0", !isCollapsed && "mr-2")} />
            {!isCollapsed && <span>Sign Out</span>}
          </Button>
        </div>
      </aside>
    </>
  );
};