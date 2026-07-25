"use client";

import { useState, useEffect } from "react";
import { collection, query, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReportTable } from "@/components/shared/ReportTable";
import { Loader2 } from "lucide-react";

export const FinanceReports = () => {
  const [loading, setLoading] = useState(false);
  const [activeReportId, setActiveReportId] = useState("chart-of-accounts");
  
  // Data State
  const [accounts, setAccounts] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, "accounts"));
        const snapshot = await getDocs(q);
        setAccounts(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any)));
      } catch (error) {
        console.error("Failed to fetch finance data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const REPORTS = [
    { id: "chart-of-accounts", name: "1. Chart of Accounts Status" },
    { id: "receivables", name: "2. Accounts Receivable Summary" },
    { id: "payables", name: "3. Accounts Payable Summary" },
    { id: "cash-flow", name: "4. Cash/Bank Balances" }
  ];

  const renderActiveReport = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center h-64 text-muted-foreground">
          <Loader2 className="animate-spin mr-2" size={24} />
          Compiling financial data...
        </div>
      );
    }

    switch (activeReportId) {
      case "chart-of-accounts": {
        return (
          <ReportTable
            title="Chart of Accounts Status"
            description="Overview of all registered ledgers and their current balances."
            data={accounts}
            columns={[
              { header: "Account Code", accessorKey: "code" },
              { header: "Account Name", accessorKey: "name" },
              { header: "Type", accessorKey: "typeName" },
              { header: "Category", accessorKey: "categoryName" },
              { header: "Current Balance", accessorKey: "balance", cell: (item) => `PKR ${(item.balance || 0).toLocaleString()}` },
            ]}
          />
        );
      }
      
      case "receivables": {
        const receivables = accounts.filter(a => a.categoryName === "Asset" && (a.typeName === "Client" || a.typeName === "Customer") && a.balance > 0);
        return (
          <ReportTable
            title="Accounts Receivable Summary"
            description="Pending amounts expected from clients and customers."
            data={receivables}
            columns={[
              { header: "Client / Customer", accessorKey: "name" },
              { header: "Contact", accessorKey: "contact", cell: (item) => item.contact || "-" },
              { header: "Receivable Amount", accessorKey: "balance", cell: (item) => `PKR ${(item.balance || 0).toLocaleString()}` },
            ]}
          />
        );
      }

      case "payables": {
        const payables = accounts.filter(a => a.categoryName === "Liability" && (a.balance < 0 || a.typeName === "Supplier" || a.typeName === "Vendor"));
        return (
          <ReportTable
            title="Accounts Payable Summary"
            description="Pending amounts owed to suppliers and vendors."
            data={payables}
            columns={[
              { header: "Supplier / Vendor", accessorKey: "name" },
              { header: "Contact", accessorKey: "contact", cell: (item) => item.contact || "-" },
              { header: "Payable Amount", accessorKey: "balance", cell: (item) => `PKR ${Math.abs(item.balance || 0).toLocaleString()}` },
            ]}
          />
        );
      }

      case "cash-flow": {
        const banks = accounts.filter(a => a.typeName === "Bank Account" || a.typeName === "Cash" || a.name.toLowerCase().includes("cash") || a.name.toLowerCase().includes("bank"));
        return (
          <ReportTable
            title="Cash & Bank Balances"
            description="Current liquid asset status across all registered banks and cash-in-hand accounts."
            data={banks}
            columns={[
              { header: "Account Name", accessorKey: "name" },
              { header: "Bank Name", accessorKey: "bankName", cell: (item) => item.bankName || "Cash" },
              { header: "Account No.", accessorKey: "accountNumber", cell: (item) => item.accountNumber || "-" },
              { header: "Current Balance", accessorKey: "balance", cell: (item) => `PKR ${(item.balance || 0).toLocaleString()}` },
            ]}
          />
        );
      }

      default:
        return <div className="p-8 text-center text-muted-foreground">Select a report from the dropdown above to view its contents. (More reports being added...)</div>;
    }
  };

  return (
    <div className="p-6 space-y-6 bg-muted/50 min-h-full">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-border pb-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Accounts & Finance Reports</h2>
          <p className="text-sm text-muted-foreground mt-1">Deep analytics on ledgers, payables, receivables, and cash flow.</p>
        </div>

        <div className="w-full sm:w-72">
          <Select value={activeReportId} onValueChange={setActiveReportId}>
            <SelectTrigger className="bg-card">
              <SelectValue placeholder="Select a report to generate" />
            </SelectTrigger>
            <SelectContent>
              {REPORTS.map(r => (
                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="animate-in fade-in duration-500">
        {renderActiveReport()}
      </div>
    </div>
  );
};
