"use client";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  CarFront, Calendar, Fuel, Settings2, ImageIcon, 
  ChevronRight, ArrowRight, Eye, Camera, ShieldCheck 
} from "lucide-react";
import { cn } from "@/lib/utils";

interface WebsiteVehicleCardProps {
  vehicle: any;
  onOpenDetails: (vehicle: any) => void;
}

export const WebsiteVehicleCard = ({ vehicle, onOpenDetails }: WebsiteVehicleCardProps) => {
  const assets = vehicle.images || vehicle.assets || [];
  const brandName = vehicle.make || vehicle.brandName || "Unknown Brand";
  const modelName = vehicle.model || "Unknown Model";
  const registrationNo = vehicle.registrationNo || vehicle.registrationNumber || "Unregistered";
  const modelYear = vehicle.year || vehicle.modelYear || "N/A";
  const chassisNo = vehicle.chassisNo || vehicle.chassisNumber || "N/A";
  const engineNo = vehicle.engineNo || vehicle.engineNumber || "N/A";

  // Color mappings based on color name
  const colorBubbleStyle = useMemo(() => {
    const colName = (vehicle.color || "").toLowerCase();
    
    // Check common colors
    if (colName.includes("white")) return "bg-card border-slate-300";
    if (colName.includes("black")) return "bg-slate-900 border-slate-900";
    if (colName.includes("silver") || colName.includes("gray") || colName.includes("grey")) return "bg-slate-300 border-slate-400";
    if (colName.includes("red")) return "bg-red-500 border-red-600";
    if (colName.includes("blue")) return "bg-muted0 border-blue-600";
    if (colName.includes("bronze") || colName.includes("brown") || colName.includes("gold")) return "bg-amber-600 border-amber-700";
    
    // Fallback based on text color hex if present, or generic white
    return "bg-muted border-slate-300";
  }, [vehicle.color]);

  return (
    <div className="relative group/card h-full">
      {/* Background glow animation */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-500 rounded-2xl opacity-0 group-hover/card:opacity-100 transition duration-500 blur-sm z-0"></div>
      
      {/* Card Content container */}
      <div className="relative h-full flex flex-col bg-card border border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 z-10 flex flex-col">
        
        {/* Card Header (Image Preview & Brand info) */}
        <div className="relative aspect-[16/10] bg-slate-950 overflow-hidden shrink-0">
          {assets.length > 0 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img 
              src={assets[0]} 
              alt={`${brandName} ${modelName}`} 
              className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-500" 
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-indigo-950 text-muted-foreground space-y-2.5">
              <div className="p-3 bg-slate-800/80 rounded-full text-muted-foreground border border-slate-700/50">
                <CarFront size={28} />
              </div>
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">No Image Uploaded</span>
            </div>
          )}

          {/* Overlay tags */}
          <div className="absolute top-3 left-3 right-3 flex justify-between items-center z-10">
            <Badge className="bg-slate-900/90 text-white border-0 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md tracking-wider backdrop-blur-sm">
              {vehicle.registrationReason || vehicle.type || "Purchase"}
            </Badge>

            {assets.length > 0 && (
              <Badge className="bg-secondary/90 text-white border-0 text-[10px] font-extrabold px-2 py-0.5 rounded-md tracking-wider flex items-center gap-1 backdrop-blur-sm">
                <ImageIcon size={10} />
                {assets.length} {assets.length === 1 ? 'Photo' : 'Photos'}
              </Badge>
            )}
          </div>

          {/* Hover Overlay Button to Open Details directly */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 flex items-center justify-center z-20">
            <Button
              onClick={() => onOpenDetails(vehicle)}
              className="gap-2 bg-card text-foreground hover:bg-muted font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg border-0 transform translate-y-2 group-hover/card:translate-y-0 transition-all duration-300 active:scale-95"
            >
              <Camera size={14} className="text-primary animate-pulse" />
              Manage Pictures & Info
            </Button>
          </div>
        </div>

        {/* Brand & Identity Segment */}
        <div className="p-4 border-b border-border bg-muted/50 flex-1">
          <div className="flex justify-between items-start mb-1">
            <h3 className="text-base font-extrabold text-foreground tracking-tight leading-tight">
              {brandName} <span className="font-normal text-muted-foreground">{modelName}</span>
            </h3>
            
            {registrationNo && (
              <span className="text-[11px] font-bold text-foreground bg-card border border-border px-1.5 py-0.5 rounded-md shadow-sm">
                {registrationNo}
              </span>
            )}
          </div>
          
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest leading-none">
            {vehicle.variant || "Standard Edition"}
          </p>
        </div>

        {/* Specifications Grid */}
        <div className="grid grid-cols-2 divide-x divide-slate-100 border-b border-border shrink-0">
          <div className="p-3 space-y-2">
            <div className="flex items-center justify-between text-xs leading-none">
              <span className="text-muted-foreground flex items-center gap-1.5"><Calendar size={12} /> Model Year</span>
              <span className="text-foreground font-bold font-mono">{modelYear}</span>
            </div>
            <div className="flex items-center justify-between text-xs leading-none">
              <span className="text-muted-foreground flex items-center gap-1.5"><Fuel size={12} /> Fuel Type</span>
              <span className="text-foreground font-bold">{vehicle.fuelType || "N/A"}</span>
            </div>
          </div>
          <div className="p-3 space-y-2">
            <div className="flex items-center justify-between text-xs leading-none">
              <span className="text-muted-foreground flex items-center gap-1.5"><Settings2 size={12} /> Trans</span>
              <span className="text-foreground font-bold truncate max-w-[50px]">{vehicle.transmission || "N/A"}</span>
            </div>
            <div className="flex items-center justify-between text-xs leading-none">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <span className={cn("w-2.5 h-2.5 rounded-full border shadow-sm shrink-0 inline-block", colorBubbleStyle)} /> 
                Color
              </span>
              <span className="text-foreground font-bold truncate max-w-[60px]" title={vehicle.color}>{vehicle.color || "N/A"}</span>
            </div>
          </div>
        </div>

        {/* Chassis & Technical details box */}
        <div className="p-3 px-4 shrink-0 bg-muted/20">
          <div className="bg-muted border border-slate-150 rounded-lg p-2 font-mono text-[10px] space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground font-bold">CHASSIS:</span>
              <span className="text-foreground font-bold truncate max-w-[150px]">{chassisNo}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-1 mt-1">
              <span className="text-muted-foreground font-bold">ENGINE:</span>
              <span className="text-foreground font-bold truncate max-w-[150px]">{engineNo}</span>
            </div>
            {vehicle.ownerName && (
              <div className="flex justify-between border-t border-border pt-1 mt-1">
                <span className="text-muted-foreground font-bold">POSSESSION:</span>
                <span className="text-foreground font-bold truncate max-w-[130px]">{vehicle.ownerName}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="mt-auto p-3.5 pt-2 border-t border-border bg-card flex justify-between items-center shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            <ShieldCheck size={14} className="text-emerald-500" />
            Active
          </div>

          <Button 
            onClick={() => onOpenDetails(vehicle)}
            variant="ghost" 
            size="sm"
            className="h-8 text-xs font-bold text-primary hover:text-primary hover:bg-muted/80 rounded-xl px-3 transition-colors flex items-center gap-1.5 border border-border"
          >
            <span>View & Upload</span>
            <Eye size={13} className="shrink-0" />
          </Button>
        </div>

      </div>
    </div>
  );
};
