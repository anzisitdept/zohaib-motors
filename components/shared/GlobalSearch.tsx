"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import {
  Search, X, Car, UserCircle, Wallet, LayoutDashboard, FileText,
  Truck, ShoppingCart, PackagePlus, Receipt, BookOpen, BarChart3,
  Globe, ArrowLeftRight, History, ChevronRight, Loader2, Package
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface SearchResult {
  id: string;
  type: "vehicle" | "client" | "account" | "page";
  label: string;
  sub?: string;
  href: string;
  icon: any;
}

// ─── Static page links (always searchable) ────────────────────────────────────
const PAGE_LINKS: SearchResult[] = [
  { id: "p-dashboard",     type: "page", label: "Dashboard",            href: "/dashboard",                     icon: LayoutDashboard },
  { id: "p-registry",      type: "page", label: "New Registration",     href: "/dashboard/registry",            icon: Car },
  { id: "p-inventory",     type: "page", label: "File Inventory",       href: "/dashboard/inventory",           icon: FileText },
  { id: "p-history",       type: "page", label: "Vehicle History",      href: "/dashboard/history",             icon: History },
  { id: "p-delivery",      type: "page", label: "Delivery",             href: "/dashboard/delivery",            icon: Truck },
  { id: "p-clients",       type: "page", label: "Manage Clients",       href: "/dashboard/clients",             icon: UserCircle },
  { id: "p-accounts",      type: "page", label: "Manage Accounts",      href: "/dashboard/accounts",            icon: Wallet },
  { id: "p-sale-inv",      type: "page", label: "Sale Invoice",         href: "/dashboard/sale-invoice",        icon: ShoppingCart },
  { id: "p-pur-inv",       type: "page", label: "Purchase Invoice",     href: "/dashboard/purchase-invoice",    icon: PackagePlus },
  { id: "p-pur-list",      type: "page", label: "Purchase Invoice List",href: "/dashboard/purchase-invoices",   icon: FileText },
  { id: "p-pur-stock",     type: "page", label: "Purchase Inventory",   href: "/dashboard/purchase-inventory",  icon: Package },
  { id: "p-cash-v",        type: "page", label: "Cash Voucher",         href: "/dashboard/cash-voucher",        icon: Receipt },
  { id: "p-gen-v",         type: "page", label: "General Voucher",      href: "/dashboard/general-voucher",     icon: ArrowLeftRight },
  { id: "p-ledger",        type: "page", label: "General Ledger",       href: "/dashboard/general-ledger",      icon: BookOpen },
  { id: "p-reports",       type: "page", label: "Reports",              href: "/dashboard/reports",             icon: BarChart3 },
  { id: "p-balance",       type: "page", label: "Balance Sheet",        href: "/dashboard/reports/balance-sheet", icon: BarChart3 },
  { id: "p-website-inv",   type: "page", label: "Website Inventory",    href: "/dashboard/website-inventory",   icon: Globe },
  { id: "p-website-inq",   type: "page", label: "Website Inquiries",    href: "/dashboard/website-inquiries",   icon: Globe },
];

const TYPE_LABELS: Record<string, string> = {
  vehicle: "Vehicle",
  client:  "Client",
  account: "Account",
  page:    "Page",
};

const TYPE_COLORS: Record<string, string> = {
  vehicle: "bg-blue-100 text-blue-700",
  client:  "bg-emerald-100 text-emerald-700",
  account: "bg-purple-100 text-purple-700",
  page:    "bg-muted text-muted-foreground",
};

