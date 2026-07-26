"use client";
import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { SearchSelector } from "@/components/ui/SearchSelector";
import { BookOpen, Calendar, Printer, Search, ArrowUpRight, ArrowDownRight, Wallet, ArrowRight } from "lucide-react";

interface Account {
  id: string;
  name: string;
  typeName: string;
  balance: number;
}

interface LedgerEntry {
  id: string;
  date: string;
  voucherCode: string;
  description: string;
  debit: number;
  credit: number;
  balanceAfter: number;
  createdAt: any;
}

export const GeneralLedgerManager = () => {
  const { user } = useAuth();
  
  // Data State
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cashVouchers, setCashVouchers] = useState<any[]>([]);
  const [generalVouchers, setGeneralVouchers] = useState<any[]>([]);

  // Search/Filters State
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [filterMode, setFilterMode] = useState<"whole" | "range">("whole");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

  // Load Accounts, Cash Vouchers & General Vouchers
  useEffect(() => {
    const unsubAccounts = onSnapshot(query(collection(db, "accounts"), orderBy("name")), (snap) => {
      setAccounts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)));
    });

    const unsubCash = onSnapshot(collection(db, "vouchers"), (snap) => {
      setCashVouchers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubGeneral = onSnapshot(collection(db, "general-vouchers"), (snap) => {
      setGeneralVouchers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubAccounts();
      unsubCash();
      unsubGeneral();
    };
  }, []);

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);

  // Helper function to get ledger metrics for a single account
  const getAccountMetrics = (accId: string) => {
    const acc = accounts.find(a => a.id === accId);
    if (!acc) return { openingBalance: 0, totalDebited: 0, totalCredited: 0, closingBalance: 0, entries: [] };

    const entries: LedgerEntry[] = [];

    // Cash Vouchers — handle both new dual-entry and old single-entry formats
    cashVouchers.forEach(v => {
      // Opening Balance vouchers are NOT shown as transaction rows —
      // their value is already reflected in acc.balance, so the initialBalance
      // formula (acc.balance − allDeb + allCred) correctly derives the opening
      // balance without double-counting when OB entries are excluded here.
      if (v.isOpeningBalance) return;

      const isNewFormat = !!v.cashAccountId;
      const vCodeStr = v.voucherNo ? v.voucherNo.toString() : "";
      // Preserve OB-/PI-/SI- prefixes; only pad plain numeric voucher numbers with CV-
      const voucherCode = /^(OB-|PI-|SI-|JV-)/.test(vCodeStr)
        ? vCodeStr
        : `CV-${vCodeStr.padStart(4, "0")}`;

      if (isNewFormat) {
        // Cash leg — use ACTUAL balance change, not v.amount
        // (sale price ≠ book value, so v.amount can differ between legs)
        if (v.cashAccountId === accId) {
          const cashDelta = Math.abs(
            (v.cashNewBalance ?? acc.balance) - (v.cashPreviousBalance ?? acc.balance)
          ) || v.amount;
          entries.push({
            id: v.id + "_cash",
            date: v.date,
            voucherCode,
            description: `[↔ ${v.counterAccountName}] ${v.description}`,
            debit: v.cashType === 'debit' ? cashDelta : 0,
            credit: v.cashType === 'credit' ? cashDelta : 0,
            balanceAfter: v.cashNewBalance ?? acc.balance,
            createdAt: v.createdAt
          });
        }
        // Counter leg — use ACTUAL balance change for same reason
        if (v.counterAccountId === accId && v.counterType) {
          const counterDelta = Math.abs(
            (v.counterNewBalance ?? acc.balance) - (v.counterPreviousBalance ?? acc.balance)
          ) || v.amount;
          entries.push({
            id: v.id + "_counter",
            date: v.date,
            voucherCode,
            description: `[↔ ${v.cashAccountName}] ${v.description}`,
            debit: v.counterType === 'debit' ? counterDelta : 0,
            credit: v.counterType === 'credit' ? counterDelta : 0,
            balanceAfter: v.counterNewBalance ?? acc.balance,
            createdAt: v.createdAt
          });
        }
      } else {
        // Old single-entry format (backward compat)
        if (v.accountId === accId) {
          entries.push({
            id: v.id,
            date: v.date,
            voucherCode,
            description: v.description,
            debit: v.type === 'debit' ? v.amount : 0,
            credit: v.type === 'credit' ? v.amount : 0,
            balanceAfter: v.newBalance ?? acc.balance,
            createdAt: v.createdAt
          });
        }
      }
    });

    // General Vouchers
    generalVouchers.forEach(g => {
      if (g.fromAccountId === accId) {
        const gCodeStr = g.voucherNo ? g.voucherNo.toString() : "";
        entries.push({
          id: g.id,
          date: g.date,
          voucherCode: gCodeStr.startsWith("JV-") ? gCodeStr : `JV-${gCodeStr.padStart(4, '0')}`,
          description: `[Transfer to ${g.toAccountName}] ${g.description}`,
          debit: 0,
          credit: g.amount,
          balanceAfter: g.fromNewBalance ?? acc.balance,
          createdAt: g.createdAt
        });
      } else if (g.toAccountId === accId) {
        const gCodeStr = g.voucherNo ? g.voucherNo.toString() : "";
        entries.push({
          id: g.id,
          date: g.date,
          voucherCode: gCodeStr.startsWith("JV-") ? gCodeStr : `JV-${gCodeStr.padStart(4, '0')}`,
          description: `[Transfer from ${g.fromAccountName}] ${g.description}`,
          debit: g.amount,
          credit: 0,
          balanceAfter: g.toNewBalance ?? acc.balance,
          createdAt: g.createdAt
        });
      }
    });

    // Sort entries chronologically
    const sortedAll = entries.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.voucherCode.localeCompare(b.voucherCode);
    });

    // ── Step 1: Derive the account's TRUE initial balance (at account creation) ──
    // Work backwards from the live acc.balance by reversing all voucher effects.
    // This correctly picks up the "Initial Balance" set in AccountsManager.
    const allDeb = sortedAll.reduce((s, e) => s + e.debit, 0);
    const allCred = sortedAll.reduce((s, e) => s + e.credit, 0);
    const initialBalance = acc.balance - allDeb + allCred;

    // ── Step 2: Recompute running balances for ALL entries from initial balance ──
    // Using stored snapshots (balanceAfter on vouchers) is unreliable because
    // invoice vouchers (PI-/SI-) sort after cash vouchers on the same date.
    let runningAll = initialBalance;
    const sortedAllWithRunning = sortedAll.map(entry => {
      runningAll += entry.debit - entry.credit;
      return { ...entry, balanceAfter: runningAll };
    });

    // ── Step 3: Filter by date range ──
    const filtered = filterMode === "whole"
      ? sortedAllWithRunning
      : sortedAllWithRunning.filter(e =>
          (!fromDate || e.date >= fromDate) && (!toDate || e.date <= toDate)
        );

    // ── Step 4: Opening balance for the selected period ──
    let opBal: number;
    if (filterMode === "whole") {
      // Show the account's initial balance as the opening balance
      opBal = initialBalance;
    } else if (fromDate) {
      // Balance at end of all entries BEFORE the from-date
      const priorEntries = sortedAllWithRunning.filter(e => e.date < fromDate);
      opBal = priorEntries.length > 0
        ? priorEntries[priorEntries.length - 1].balanceAfter
        : initialBalance;
    } else {
      opBal = initialBalance;
    }

    // ── Step 5: Totals & closing ──
    const deb = filtered.reduce((s, e) => s + e.debit, 0);
    const cred = filtered.reduce((s, e) => s + e.credit, 0);

    // Whole history closing = live acc.balance (authoritative, avoids sort-order bugs)
    // Date range closing = last entry's running balance within the period
    const closing = filterMode === "whole"
      ? acc.balance
      : (filtered.length > 0 ? filtered[filtered.length - 1].balanceAfter : opBal);

    return {
      openingBalance: opBal,
      totalDebited: deb,
      totalCredited: cred,
      closingBalance: closing,
      entries: filtered
    };
  };

  // Compute metrics based on selection
  const singleAccountData = selectedAccountId && selectedAccountId !== "ALL" ? getAccountMetrics(selectedAccountId) : null;

  const allAccountsData = selectedAccountId === "ALL" ? accounts.map(acc => ({
    account: acc,
    ...getAccountMetrics(acc.id)
  })) : [];

  // Summary Totals
  const openingBalance = singleAccountData ? singleAccountData.openingBalance : allAccountsData.reduce((sum, item) => sum + item.openingBalance, 0);
  const totalDebited = singleAccountData ? singleAccountData.totalDebited : allAccountsData.reduce((sum, item) => sum + item.totalDebited, 0);
  const totalCredited = singleAccountData ? singleAccountData.totalCredited : allAccountsData.reduce((sum, item) => sum + item.totalCredited, 0);
  const closingBalance = singleAccountData ? singleAccountData.closingBalance : allAccountsData.reduce((sum, item) => sum + item.closingBalance, 0);

  const handlePrint = () => {
    window.print();
  };

  const PrintableLedgerDoc = () => {
    if (!selectedAccountId) return null;

    if (selectedAccountId === "ALL") {
      return (
        <div id="print-content" className="bg-card p-8 md:p-12 max-w-5xl mx-auto text-foreground font-sans relative border border-slate-300 rounded-lg">
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-8">
            <div className="flex flex-col">
              <div className="mb-3 -ml-1"><h2 className="print-brand-text text-3xl font-black tracking-tighter bg-gradient-to-r from-[#E5484D] to-[#8a1c20] bg-clip-text text-transparent uppercase drop-shadow-sm leading-none">ZOHAIB MOTORS</h2><div className="h-1 w-12 bg-[#1C1F26] mt-1 rounded-full opacity-80"></div></div>
              <h1 className="text-2xl font-bold uppercase tracking-tight text-foreground">All Accounts Ledger Summary</h1>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">Consolidated Ledger trial Balance Sheet</p>
            </div>
            <div className="text-right space-y-1">
              <div className="bg-slate-900 text-white px-3 py-1 text-xs font-bold tracking-widest inline-block mb-1.5">
                SUMMARY REPORT
              </div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Report Type</p>
              <p className="text-sm font-bold font-mono">
                {filterMode === "whole" ? "Whole History" : "Date Filtered"}
              </p>
              {filterMode === "range" && (
                <>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold mt-1">Period</p>
                  <p className="text-xs font-mono">{fromDate || "Start"} to {toDate || "End"}</p>
                </>
              )}
            </div>
          </div>

          {/* Consolidated Summary */}
          <div className="flex flex-col gap-4 mb-8 bg-muted p-4 border rounded-lg">
            <div>
              <span className="text-[9px] text-muted-foreground font-bold uppercase block">Consolidated Report</span>
              <h3 className="text-sm font-bold text-foreground">All Ledger Accounts ({accounts.length})</h3>
            </div>
            <div className="print-grid-summary text-right pt-2 border-t border-border">
              <div>
                <span className="text-[9px] text-muted-foreground font-bold uppercase block">Grand Opening Bal</span>
                <span className="print-val text-xs font-bold text-foreground">Rs. {openingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div>
                <span className="text-[9px] text-muted-foreground font-bold uppercase block">Total Debits</span>
                <span className="print-val text-xs font-bold text-green-600">Rs. {totalDebited.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div>
                <span className="text-[9px] text-muted-foreground font-bold uppercase block">Total Credits</span>
                <span className="print-val text-xs font-bold text-red-600">Rs. {totalCredited.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* All Accounts Summary Table */}
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-800">
                <th className="py-2.5 font-bold uppercase text-muted-foreground">Account Name</th>
                <th className="py-2.5 font-bold uppercase text-muted-foreground">Account Type</th>
                <th className="py-2.5 text-right font-bold uppercase text-muted-foreground">Opening Balance</th>
                <th className="py-2.5 text-right font-bold uppercase text-muted-foreground">Total Debit (+)</th>
                <th className="py-2.5 text-right font-bold uppercase text-muted-foreground">Total Credit (-)</th>
                <th className="py-2.5 text-right font-bold uppercase text-muted-foreground">Net Closing Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {allAccountsData.map(item => (
                <tr key={item.account.id} className="hover:bg-muted transition-colors">
                  <td className="py-2.5 font-bold text-foreground">{item.account.name}</td>
                  <td className="py-2.5 text-muted-foreground font-medium">{item.account.typeName}</td>
                  <td className="py-2.5 text-right text-muted-foreground font-mono">Rs. {item.openingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="py-2.5 text-right text-green-600 font-mono font-semibold">Rs. {item.totalDebited.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="py-2.5 text-right text-red-600 font-mono font-semibold">Rs. {item.totalCredited.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="py-2.5 text-right text-foreground font-mono font-bold">Rs. {item.closingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-900 font-bold bg-muted/50">
                <td colSpan={2} className="py-3 text-foreground text-sm font-black uppercase">Grand Totals</td>
                <td className="py-3 text-right text-foreground font-mono text-xs">Rs. {openingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="py-3 text-right text-green-600 font-mono text-xs">Rs. {totalDebited.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="py-3 text-right text-red-600 font-mono text-xs">Rs. {totalCredited.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="py-3 text-right text-foreground font-mono text-sm font-black">Rs. {closingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-12 mt-16 pt-8 border-t border-border text-center">
            <div>
              <div className="h-12 border-b border-dashed border-slate-300"></div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground mt-2 block">Accountant's Signature</span>
            </div>
            <div>
              <div className="h-12 border-b border-dashed border-slate-300"></div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground mt-2 block">Authorized Audit Sign-off</span>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-12 text-[10px] text-muted-foreground flex justify-between border-t border-border pt-4 uppercase">
            <span>Zohaib Motors accounts System</span>
            <span>Generated on {new Date().toLocaleString()}</span>
          </div>
        </div>
      );
    }

    if (!selectedAccount || !singleAccountData) return null;
    return (
      <div id="print-content" className="bg-card p-8 md:p-12 max-w-5xl mx-auto text-foreground font-sans relative border border-slate-300 rounded-lg">
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-8">
          <div className="flex flex-col">
            <div className="mb-3 -ml-1"><h2 className="print-brand-text text-3xl font-black tracking-tighter bg-gradient-to-r from-[#E5484D] to-[#8a1c20] bg-clip-text text-transparent uppercase drop-shadow-sm leading-none">ZOHAIB MOTORS</h2><div className="h-1 w-12 bg-[#1C1F26] mt-1 rounded-full opacity-80"></div></div>
            <h1 className="text-2xl font-bold uppercase tracking-tight text-foreground">General Ledger Statement</h1>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">Account Activity Audit</p>
          </div>
          <div className="text-right space-y-1">
            <div className="bg-slate-900 text-white px-3 py-1 text-xs font-bold tracking-widest inline-block mb-1.5">
              LEDGER REPORT
            </div>
            <p className="text-[10px] text-muted-foreground uppercase font-bold">Report Type</p>
            <p className="text-sm font-bold font-mono">
              {filterMode === "whole" ? "Whole History" : "Date Filtered"}
            </p>
            {filterMode === "range" && (
              <>
                <p className="text-[10px] text-muted-foreground uppercase font-bold mt-1">Period</p>
                <p className="text-xs font-mono">{fromDate || "Start"} to {toDate || "End"}</p>
              </>
            )}
          </div>
        </div>

        {/* Account Details & Summary */}
        <div className="flex flex-col gap-4 mb-8 bg-muted p-4 border rounded-lg">
          <div>
            <span className="text-[10px] text-muted-foreground font-bold uppercase block">Account Detail</span>
            <h2 className="text-lg font-bold text-foreground">{selectedAccount.name}</h2>
            <span className="text-xs text-muted-foreground font-medium">Type: {selectedAccount.typeName}</span>
          </div>
          <div className="print-grid-summary text-right pt-2 border-t border-border">
            <div>
              <span className="text-[9px] text-muted-foreground font-bold uppercase block">Opening Balance</span>
              <span className="print-val text-xs font-semibold text-muted-foreground">Rs. {openingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div>
              <span className="text-[9px] text-muted-foreground font-bold uppercase block">Total Debited</span>
              <span className="print-val text-xs font-semibold text-green-600">Rs. {totalDebited.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div>
              <span className="text-[9px] text-muted-foreground font-bold uppercase block">Total Credited</span>
              <span className="print-val text-xs font-semibold text-red-600">Rs. {totalCredited.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div>
              <span className="text-[9px] text-muted-foreground font-bold uppercase block">Ledger Balance</span>
              <span className="print-val text-xs font-bold text-foreground">Rs. {closingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {/* Entries Table */}
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-800">
              <th className="py-2.5 font-bold uppercase text-muted-foreground">Date</th>
              <th className="py-2.5 font-bold uppercase text-muted-foreground">Voucher No</th>
              <th className="py-2.5 font-bold uppercase text-muted-foreground">Description</th>
              <th className="py-2.5 text-right font-bold uppercase text-muted-foreground">Debit (+)</th>
              <th className="py-2.5 text-right font-bold uppercase text-muted-foreground">Credit (-)</th>
              <th className="py-2.5 text-right font-bold uppercase text-muted-foreground">Running Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filterMode === "range" && (
              <tr className="bg-muted/50">
                <td className="py-2.5 font-mono text-muted-foreground">{fromDate || "-"}</td>
                <td className="py-2.5 font-bold font-mono text-muted-foreground">SYS-OPB</td>
                <td className="py-2.5 text-muted-foreground font-medium">Opening Balance Brought Forward</td>
                <td className="py-2.5 text-right">-</td>
                <td className="py-2.5 text-right">-</td>
                <td className="py-2.5 text-right font-bold text-foreground">Rs. {openingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              </tr>
            )}
            {singleAccountData.entries.map(entry => (
              <tr key={entry.id}>
                <td className="py-2 font-mono text-muted-foreground">{entry.date}</td>
                <td className="py-2 font-bold font-mono text-foreground">{entry.voucherCode}</td>
                <td className="py-2 text-foreground">{entry.description}</td>
                <td className="py-2 text-right font-semibold text-green-600">{entry.debit > 0 ? `Rs. ${entry.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "-"}</td>
                <td className="py-2 text-right font-semibold text-red-600">{entry.credit > 0 ? `Rs. ${entry.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "-"}</td>
                <td className="py-2 text-right font-bold text-foreground">Rs. {entry.balanceAfter.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              </tr>
            ))}
            {singleAccountData.entries.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted-foreground italic">No entries found for this period.</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-12 mt-16 pt-8 border-t border-border text-center">
          <div>
            <div className="h-12 border-b border-dashed border-slate-300"></div>
            <span className="text-[10px] uppercase font-bold text-muted-foreground mt-2 block">Accountant's Signature</span>
          </div>
          <div>
            <div className="h-12 border-b border-dashed border-slate-300"></div>
            <span className="text-[10px] uppercase font-bold text-muted-foreground mt-2 block">Authorized Audit Sign-off</span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-[10px] text-muted-foreground flex justify-between border-t border-border pt-4 uppercase">
          <span>Zohaib Motors accounts System</span>
          <span>Generated on {new Date().toLocaleString()}</span>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Dynamic Printing Style Layer */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-content, #print-content * {
            visibility: visible;
          }
          #print-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .print-hide {
            display: none !important;
          }
          .print-brand-text {
            background: none !important;
            color: #B4232F !important;
            -webkit-text-fill-color: #B4232F !important;
          }
          .print-grid-summary {
            display: grid !important;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)) !important;
            gap: 16px !important;
          }
          .print-val {
            white-space: nowrap !important;
          }
        }
      `}</style>

      <div className="space-y-6">
        {/* Selection Bar */}
        <div className="flex flex-col md:flex-row gap-4 bg-muted p-4 border rounded-xl print-hide items-end">
          <div className="flex-1 space-y-1 w-full">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Wallet size={12} /> Select Account</label>
            <SearchSelector
              items={[{ id: "ALL", name: "All Accounts (Summary)", typeName: "Summary" }, ...accounts]}
              value={selectedAccountId}
              onChange={setSelectedAccountId}
              placeholder="Choose account to view ledger"
              searchPlaceholder="Search account..."
              getSearchFields={(acc) => [acc.name, acc.typeName]}
              itemKey={(acc) => acc.id}
              renderTrigger={(selected) =>
                selected ? (
                  <span>{selected.name} {selected.id !== "ALL" && <span className="text-muted-foreground text-xs ml-1">({selected.typeName})</span>}</span>
                ) : (
                  <span className="text-muted-foreground">Choose account to view ledger</span>
                )
              }
              renderItem={(acc) => (
                <div className="flex justify-between items-center w-full text-left">
                  <span className="font-medium text-foreground">{acc.name}</span>
                  {acc.id !== "ALL" && <span className="text-xs text-muted-foreground font-mono">({acc.typeName})</span>}
                </div>
              )}
            />
          </div>

          <div className="w-full md:w-[150px] space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">Filter Mode</label>
            <Select value={filterMode} onValueChange={(val: any) => setFilterMode(val)}>
              <SelectTrigger className="w-full bg-card">
                <SelectValue placeholder="Mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="whole">Whole History</SelectItem>
                <SelectItem value="range">Date Range</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filterMode === "range" && (
            <>
              <div className="w-full md:w-[150px] space-y-1">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Calendar size={12} /> From Date</label>
                <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="bg-card" />
              </div>
              <div className="w-full md:w-[150px] space-y-1">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Calendar size={12} /> To Date</label>
                <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="bg-card" />
              </div>
            </>
          )}

          <div className="w-full md:w-auto">
            <Button
              onClick={handlePrint}
              disabled={!selectedAccountId}
              className="bg-secondary hover:bg-secondary/90 text-white text-white shrink-0 gap-1.5 h-10 w-full"
            >
              <Printer size={16} /> Print Ledger
            </Button>
          </div>
        </div>

        {selectedAccountId ? (
          <div className="space-y-6 print-hide">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card className="border-l-4 border-l-slate-400">
                <CardContent className="p-6 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Opening Balance</p>
                    <h3 className="text-2xl font-black text-foreground mt-1">Rs. {(openingBalance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
                  </div>
                  <div className="bg-muted text-muted-foreground p-3 rounded-xl">
                    <Wallet size={24} />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-green-500">
                <CardContent className="p-6 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Debits (+)</p>
                    <h3 className="text-2xl font-black text-foreground mt-1">Rs. {(totalDebited ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
                  </div>
                  <div className="bg-green-50 text-green-600 p-3 rounded-xl">
                    <ArrowDownRight size={24} />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-red-500">
                <CardContent className="p-6 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Credits (-)</p>
                    <h3 className="text-2xl font-black text-foreground mt-1">Rs. {(totalCredited ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
                  </div>
                  <div className="bg-red-50 text-red-600 p-3 rounded-xl">
                    <ArrowUpRight size={24} />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-blue-500">
                <CardContent className="p-6 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Net balance</p>
                    <h3 className="text-2xl font-black text-foreground mt-1">Rs. {(closingBalance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
                  </div>
                  <div className="bg-muted text-primary p-3 rounded-xl">
                    <Wallet size={24} />
                  </div>
                </CardContent>
              </Card>
            </div>

            {selectedAccountId === "ALL" ? (
              /* All Accounts Table View */
              <Card className="overflow-hidden">
                <div className="bg-muted px-6 py-4 border-b">
                  <h3 className="font-bold text-foreground">All Accounts Ledger Summary (Trial Balance)</h3>
                  <p className="text-xs text-muted-foreground">
                    {filterMode === "whole" ? "Showing complete consolidated history" : `Showing entries from ${fromDate || "start"} to ${toDate || "end"}`}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted text-muted-foreground font-medium border-b text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-4">Account Name</th>
                        <th className="px-6 py-4">Account Type</th>
                        <th className="px-6 py-4 text-right">Opening Balance</th>
                        <th className="px-6 py-4 text-right">Total Debit (+)</th>
                        <th className="px-6 py-4 text-right">Total Credit (-)</th>
                        <th className="px-6 py-4 text-right">Net Balance</th>
                        <th className="px-6 py-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {allAccountsData.map(item => (
                        <tr key={item.account.id} className="hover:bg-muted transition-colors">
                          <td className="px-6 py-4 font-bold text-foreground">
                            {item.account.name}
                          </td>
                          <td className="px-6 py-4 text-muted-foreground">
                            {item.account.typeName}
                          </td>
                          <td className="px-6 py-4 text-right font-mono text-muted-foreground">
                            Rs. {item.openingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-6 py-4 text-right font-mono font-semibold text-green-600">
                            Rs. {item.totalDebited.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-6 py-4 text-right font-mono font-semibold text-red-600">
                            Rs. {item.totalCredited.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-6 py-4 text-right font-mono font-extrabold text-foreground">
                            Rs. {item.closingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => setSelectedAccountId(item.account.id)}
                              className="text-primary hover:text-primary gap-1"
                            >
                              Detail <ArrowRight size={14} />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : (
              /* Single Account Detailed Ledger Table */
              singleAccountData && (
                <Card className="overflow-hidden">
                  <div className="bg-muted px-6 py-4 border-b flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-foreground">Ledger Statement: {selectedAccount?.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {filterMode === "whole" ? "Showing complete historical log" : `Showing entries from ${fromDate || "start"} to ${toDate || "end"}`}
                      </p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-muted text-muted-foreground font-medium border-b text-xs uppercase tracking-wider">
                        <tr>
                          <th className="px-6 py-4">Date</th>
                          <th className="px-6 py-4">Voucher No</th>
                          <th className="px-6 py-4">Description</th>
                          <th className="px-6 py-4 text-right">Debit (+)</th>
                          <th className="px-6 py-4 text-right">Credit (-)</th>
                          <th className="px-6 py-4 text-right">Running Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filterMode === "range" && (
                          <tr className="bg-muted/50">
                            <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
                              {fromDate || "-"}
                            </td>
                            <td className="px-6 py-4 font-bold font-mono text-muted-foreground text-xs">
                              SYS-OPB
                            </td>
                            <td className="px-6 py-4 text-muted-foreground font-semibold italic">
                              Opening Balance Brought Forward
                            </td>
                            <td className="px-6 py-4 text-right text-muted-foreground">-</td>
                            <td className="px-6 py-4 text-right text-muted-foreground">-</td>
                            <td className="px-6 py-4 text-right font-extrabold text-foreground">
                              Rs. {openingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        )}
                        {singleAccountData.entries.map(entry => (
                          <tr key={entry.id} className="hover:bg-muted transition-colors">
                            <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
                              {entry.date}
                            </td>
                            <td className="px-6 py-4 font-bold font-mono text-foreground text-xs">
                              {entry.voucherCode}
                            </td>
                            <td className="px-6 py-4 text-muted-foreground">
                              {entry.description}
                            </td>
                            <td className="px-6 py-4 text-right font-semibold text-green-600">
                              {entry.debit > 0 ? `Rs. ${entry.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "-"}
                            </td>
                            <td className="px-6 py-4 text-right font-semibold text-red-600">
                              {entry.credit > 0 ? `Rs. ${entry.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "-"}
                            </td>
                            <td className="px-6 py-4 text-right font-bold text-foreground">
                              Rs. {entry.balanceAfter.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}

                        {singleAccountData.entries.length === 0 && (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-muted-foreground">
                              No ledger transactions found for this account.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 bg-muted border border-dashed rounded-xl text-muted-foreground print-hide">
            <BookOpen size={48} className="stroke-1 mb-3 text-muted-foreground" />
            <p className="font-semibold text-muted-foreground">Select an Account to Load General Ledger</p>
            <p className="text-xs text-muted-foreground mt-1">Audit and print full transaction logs for any account.</p>
          </div>
        )}
      </div>

      {/* Hidden print layout rendered when printing */}
      {selectedAccountId && (
        <div className="hidden print:block">
          <PrintableLedgerDoc />
        </div>
      )}
    </>
  );
};
