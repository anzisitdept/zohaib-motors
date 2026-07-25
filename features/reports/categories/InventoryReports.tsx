"use client";

import { useState, useEffect } from "react";
import { collection, query, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportTable } from "@/components/shared/ReportTable";
import { Loader2 } from "lucide-react";

export const InventoryReports = () => {
  const [loading, setLoading] = useState(false);
  const [activeReportId, setActiveReportId] = useState("total-active-inventory");
  
  // Data State
  const [cars, setCars] = useState<any[]>([]);

  useEffect(() => {
    const fetchCars = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, "cars"));
        const snapshot = await getDocs(q);
        setCars(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any)));
      } catch (error) {
        console.error("Failed to fetch inventory for reports", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCars();
  }, []);

  const REPORTS = [
    { id: "total-active-inventory", name: "1. Total Active Inventory" },
    { id: "inventory-aging", name: "2. Inventory Aging Report" },
    { id: "inventory-valuation", name: "3. Inventory Valuation" },
    { id: "brand-model-distribution", name: "4. Brand & Model Distribution" },
    { id: "vehicle-source", name: "5. Vehicle Source (Local vs Imported)" }
  ];

  const renderActiveReport = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center h-64 text-muted-foreground">
          <Loader2 className="animate-spin mr-2" size={24} />
          Compiling data...
        </div>
      );
    }

    switch (activeReportId) {
      case "total-active-inventory": {
        const activeCars = cars.filter(c => c.currentStatus === "SHOWROOM");
        return (
          <ReportTable
            title="Total Active Inventory"
            description="Complete list of all vehicles currently available in the showroom."
            data={activeCars}
            columns={[
              { header: "Barcode", accessorKey: "barcode" },
              { header: "Brand", accessorKey: "brandName" },
              { header: "Model", accessorKey: "model" },
              { header: "Year", accessorKey: "year" },
              { header: "Chassis", accessorKey: "chassisNumber" },
              { header: "Color", accessorKey: "color" },
            ]}
          />
        );
      }
      
      case "inventory-aging": {
        const today = new Date().getTime();
        const agingData = cars
          .filter(c => c.currentStatus === "SHOWROOM" && c.createdAt)
          .map(c => {
            const ageDays = Math.floor((today - c.createdAt.toDate().getTime()) / (1000 * 60 * 60 * 24));
            let category = "0-30 Days";
            if (ageDays > 30 && ageDays <= 60) category = "31-60 Days";
            else if (ageDays > 60 && ageDays <= 90) category = "61-90 Days";
            else if (ageDays > 90) category = "90+ Days";
            return {
              ...c,
              ageDays,
              category
            };
          })
          .sort((a, b) => b.ageDays - a.ageDays);

        return (
          <ReportTable
            title="Inventory Aging Report"
            description="Vehicles in stock categorized by days in inventory."
            data={agingData}
            columns={[
              { header: "Vehicle", accessorKey: "brandName", cell: (item) => `${item.brandName} ${item.model}` },
              { header: "Chassis", accessorKey: "chassisNumber" },
              { header: "Age (Days)", accessorKey: "ageDays" },
              { header: "Aging Category", accessorKey: "category", cell: (item) => (
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    item.category === "90+ Days" ? "bg-red-100 text-red-700" :
                    item.category === "61-90 Days" ? "bg-orange-100 text-orange-700" :
                    "bg-green-100 text-green-700"
                  }`}>
                    {item.category}
                  </span>
                ) 
              },
            ]}
          />
        );
      }

      case "inventory-valuation": {
        const valuedCars = cars.filter(c => c.currentStatus === "SHOWROOM" && c.capitalizedCost > 0);
        return (
          <ReportTable
            title="Inventory Valuation Report"
            description="Total capitalized cost and value of available vehicles."
            data={valuedCars}
            columns={[
              { header: "Vehicle", accessorKey: "brandName", cell: (item) => `${item.brandName} ${item.model}` },
              { header: "Chassis", accessorKey: "chassisNumber" },
              { header: "Purchase Price", accessorKey: "purchasePrice", cell: (item) => `PKR ${(item.purchasePrice || 0).toLocaleString()}` },
              { header: "Expenses", accessorKey: "totalExpenses", cell: (item) => `PKR ${(item.totalExpenses || 0).toLocaleString()}` },
              { header: "Total Value (Capitalized)", accessorKey: "capitalizedCost", cell: (item) => `PKR ${(item.capitalizedCost || 0).toLocaleString()}` },
            ]}
          />
        );
      }

      case "brand-model-distribution": {
        const distribution: Record<string, number> = {};
        cars.forEach(c => {
          const key = `${c.brandName} ${c.model}`;
          distribution[key] = (distribution[key] || 0) + 1;
        });

        const data = Object.entries(distribution)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count);

        return (
          <ReportTable
            title="Brand & Model Distribution"
            description="Breakdown of stock count by make and model."
            data={data}
            columns={[
              { header: "Make & Model", accessorKey: "name" },
              { header: "Total Units in System", accessorKey: "count" },
            ]}
          />
        );
      }

      case "vehicle-source": {
        const sourceData: Record<string, number> = { "Local": 0, "Imported": 0, "Unknown": 0 };
        cars.forEach(c => {
          const source = c.vehicleSource || "Unknown";
          sourceData[source] = (sourceData[source] || 0) + 1;
        });

        const data = Object.entries(sourceData).map(([source, count]) => ({ source, count }));

        return (
          <ReportTable
            title="Vehicle Source (Local vs Imported)"
            description="Breakdown of vehicles by origin."
            data={data}
            columns={[
              { header: "Source Origin", accessorKey: "source" },
              { header: "Total Count", accessorKey: "count" },
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
          <h2 className="text-xl font-bold text-foreground">Inventory & Showroom Reports</h2>
          <p className="text-sm text-muted-foreground mt-1">Deep dive into physical stock and vehicle tracking.</p>
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