// ─── Component ────────────────────────────────────────────────────────────────
export function GlobalSearch() {
  const { user } = useAuth();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query_text, setQueryText] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);

  // Cached data to avoid re-fetching on every keystroke
  const [vehicles, setVehicles]   = useState<any[]>([]);
  const [clients, setClients]     = useState<any[]>([]);
  const [accounts, setAccounts]   = useState<any[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef  = useRef<HTMLDivElement>(null);

  // ── Open/close ───────────────────────────────────────────────────────────────
  const open = useCallback(() => {
    setIsOpen(true);
    setQueryText("");
    setSelected(0);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setQueryText("");
    setResults([]);
    setSelected(0);
  }, []);

  // ── Keyboard shortcut Ctrl+K / Cmd+K ─────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        isOpen ? close() : open();
      }
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, open, close]);

  // ── Fetch all data once when opened ──────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || dataLoaded || !user) return;
    setLoading(true);
    Promise.all([
      getDocs(query(collection(db, "cars"),     orderBy("createdAt", "desc"), limit(500))),
      getDocs(query(collection(db, "clients"),  orderBy("name"),              limit(500))),
      getDocs(query(collection(db, "accounts"), orderBy("name"),              limit(500))),
    ]).then(([carsSnap, clientsSnap, accountsSnap]) => {
      setVehicles(carsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setClients(clientsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setAccounts(accountsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setDataLoaded(true);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [isOpen, dataLoaded, user]);

  // ── Filter on query change ────────────────────────────────────────────────────
  useEffect(() => {
    const q = query_text.trim().toLowerCase();

    if (!q) {
      // Show top pages as default suggestions
      setResults(PAGE_LINKS.slice(0, 8));
      setSelected(0);
      return;
    }

    const r: SearchResult[] = [];

    // Pages
    PAGE_LINKS.forEach(p => {
      if (p.label.toLowerCase().includes(q)) r.push(p);
    });

    // Vehicles (cars collection)
    vehicles.forEach(v => {
      const match =
        (v.chassisNumber || "").toLowerCase().includes(q) ||
        (v.registrationNumber || "").toLowerCase().includes(q) ||
        (`${v.brandName || ""} ${v.model || ""}`).toLowerCase().includes(q) ||
        (v.variant || "").toLowerCase().includes(q) ||
        (v.color || "").toLowerCase().includes(q);

      if (match) {
        r.push({
          id: `vehicle-${v.id}`,
          type: "vehicle",
          label: `${v.brandName || ""} ${v.model || ""}`.trim() || "Vehicle",
          sub: [v.chassisNumber, v.registrationNumber, v.color].filter(Boolean).join(" · "),
          href: `/dashboard/inventory?search=${encodeURIComponent(v.chassisNumber || v.id)}`,
          icon: Car,
        });
      }
    });

    // Clients
    clients.forEach(c => {
      const match =
        (c.name || "").toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q) ||
        (c.cnic || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q);

      if (match) {
        r.push({
          id: `client-${c.id}`,
          type: "client",
          label: c.name || "Client",
          sub: [c.phone, c.cnic].filter(Boolean).join(" · "),
          href: `/dashboard/clients`,
          icon: UserCircle,
        });
      }
    });

    // Accounts
    accounts.forEach(a => {
      const match =
        (a.name || "").toLowerCase().includes(q) ||
        (a.typeName || "").toLowerCase().includes(q);

      if (match) {
        r.push({
          id: `account-${a.id}`,
          type: "account",
          label: a.name || "Account",
          sub: a.typeName,
          href: `/dashboard/accounts`,
          icon: Wallet,
        });
      }
    });

    setResults(r.slice(0, 25));
    setSelected(0);
  }, [query_text, vehicles, clients, accounts]);

  // ── Keyboard navigation ───────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected(s => Math.min(s + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected(s => Math.max(s - 1, 0));
    } else if (e.key === "Enter" && results[selected]) {
      e.preventDefault();
      navigate(results[selected].href);
    }
  };

  // Keep selected item visible
  useEffect(() => {
    const el = listRef.current?.children[selected] as HTMLElement;
    el?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const navigate = (href: string) => {
    close();
    router.push(href);
  };

  // ── Group results by type ────────────────────────────────────────────────────
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.type]) acc[r.type] = [];
    acc[r.type].push(r);
    return acc;
  }, {});

  const flatGrouped: SearchResult[] = [];
  const groupOrder = ["page", "vehicle", "client", "account"] as const;
  groupOrder.forEach(type => {
    if (grouped[type]) flatGrouped.push(...grouped[type]);
  });

  return (
    <>
      {/* ── Trigger button in header ── */}
      <button
        onClick={open}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground bg-muted hover:border-border border border-border rounded-lg transition-colors group"
      >
        <Search size={15} className="text-muted-foreground" />
        <span className="hidden sm:block text-muted-foreground font-medium">Search...</span>
        <kbd className="hidden md:flex items-center gap-0.5 text-[10px] font-mono bg-card border border-border rounded px-1.5 py-0.5 text-muted-foreground shadow-sm">
          <span>⌘</span><span>K</span>
        </kbd>
      </button>

      {/* ── Modal ── */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={close}
          />

          {/* Panel */}
          <div className="relative w-full max-w-3xl bg-card rounded-2xl shadow-2xl overflow-hidden border border-border flex flex-col max-h-[70vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Search Input */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
              {loading
                ? <Loader2 size={18} className="text-muted-foreground animate-spin shrink-0" />
                : <Search size={18} className="text-muted-foreground shrink-0" />
              }
              <input
                ref={inputRef}
                type="text"
                value={query_text}
                onChange={e => setQueryText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search vehicles, clients, accounts, pages..."
                className="flex-1 bg-transparent text-foreground placeholder-slate-400 text-base outline-none font-medium"
              />
              {query_text && (
                <button onClick={() => setQueryText("")} className="text-muted-foreground hover:text-muted-foreground transition-colors shrink-0">
                  <X size={16} />
                </button>
              )}
              <kbd className="hidden sm:block text-[10px] font-mono bg-muted border border-border rounded px-1.5 py-0.5 text-muted-foreground shrink-0 cursor-pointer" onClick={close}>
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div ref={listRef} className="overflow-y-auto flex-1">
              {!query_text && (
                <div className="px-4 pt-3 pb-1">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Quick Navigation</p>
                </div>
              )}

              {results.length === 0 && query_text && !loading && (
                <div className="py-16 flex flex-col items-center gap-2 text-muted-foreground">
                  <Search size={32} className="opacity-30" />
                  <p className="text-sm font-medium">No results for &ldquo;{query_text}&rdquo;</p>
                </div>
              )}

              {/* Render results grouped */}
              {(() => {
                const rendered: React.ReactNode[] = [];
                let flatIdx = 0;
                let lastType = "";
                flatGrouped.forEach((result, idx) => {
                  const globalIdx = flatIdx++;
                  const isSelected = globalIdx === selected;
                  const Icon = result.icon;

                  // Section header
                  if (result.type !== lastType) {
                    lastType = result.type;
                    rendered.push(
                      <div key={`hdr-${result.type}`} className="px-4 pt-3 pb-1">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          {TYPE_LABELS[result.type] || result.type}s
                        </p>
                      </div>
                    );
                  }

                  rendered.push(
                    <button
                      key={result.id}
                      onClick={() => navigate(result.href)}
                      onMouseEnter={() => setSelected(globalIdx)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                        isSelected ? "bg-muted" : "hover:bg-muted"
                      )}
                    >
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", TYPE_COLORS[result.type])}>
                        <Icon size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{result.label}</p>
                        {result.sub && <p className="text-xs text-muted-foreground truncate mt-0.5">{result.sub}</p>}
                      </div>
                      {isSelected && <ChevronRight size={14} className="text-muted-foreground shrink-0" />}
                    </button>
                  );
                });
                return rendered;
              })()}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-border bg-muted flex items-center gap-4 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><kbd className="font-mono bg-card border border-border rounded px-1 py-0.5 shadow-sm">↑</kbd><kbd className="font-mono bg-card border border-border rounded px-1 py-0.5 shadow-sm">↓</kbd> Navigate</span>
              <span className="flex items-center gap-1"><kbd className="font-mono bg-card border border-border rounded px-1.5 py-0.5 shadow-sm">↵</kbd> Open</span>
              <span className="flex items-center gap-1"><kbd className="font-mono bg-card border border-border rounded px-1.5 py-0.5 shadow-sm">ESC</kbd> Close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
