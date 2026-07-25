"use client";

import { useState, useEffect } from "react";
import { collection, query, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReportTable } from "@/components/shared/ReportTable";
import { Loader2 } from "lucide-react";

export const TrackingReports = () => {
  const [loading, setLoading] = useState(false);
  const [activeReportId, setActiveReportId] = useState("file-status");
  
  // Data State
  const [cars, setCars] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, "cars"));
        const snapshot = await getDocs(q);
        setCars(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any)));
      } catch (error) {
        console.error("Failed to fetch tracking data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const REPORTS = [
    { id: "file-status", name: "1. Document/File Status Summary" },
    { id: "pending-registration", name: "2. Vehicles Pending Registration" },
    { id: "plates-status", name: "3. Number Plates Status Report" }
  ];

  const renderActiveReport = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center h-64 text-muted-foreground">
          <Loader2 className="animate-spin mr-2" size={24} />
          Compiling tracking data...
        </div>
      );
    }

    switch (activeReportId) {
      case "file-status": {
        const fileStatusCounts: Record<string, number> = {};
        cars.forEach(c => {
          const status = c.fileStatus || "Not Tracked";
          fileStatusCounts[status] = (fileStatusCounts[status] || 0) + 1;
        });

        const data = Object.entries(fileStatusCounts).map(([status, count]) => ({ status, count }));

        return (
          <ReportTable
            title="Document/File Status Summary"
            description="Overview of where vehicle registration files currently are."
            data={data}
            columns={[
              { header: "File Status", accessorKey: "status" },
              { header: "Number of Vehicles", accessorKey: "count" },
            ]}
          />
        );
      }
      
      case "pending-registration": {
        const pending = cars.filter(c => !c.registrationNumber || c.fileStatus === "At Excise");
        return (
          <ReportTable
            title="Vehicles Pending Registration"
            description="Vehicles that are waiting to be registered or whose files are at the excise office."
            data={pending}
            columns={[
              { header: "Vehicle", accessorKey: "brandName", cell: (item) => `${item.brandName} ${item.model}` },
              { header: "Chassis Number", accessorKey: "chassisNumber" },
              { header: "File Status", accessorKey: "fileStatus" },
              { header: "Status", accessorKey: "currentStatus" },
            ]}
          />
        );
      }

      case "plates-status": {
        const pendingPlates = cars.filter(c => c.plateStatus && c.plateStatus !== "Plates Delivered to Customer");
        return (
          <ReportTable
            title="Number Plates Status Report"
            description="Tracking number plates from printing to customer delivery."
            data={pendingPlates}
            columns={[
              { header: "Vehicle", accessorKey: "brandName", cell: (item) => `${item.brandName} ${item.model}` },
              { header: "Registration #", accessorKey: "registrationNumber", cell: (item) => item.registrationNumber || "Pending" },
              { header: "Plate Status", accessorKey: "plateStatus" },
              { header: "Customer Name", accessorKey: "ownerName", cell: (item) => item.ownerName || "Showroom" },
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
          <h2 className="text-xl font-bold text-foreground">File Tracking & Registration Reports</h2>
          <p className="text-sm text-muted-foreground mt-1">Analytics on excise, document status, and number plates.</p>
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
