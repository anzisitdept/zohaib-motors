"use client";
import { useState, useMemo, useEffect } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Loader2, Filter, RefreshCcw, LayoutGrid } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface InventoryReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicles: any[];
  currentFilters?: {
    docFilter: string;
    plateFilter: string;
    brandFilter: string;
    registrationFilter: string;
  };
}

export const InventoryReportModal = ({ isOpen, onClose, vehicles, currentFilters }: InventoryReportModalProps) => {
  // --- Dialog Filter States ---
  const [docFilter, setDocFilter] = useState("ALL");
  const [plateFilter, setPlateFilter] = useState("ALL");
  const [notAvailableReasonFilter, setNotAvailableReasonFilter] = useState("ALL");
  const [regReasonFilter, setRegReasonFilter] = useState("ALL");
  const [regStatusFilter, setRegStatusFilter] = useState("ALL");
  const [brandFilter, setBrandFilter] = useState("ALL");
  
  const [isGenerating, setIsGenerating] = useState(false);

  // --- Derived Data for Selects ---
  const uniqueBrands = useMemo(() => {
    const brands = new Set(vehicles.map(v => v.brandName).filter(Boolean));
    return Array.from(brands).sort();
  }, [vehicles]);

  const uniqueReasons = useMemo(() => {
    const reasons = new Set(vehicles.map(v => v.registrationReason).filter(Boolean));
    return Array.from(reasons).sort();
  }, [vehicles]);

  // --- Main Filtering Logic for the Report ---
  const filteredReportVehicles = useMemo(() => {
    return vehicles.filter(v => {
      // 1. Document Filter
      const matchesDoc =
        docFilter === "ALL" ||
        (docFilter === "NOT_APPLIED" && (v.fileStatus === "Not Applied" || (!v.fileStatus && v.docsApplied === false))) ||
        (docFilter === "SHOWROOM" && (v.fileStatus === "Showroom" || (!v.fileStatus && v.docsApplied === true))) ||
        (docFilter === "EXCISE" && v.fileStatus === "At Excise") ||
        (docFilter === "RETURNED" && v.fileStatus === "Returned Back to Showroom") ||
        (docFilter === "DELIVERED" && v.fileStatus?.toLowerCase().includes("delivered"));

      // 2. Plate Filter
      const matchesPlate = (() => {
        if (plateFilter === "ALL") return true;
        if (plateFilter === "NOT_AVAILABLE") {
          const isNotAvail = v.plateStatus === "Never Applied" || v.plateStatus === "Not Issued from Excise" || v.plateStatus === "At Party's Hand";
          if (!isNotAvail) return false;
          if (notAvailableReasonFilter === "ALL") return true;
          if (notAvailableReasonFilter === "NOT_ISSUED") return v.plateStatus === "Never Applied" || v.plateStatus === "Not Issued from Excise";
          if (notAvailableReasonFilter === "AT_PARTY") return v.plateStatus === "At Party's Hand";
          return true;
        }
        if (plateFilter === "SHOWROOM") return v.plateStatus === "Showroom";
        if (plateFilter === "DELIVERED") return v.plateStatus?.toLowerCase().includes("delivered");
        return false;
      })();

      // 3. Reg Status Filter
      const matchesRegStatus =
        regStatusFilter === "ALL" ||
        (regStatusFilter === "REGISTERED" && v.registrationNumber) ||
        (regStatusFilter === "UNREGISTERED" && !v.registrationNumber);

      // 4. Reg Reason Filter
      const matchesRegReason = regReasonFilter === "ALL" || v.registrationReason === regReasonFilter;

      // 5. Brand Filter
      const matchesBrand = brandFilter === "ALL" || v.brandName === brandFilter;

      return matchesDoc && matchesPlate && matchesRegStatus && matchesRegReason && matchesBrand;
    });
  }, [vehicles, docFilter, plateFilter, notAvailableReasonFilter, regStatusFilter, regReasonFilter, brandFilter]);

  const resetFilters = () => {
    setDocFilter("ALL");
    setPlateFilter("ALL");
    setNotAvailableReasonFilter("ALL");
    setRegReasonFilter("ALL");
    setRegStatusFilter("ALL");
    setBrandFilter("ALL");
  };

  const syncWithDashboard = () => {
    if (currentFilters) {
      setDocFilter(currentFilters.docFilter);
      setPlateFilter(currentFilters.plateFilter);
      setBrandFilter(currentFilters.brandFilter);
      setRegStatusFilter(currentFilters.registrationFilter);
    }
  };

  const handleDownloadPDF = async () => {
    if (filteredReportVehicles.length === 0) {
      alert("No vehicles match the selected criteria.");
      return;
    }

    setIsGenerating(true);
    try {
      const doc = new jsPDF("landscape");
      const pageWidth = doc.internal.pageSize.width;
      let yPos = 15;

      // 1. Logo
      try {
        const logoResp = await fetch('/carlogo.png');
        if (logoResp.ok) {
          const logoBlob = await logoResp.blob();
          const logoBase64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(logoBlob);
          });
          doc.addImage(logoBase64, 'PNG', 14, yPos, 40, 12);
        }
      } catch (e) {
        console.warn("Failed to load logo for PDF", e);
      }

      yPos += 20;

      // 2. Title & Subtitle (Left Aligned)
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text("INVENTORY REPORT", 14, yPos);
      
      yPos += 6;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text("Official Master Inventory Record", 14, yPos);

      // 3. Right Side Elements (Badge & Meta)
      // Badge background (Emerald 700)
      const badgeText = "SYSTEM REPORT";
      doc.setFillColor(4, 120, 87); // emerald-700
      doc.rect(pageWidth - 54, 15, 40, 8, "F");
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text(badgeText, pageWidth - 34, 20.5, { align: "center" });

      // Generation meta
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text("GENERATION DATE", pageWidth - 14, 30, { align: "right" });
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text(new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }), pageWidth - 14, 35, { align: "right" });
      
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text("TOTAL RECORDS", pageWidth - 14, 42, { align: "right" });
      
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text(filteredReportVehicles.length.toString(), pageWidth - 14, 47, { align: "right" });

      // Line Separator
      yPos += 8;
      doc.setDrawColor(15, 23, 42); // slate-900
      doc.setLineWidth(0.5);
      doc.line(14, yPos, pageWidth - 14, yPos);

      yPos += 10;

      // 4. Filters Section
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(71, 85, 105); // slate-600
      doc.text("APPLIED FILTERS", 14, yPos);
      
      yPos += 5;
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      
      const filterSummary = [
        docFilter !== "ALL" && `Docs: ${docFilter}`,
        plateFilter !== "ALL" && `Plates: ${plateFilter}${plateFilter === 'NOT_AVAILABLE' && notAvailableReasonFilter !== 'ALL' ? ` (${notAvailableReasonFilter.replace('_', ' ')})` : ''}`,
        regStatusFilter !== "ALL" && `Status: ${regStatusFilter}`,
        brandFilter !== "ALL" && `Brand: ${brandFilter}`,
        regReasonFilter !== "ALL" && `Reason: ${regReasonFilter}`
      ].filter(Boolean).join("    |    ") || "Full Inventory (No Filters Applied)";

      doc.text(filterSummary, 14, yPos);
      yPos += 10;

      // 5. Table Data
      const tableData = filteredReportVehicles.map(v => [
        `${v.brandName || ""} ${v.model || ""} ${v.variant || ""}`.trim() || "-",
        v.chassisNumber || "-",
        v.engineNumber || "-",
        v.registrationNumber || "Unregistered",
        v.registrationReason || "-",
        v.fileStatus || (v.docsApplied ? "Showroom" : "Not Applied"),
        v.plateStatus || "Not Available",
        v.ownerName || v.registeredOwnerName || "-"
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [["Vehicle Make & Model", "Chassis No", "Engine No", "Reg No", "Reg Reason", "Document Status", "Plate Status", "Current Client"]],
        body: tableData,
        theme: "grid",
        styles: {
          fontSize: 8,
          cellPadding: 4,
          textColor: [51, 65, 85], // slate-700
          lineColor: [226, 232, 240], // slate-200
          lineWidth: 0.1,
          font: "helvetica",
        },
        headStyles: {
          fillColor: [15, 23, 42], // slate-900
          textColor: [255, 255, 255],
          fontStyle: "bold",
          lineColor: [15, 23, 42],
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252], // slate-50
        },
        columnStyles: {
          0: { fontStyle: 'bold' },
        },
        margin: { top: 15, left: 14, right: 14 },
        didDrawPage: (data) => {
           // Footer on each page
           const pageHeight = doc.internal.pageSize.height;
           doc.setFontSize(8);
           doc.setFont("helvetica", "normal");
           doc.setTextColor(148, 163, 184); // slate-400
           
           doc.text("Zohaib Motors Tracking System", 14, pageHeight - 10);
           doc.text("Generated by Anzi & Co.", 14, pageHeight - 6);
           
           const str = "Page " + doc.getNumberOfPages();
           doc.text(str, pageWidth - 14, pageHeight - 10, { align: "right" });
        }
      });

      doc.save(`Inventory_Report_${new Date().toISOString().split('T')[0]}.pdf`);
      onClose();
    } catch (error) {
      console.error("PDF Generation Error:", error);
      alert("Failed to generate PDF. Check console for details.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden border-0 sm:rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-muted/50">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-secondary text-white rounded-xl shadow-lg shadow-blue-200">
              <FileText size={22} />
            </div>
            <div>
              <DialogTitle className="font-bold text-foreground text-lg">Inventory Report Center</DialogTitle>
              <p className="text-xs text-muted-foreground font-medium mt-1">Configure filters for your detailed PDF report</p>
            </div>
          </div>
        </div>

        {/* Sync Button Row */}
        {currentFilters && (
          <div className="px-6 py-2 bg-muted/50 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px] font-bold text-primary uppercase tracking-tight">
              <LayoutGrid size={14} />
              Quick Actions
            </div>
            <Button 
              variant="link" 
              size="sm" 
              className="h-7 text-xs font-bold text-primary hover:text-blue-900"
              onClick={syncWithDashboard}
            >
              Sync with current dashboard filters
            </Button>
          </div>
        )}

        {/* Filters Grid */}
        <div className="p-6 space-y-8 overflow-y-auto max-h-[60vh]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Document Status</label>
              <Select value={docFilter} onValueChange={setDocFilter}>
                <SelectTrigger className="w-full bg-muted border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[100]">
                  <SelectItem value="ALL">All Documents</SelectItem>
                  <SelectItem value="NOT_APPLIED">Not Applied</SelectItem>
                  <SelectItem value="SHOWROOM">Showroom</SelectItem>
                  <SelectItem value="EXCISE">At Excise</SelectItem>
                  <SelectItem value="RETURNED">Returned to Showroom</SelectItem>
                  <SelectItem value="DELIVERED">Delivered Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Plate Status</label>
                <Select value={plateFilter} onValueChange={setPlateFilter}>
                  <SelectTrigger className="w-full bg-muted border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[100]">
                    <SelectItem value="ALL">All Plates</SelectItem>
                    <SelectItem value="NOT_AVAILABLE">Not Available</SelectItem>
                    <SelectItem value="SHOWROOM">Showroom</SelectItem>
                    <SelectItem value="DELIVERED">Delivered Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {plateFilter === "NOT_AVAILABLE" && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Not Available Reason</label>
                  <Select value={notAvailableReasonFilter} onValueChange={setNotAvailableReasonFilter}>
                    <SelectTrigger className="w-full bg-muted border-blue-200 text-blue-900">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[100]">
                      <SelectItem value="ALL">All Reasons</SelectItem>
                      <SelectItem value="NOT_ISSUED">Not Issued / Never Applied</SelectItem>
                      <SelectItem value="AT_PARTY">At Party's Hand</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Registration Status</label>
              <Select value={regStatusFilter} onValueChange={setRegStatusFilter}>
                <SelectTrigger className="w-full bg-muted border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[100]">
                  <SelectItem value="ALL">All Registration</SelectItem>
                  <SelectItem value="REGISTERED">Registered</SelectItem>
                  <SelectItem value="UNREGISTERED">Unregistered</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Registration Reason</label>
              <Select value={regReasonFilter} onValueChange={setRegReasonFilter}>
                <SelectTrigger className="w-full bg-muted border-border">
                  <SelectValue placeholder="All Reasons" />
                </SelectTrigger>
                <SelectContent className="z-[100]">
                  <SelectItem value="ALL">All Reasons</SelectItem>
                  {uniqueReasons.map(reason => (
                    <SelectItem key={reason as string} value={reason as string}>{reason as string}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="pt-6 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="space-y-2">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Filter by Brand</label>
              <Select value={brandFilter} onValueChange={setBrandFilter}>
                <SelectTrigger className="w-full bg-muted border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[100]">
                  <SelectItem value="ALL">All Brands</SelectItem>
                  {uniqueBrands.map(b => (
                    <SelectItem key={b as string} value={b as string}>{b as string}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end flex-1">
               <Button 
                variant="outline" 
                className="w-full border-dashed border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 h-10"
                onClick={resetFilters}
               >
                 <RefreshCcw size={14} className="mr-2" />
                 Reset All Selections
               </Button>
            </div>
          </div>

          <div className="bg-slate-900 rounded-2xl p-5 text-white flex items-center justify-between shadow-xl">
             <div className="flex items-center gap-3">
               <div className="p-2 bg-card/10 rounded-lg">
                 <Filter size={18} className="text-blue-400" />
               </div>
               <div>
                 <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Matched Records</p>
                 <p className="text-xl font-bold">{filteredReportVehicles.length} Vehicles Found</p>
               </div>
             </div>
             <Badge variant="outline" className="border-white/20 text-white bg-card/5 px-3 py-1">
               {((filteredReportVehicles.length / (vehicles.length || 1)) * 100).toFixed(0)}% Coverage
             </Badge>
          </div>
        </div>

        <DialogFooter className="p-5 bg-muted border-t border-border flex justify-end gap-3 sm:justify-end">
          <Button variant="ghost" onClick={onClose} disabled={isGenerating} className="text-muted-foreground font-semibold">
            Cancel
          </Button>
          <Button
            onClick={handleDownloadPDF}
            className="bg-secondary hover:bg-secondary/90 text-white text-white min-w-[160px] h-11 rounded-xl shadow-lg shadow-blue-100 font-bold"
            disabled={isGenerating || filteredReportVehicles.length === 0}
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Generate PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
