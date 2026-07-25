"use client";

import { useState, useEffect } from "react";
import { collection, query, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReportTable } from "@/components/shared/ReportTable";
import { Loader2 } from "lucide-react";

export const SalesReports = () => {
  const [loading, setLoading] = useState(false);
  const [activeReportId, setActiveReportId] = useState("sales-register");
  
  // Data State
  const [invoices, setInvoices] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, "invoices"));
        const snapshot = await getDocs(q);
        const allInvoices = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
        setInvoices(allInvoices.filter(inv => inv.type === "SALE"));
      } catch (error) {
        console.error("Failed to fetch sales invoices", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const REPORTS = [
    { id: "sales-register", name: "1. Sales Register (All Sales)" },
    { id: "sales-by-client", name: "2. Sales by Client/Customer" },
    { id: "monthly-sales", name: "3. Monthly Sales Summary" },
    { id: "sales-tax-summary", name: "4. Sales Tax Summary" }
  ];

  const renderActiveReport = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center h-64 text-muted-foreground">
          <Loader2 className="animate-spin mr-2" size={24} />
          Compiling sales data...
        </div>
      );
    }

    switch (activeReportId) {
      case "sales-register": {
        const data = [...invoices].sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
        return (
          <ReportTable
            title="Sales Register"
            description="Complete log of all vehicle sales."
            data={data}
            columns={[
              { header: "Date", accessorKey: "createdAt", cell: (item) => item.createdAt?.toDate().toLocaleDateString() || "-" },
              { header: "Invoice #", accessorKey: "invoiceNumber" },
              { header: "Customer", accessorKey: "clientName" },
              { header: "Vehicle", accessorKey: "carDetails", cell: (item) => item.carDetails ? `${item.carDetails.brandName} ${item.carDetails.model}` : "Unknown" },
              { header: "Total Amount", accessorKey: "totalAmount", cell: (item) => `PKR ${(item.totalAmount || 0).toLocaleString()}` },
              { header: "Status", accessorKey: "status" },
            ]}
          />
        );
      }
      
      case "sales-by-client": {
        const clientData: Record<string, { totalAmount: number; count: number }> = {};
        invoices.forEach(inv => {
          const client = inv.clientName || "Unknown Customer";
          if (!clientData[client]) clientData[client] = { totalAmount: 0, count: 0 };
          clientData[client].totalAmount += (inv.totalAmount || 0);
          clientData[client].count += 1;
        });

        const data = Object.entries(clientData).map(([client, stats]) => ({
          client,
          ...stats
        })).sort((a, b) => b.totalAmount - a.totalAmount);

        return (
          <ReportTable
            title="Sales by Customer"
            description="Total sales volume and value grouped by client."
            data={data}
            columns={[
              { header: "Customer", accessorKey: "client" },
              { header: "Number of Vehicles", accessorKey: "count" },
              { header: "Total Sales Value", accessorKey: "totalAmount", cell: (item) => `PKR ${item.totalAmount.toLocaleString()}` },
            ]}
          />
        );
      }

      case "monthly-sales": {
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
            title="Monthly Sales Summary"
            description="Month-over-month sales performance."
            data={data}
            columns={[
              { header: "Month", accessorKey: "month" },
              { header: "Total Vehicles Sold", accessorKey: "count" },
              { header: "Total Revenue", accessorKey: "totalAmount", cell: (item) => `PKR ${item.totalAmount.toLocaleString()}` },
            ]}
          />
        );
      }

      case "sales-tax-summary": {
        return (
          <ReportTable
            title="Sales Tax Summary"
            description="Detailed breakdown of taxes collected on sales."
            data={invoices}
            columns={[
              { header: "Invoice #", accessorKey: "invoiceNumber" },
              { header: "Customer", accessorKey: "clientName" },
              { header: "Base Amount", accessorKey: "subtotal", cell: (item) => `PKR ${(item.subtotal || 0).toLocaleString()}` },
              { header: "Tax Collected", accessorKey: "taxAmount", cell: (item) => `PKR ${(item.taxAmount || 0).toLocaleString()}` },
              { header: "Total Amount", accessorKey: "totalAmount", cell: (item) => `PKR ${(item.totalAmount || 0).toLocaleString()}` },
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
          <h2 className="text-xl font-bold text-foreground">Sales & Revenue Reports</h2>
          <p className="text-sm text-muted-foreground mt-1">Analytics for vehicle sales, revenue, and customer activity.</p>
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
