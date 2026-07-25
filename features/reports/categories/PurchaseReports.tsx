"use client";

import { useState, useEffect } from "react";
import { collection, query, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReportTable } from "@/components/shared/ReportTable";
import { Loader2 } from "lucide-react";

export const PurchaseReports = () => {
  const [loading, setLoading] = useState(false);
  const [activeReportId, setActiveReportId] = useState("purchase-register");
  
  // Data State
  const [invoices, setInvoices] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, "invoices"));
        const snapshot = await getDocs(q);
        const allInvoices = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
        setInvoices(allInvoices.filter(inv => inv.type === "PURCHASE"));
      } catch (error) {
        console.error("Failed to fetch purchase invoices", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const REPORTS = [
    { id: "purchase-register", name: "1. Purchase Register (All Purchases)" },
    { id: "purchases-by-supplier", name: "2. Purchases by Supplier/Vendor" },
    { id: "purchase-tax-summary", name: "3. Purchase Tax Summary" },
    { id: "monthly-purchases", name: "4. Monthly Purchase Summary" }
  ];

  const renderActiveReport = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center h-64 text-muted-foreground">
          <Loader2 className="animate-spin mr-2" size={24} />
          Compiling purchase data...
        </div>
      );
    }

    switch (activeReportId) {
      case "purchase-register": {
        const data = [...invoices].sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
        return (
          <ReportTable
            title="Purchase Register"
            description="Complete log of all vehicle purchases."
            data={data}
            columns={[
              { header: "Date", accessorKey: "createdAt", cell: (item) => item.createdAt?.toDate().toLocaleDateString() || "-" },
              { header: "Invoice #", accessorKey: "invoiceNumber" },
              { header: "Supplier", accessorKey: "clientName" },
              { header: "Vehicle", accessorKey: "carDetails", cell: (item) => item.carDetails ? `${item.carDetails.brandName} ${item.carDetails.model}` : "Unknown" },
              { header: "Total Amount", accessorKey: "totalAmount", cell: (item) => `PKR ${(item.totalAmount || 0).toLocaleString()}` },
              { header: "Status", accessorKey: "status" },
            ]}
          />
        );
      }
      
      case "purchases-by-supplier": {
        const supplierData: Record<string, { totalAmount: number; count: number }> = {};
        invoices.forEach(inv => {
          const supplier = inv.clientName || "Unknown Supplier";
          if (!supplierData[supplier]) supplierData[supplier] = { totalAmount: 0, count: 0 };
          supplierData[supplier].totalAmount += (inv.totalAmount || 0);
          supplierData[supplier].count += 1;
        });

        const data = Object.entries(supplierData).map(([supplier, stats]) => ({
          supplier,
          ...stats
        })).sort((a, b) => b.totalAmount - a.totalAmount);

        return (
          <ReportTable
            title="Purchases by Supplier"
            description="Total purchases grouped by vendor or individual seller."
            data={data}
            columns={[
              { header: "Supplier/Vendor", accessorKey: "supplier" },
              { header: "Number of Purchases", accessorKey: "count" },
              { header: "Total Value", accessorKey: "totalAmount", cell: (item) => `PKR ${item.totalAmount.toLocaleString()}` },
            ]}
          />
        );
      }

      case "purchase-tax-summary": {
        return (
          <ReportTable
            title="Purchase Tax Summary"
            description="Detailed breakdown of taxes applied on purchases."
            data={invoices}
            columns={[
              { header: "Invoice #", accessorKey: "invoiceNumber" },
              { header: "Supplier", accessorKey: "clientName" },
              { header: "Base Amount", accessorKey: "subtotal", cell: (item) => `PKR ${(item.subtotal || 0).toLocaleString()}` },
              { header: "Tax Amount", accessorKey: "taxAmount", cell: (item) => `PKR ${(item.taxAmount || 0).toLocaleString()}` },
              { header: "Total Amount", accessorKey: "totalAmount", cell: (item) => `PKR ${(item.totalAmount || 0).toLocaleString()}` },
            ]}
          />
        );
      }

      case "monthly-purchases": {
        const monthlyData: Record<string, { totalAmount: number; count: number }> = {};
        invoices.forEach(inv => {
          if (!inv.createdAt) return;
          const date = inv.createdAt.toDate();
          const monthYear = `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
          if (!monthlyData[monthYear]) monthlyData[monthYear] = { totalAmount: 0, count: 0 };
          monthlyData[monthYear].totalAmount += (inv.totalAmount || 0);
          monthlyData[monthYear].count += 1;
        });

        const data = Object.entries(monthlyData).map(([month, stats]) => ({
          month,
          ...stats
        }));

        return (
          <ReportTable
            title="Monthly Purchase Summary"
            description="Month-over-month purchase volume and value."
            data={data}
            columns={[
              { header: "Month", accessorKey: "month" },
              { header: "Total Vehicles Purchased", accessorKey: "count" },
              { header: "Total Value", accessorKey: "totalAmount", cell: (item) => `PKR ${item.totalAmount.toLocaleString()}` },
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
          <h2 className="text-xl font-bold text-foreground">Purchase & Acquisition Reports</h2>
          <p className="text-sm text-muted-foreground mt-1">Analytics for vehicle acquisitions and vendor payments.</p>
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
