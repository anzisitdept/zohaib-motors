"use client";

import { useState, useEffect } from "react";
import { collection, query, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReportTable } from "@/components/shared/ReportTable";
import { Loader2 } from "lucide-react";

export const ClientsReports = () => {
  const [loading, setLoading] = useState(false);
  const [activeReportId, setActiveReportId] = useState("client-registry");
  
  // Data State
  const [clients, setClients] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, "accounts"));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
        // Filter to only clients/customers and suppliers
        setClients(data.filter(a => ["Client", "Customer", "Supplier", "Vendor", "Investor"].includes(a.typeName || "")));
      } catch (error) {
        console.error("Failed to fetch clients data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const REPORTS = [
    { id: "client-registry", name: "1. Master Client Registry" },
    { id: "investor-portfolio", name: "2. Investor Portfolio Summary" },
  ];

  const renderActiveReport = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center h-64 text-muted-foreground">
          <Loader2 className="animate-spin mr-2" size={24} />
          Compiling client data...
        </div>
      );
    }

    switch (activeReportId) {
      case "client-registry": {
        const standardClients = clients.filter(c => ["Client", "Customer", "Supplier", "Vendor"].includes(c.typeName));
        return (
          <ReportTable
            title="Master Client Registry"
            description="Complete database of all registered clients, customers, and suppliers."
            data={standardClients}
            columns={[
              { header: "Name", accessorKey: "name" },
              { header: "Type", accessorKey: "typeName" },
              { header: "Contact", accessorKey: "contact", cell: (item) => item.contact || "-" },
              { header: "Email", accessorKey: "email", cell: (item) => item.email || "-" },
              { header: "Current Balance", accessorKey: "balance", cell: (item) => `PKR ${(item.balance || 0).toLocaleString()}` },
            ]}
          />
        );
      }
      
      case "investor-portfolio": {
        const investors = clients.filter(c => c.typeName === "Investor");
        return (
          <ReportTable
            title="Investor Portfolio Summary"
            description="Overview of registered investors and their standing capital/balances."
            data={investors}
            columns={[
              { header: "Investor Name", accessorKey: "name" },
              { header: "Contact", accessorKey: "contact", cell: (item) => item.contact || "-" },
              { header: "Current Capital/Balance", accessorKey: "balance", cell: (item) => `PKR ${(item.balance || 0).toLocaleString()}` },
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
          <h2 className="text-xl font-bold text-foreground">Clients & Investors Reports</h2>
          <p className="text-sm text-muted-foreground mt-1">Analytics on customer demographics and investor capital.</p>
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
