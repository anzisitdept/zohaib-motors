"use client";

import { useState } from "react";
import { 
  BarChart3, Database, ShoppingCart, PackagePlus, 
  Wallet, FileText, Users, Globe, Settings, Terminal, PieChart
} from "lucide-react";
import { cn } from "@/lib/utils";

// Category Components (To be created)
import { ExecutiveDashboard } from "./categories/ExecutiveDashboard";
import { InventoryReports } from "./categories/InventoryReports";
import { PurchaseReports } from "./categories/PurchaseReports";
import { SalesReports } from "./categories/SalesReports";
import { FinanceReports } from "./categories/FinanceReports";
import { TrackingReports } from "./categories/TrackingReports";
import { ClientsReports } from "./categories/ClientsReports";

export const ReportsManager = () => {
  const [activeCategory, setActiveCategory] = useState("overview");

  const CATEGORIES = [
    { id: "overview", label: "Executive Dashboard", icon: BarChart3 },
    { id: "inventory", label: "1. Inventory & Showroom", icon: Database },
    { id: "purchase", label: "2. Purchase & Acquisition", icon: PackagePlus },
    { id: "sales", label: "3. Sales & Revenue", icon: ShoppingCart },
    { id: "finance", label: "4. Accounts & Finance", icon: Wallet },
    { id: "tracking", label: "5. File Tracking & Registration", icon: FileText },
    { id: "clients", label: "6. Clients & Investors", icon: Users },
    { id: "profit", label: "7. Profit & Distribution", icon: PieChart },
    { id: "system", label: "8. System & Logs", icon: Terminal },
  ];

  const renderContent = () => {
    switch (activeCategory) {
      case "overview": return <ExecutiveDashboard />;
      case "inventory": return <InventoryReports />;
      case "purchase": return <PurchaseReports />;
      case "sales": return <SalesReports />;
      case "finance": return <FinanceReports />;
      case "tracking": return <TrackingReports />;
      case "clients": return <ClientsReports />;
      case "profit": return <div className="p-8 text-center text-muted-foreground">Monthly Profit & Partner Distribution Report Coming Soon...</div>;
      case "system": return <div className="p-8 text-center text-muted-foreground">System Reports Coming Soon...</div>;
      default: return null;
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-6">
      
      {/* Sidebar Navigation */}
      <div className="w-full md:w-64 shrink-0 space-y-1">
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4 px-3">Report Categories</h2>
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left",
              activeCategory === cat.id 
                ? "bg-slate-900 text-white shadow-md" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <cat.icon size={18} className={activeCategory === cat.id ? "text-white" : "text-muted-foreground"} />
            {cat.label}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 bg-card border border-border rounded-xl shadow-sm overflow-hidden min-h-[600px]">
        {renderContent()}
      </div>
      
    </div>
  );
};
