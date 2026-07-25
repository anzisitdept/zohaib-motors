"use client";
import { useState, useEffect, useMemo } from "react";
import { collection, onSnapshot, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Scale, Printer, Download, Plus, Minus, Equal } from "lucide-react";
import { cn } from "@/lib/utils";

export const BalanceSheetManager = () => {
  const { user } = useAuth();
  
  const [accounts, setAccounts] = useState<any[]>([]);
  const [cars, setCars] = useState<any[]>([]);
  const [installmentPlans, setInstallmentPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateStr, setDateStr] = useState(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));

  useEffect(() => {
    let unsubs: (() => void)[] = [];

    // 1. Fetch Accounts for Bank, Cash, Payables, and basic Receivables
    unsubs.push(onSnapshot(collection(db, "accounts"), snap => {
      setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }));

    // 2. Fetch Cars for Inventory Value
    unsubs.push(onSnapshot(query(collection(db, "cars"), where("purchasePrice", ">", 0)), snap => {
      setCars(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }));

    // 3. Fetch Installment Plans for additional Receivables
    unsubs.push(onSnapshot(query(collection(db, "installmentPlans"), where("status", "in", ["active", "due_soon", "overdue"])), snap => {
      setInstallmentPlans(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }));

    // Simple heuristic to stop loading once all data streams are hot
    // In a real app we'd track each individually
    const timer = setTimeout(() => setLoading(false), 800);
    
    return () => {
      clearTimeout(timer);
      unsubs.forEach(u => u());
    };
  }, []);

  const sheet = useMemo(() => {
    let bank = 0, cash = 0, basicReceivables = 0, payables = 0;
    
    // Core accounting logic mirrors Dashboard KPI Cards precisely
    accounts.forEach(a => {
      const t = (a.typeName || "").toLowerCase();
      const n = (a.name || "").toLowerCase();
      const b = Number(a.balance) || 0;
      
      if (t === "bank") {
        bank += b;
      } else if (t.includes("cash") || n.includes("cash")) {
        cash += b;
      } else if (t === "customer" || t === "client" || t === "vendor" || t === "supplier") {
        // Dashboard classifies positive client balance as receivable, negative as payable
        if (b > 0) basicReceivables += b;
        else if (b < 0) payables += Math.abs(b);
      } else if (t === "partner" || t === "investor") {
        // Partner/Investor balances: positive means they owe us (receivable), negative means we owe them (payable)
        if (b > 0) basicReceivables += b;
        else if (b < 0) payables += Math.abs(b);
      }
    });

    // Inventory Value
    let inventory = 0;
    cars.forEach(c => {
      if (!c.isSold) {
        const p = Number(c.purchasePrice) || 0;
        const e = Number(c.totalExpenses) || 0;
        inventory += Number(c.capitalizedCost) || (p + e);
      }
    });

    // Installment Plans Receivables
    let installmentReceivables = 0;
    installmentPlans.forEach(p => {
      installmentReceivables += Number(p.outstandingBalance || 0);
    });

    // Total Assets & Liabilities
    const totalReceivables = basicReceivables + installmentReceivables;
    const totalAssets = bank + cash + inventory + totalReceivables;
    const totalLiabilities = payables; // Expanded later if long-term debt or other liabilities exist
    
    const netPosition = totalAssets - totalLiabilities;

    return {
      bank,
      cash,
      inventory,
      basicReceivables,
      installmentReceivables,
      totalReceivables,
      payables,
      totalAssets,
      totalLiabilities,
      netPosition
    };
  }, [accounts, cars, installmentPlans]);

  const SectionRow = ({ label, value, indent = false }: { label: string, value: number, indent?: boolean }) => (
    <div className={cn("flex justify-between py-2 border-b border-border/50 last:border-0", indent && "pl-6")}>
      <span className={cn("text-sm", indent ? "text-muted-foreground" : "font-medium text-foreground")}>{label}</span>
      <span className={cn("text-sm", indent ? "text-muted-foreground font-mono" : "font-semibold text-foreground font-mono")}>
        Rs. {value.toLocaleString()}
      </span>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-600 rounded-xl text-white shadow-sm">
            <Scale size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Balance Sheet</h1>
            <p className="text-sm text-muted-foreground">Snapshot of financial position as of {dateStr}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2 font-semibold">
            <Printer size={16} /> Print
          </Button>
          <Button variant="outline" className="gap-2 font-semibold">
            <Download size={16} /> Export
          </Button>
        </div>
      </div>

      {loading ? (
        <Card className="border-border shadow-sm p-16 text-center text-muted-foreground">
          Loading financial data...
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* ASSETS */}
          <Card className="border-border shadow-sm flex flex-col">
            <CardHeader className="bg-emerald-50/50 dark:bg-emerald-950/20 border-b border-border pb-4">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <Plus size={18} />
                <CardTitle className="text-lg">Assets</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 flex-1">
              <div className="space-y-1">
                <SectionRow label="Cash & Equivalents" value={sheet.bank + sheet.cash} />
                <SectionRow label="Bank Balances" value={sheet.bank} indent />
                <SectionRow label="Cash in Hand" value={sheet.cash} indent />
                
                <div className="py-2" />
                
                <SectionRow label="Accounts Receivable" value={sheet.totalReceivables} />
                <SectionRow label="Client & Partner Accounts" value={sheet.basicReceivables} indent />
                <SectionRow label="Active Installment Plans" value={sheet.installmentReceivables} indent />
                
                <div className="py-2" />
                
                <SectionRow label="Inventory" value={sheet.inventory} />
                <SectionRow label="Unsold Vehicles (Capitalized Cost)" value={sheet.inventory} indent />
              </div>
            </CardContent>
            <div className="p-4 bg-muted border-t border-border flex justify-between items-center rounded-b-xl">
              <span className="font-bold text-foreground">Total Assets</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 text-lg">Rs. {sheet.totalAssets.toLocaleString()}</span>
            </div>
          </Card>

          {/* LIABILITIES & NET POSITION */}
          <div className="space-y-6 flex flex-col">
            <Card className="border-border shadow-sm flex-1">
              <CardHeader className="bg-rose-50/50 dark:bg-rose-950/20 border-b border-border pb-4">
                <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
                  <Minus size={18} />
                  <CardTitle className="text-lg">Liabilities</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-1">
                  <SectionRow label="Accounts Payable" value={sheet.payables} />
                  <SectionRow label="Vendor & Partner Owed Balances" value={sheet.payables} indent />
                </div>
              </CardContent>
              <div className="p-4 bg-muted border-t border-border flex justify-between items-center rounded-b-xl">
                <span className="font-bold text-foreground">Total Liabilities</span>
                <span className="font-bold text-rose-600 dark:text-rose-400 text-lg">Rs. {sheet.totalLiabilities.toLocaleString()}</span>
              </div>
            </Card>

            <Card className={cn(
              "border shadow-sm relative overflow-hidden",
              sheet.netPosition >= 0 ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-900" : "border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-900"
            )}>
              <div className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2.5 rounded-lg text-white",
                    sheet.netPosition >= 0 ? "bg-emerald-600" : "bg-rose-600"
                  )}>
                    <Equal size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground uppercase tracking-wider text-xs mb-0.5">Net Position</h3>
                    <p className="text-xs text-muted-foreground">Assets minus Liabilities</p>
                  </div>
                </div>
                <div className={cn(
                  "text-2xl font-black tracking-tight",
                  sheet.netPosition >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
                )}>
                  Rs. {sheet.netPosition.toLocaleString()}
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};
