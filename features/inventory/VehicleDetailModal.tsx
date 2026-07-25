"use client";
import { useState, useEffect } from "react";
import { X, Printer, Car, Calendar, Gauge, Fuel, Settings2, FileText, User, Hash, MapPin, Phone, CreditCard } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { formatDate } from "@/lib/dateUtils";

interface VehicleDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicle: any;
}

export const VehicleDetailModal = ({ isOpen, onClose, vehicle }: VehicleDetailModalProps) => {
  const [currentOwner, setCurrentOwner] = useState<any>(null);
  const [regOwner, setRegOwner] = useState<any>(null);

  // Fetch full client details when modal opens
  useEffect(() => {
    if (!vehicle) return;

    const fetchClients = async () => {
      // 1. Fetch Possession Owner
      if (vehicle.ownerId) {
        try {
          const snap = await getDoc(doc(db, "clients", vehicle.ownerId));
          if (snap.exists()) setCurrentOwner(snap.data());
        } catch (e) { console.error(e); }
      } else {
        setCurrentOwner(null);
      }

      // 2. Fetch Registered Owner
      if (vehicle.registeredOwnerId) {
        try {
          const snapRq = await getDoc(doc(db, "clients", vehicle.registeredOwnerId));
          if (snapRq.exists()) setRegOwner(snapRq.data());
        } catch (e) { console.error(e); }
      } else {
        setRegOwner(null);
      }
    };

    fetchClients();
  }, [vehicle]);

  if (!isOpen || !vehicle) return null;

  const handlePrint = () => {
    window.print();
  };

  const DetailRow = ({ label, value, icon: Icon }: { label: string, value: string | number | undefined, icon?: any }) => (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <div className="flex items-center gap-2 text-muted-foreground">
        {Icon && <Icon size={14} />}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <span className="text-sm font-semibold text-foreground text-right">{value || "N/A"}</span>
    </div>
  );

  // Check availability
  const hasCurrentOwner = Boolean(currentOwner || vehicle.ownerName);
  const hasRegOwner = Boolean(regOwner || vehicle.registeredOwnerName);
  const hasAnyOwner = hasCurrentOwner || hasRegOwner;

  const VehicleDocument = () => (
    <div id="print-content" className="bg-card p-8 md:p-12 max-w-4xl mx-auto text-foreground font-sans relative">
      
      {/* --- Header --- */}
      <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-8">
        <div className="flex flex-col">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <div className="mb-3 -ml-1"><h2 className="text-3xl font-black tracking-tighter text-[#B4232F] uppercase leading-none print:text-[#B4232F]">ZOHAIB MOTORS</h2><div className="h-1 w-12 bg-[#1C1F26] mt-1 rounded-full opacity-80 print:bg-black"></div></div>
            <h1 className="text-3xl font-bold uppercase tracking-tight text-foreground">Vehicle Information Sheet</h1>
            <p className="text-sm text-muted-foreground font-medium mt-1">Official Inventory Record</p>
        </div>
        <div className="text-right space-y-1">
           <div className="bg-slate-900 text-white px-4 py-1.5 text-sm font-bold tracking-widest inline-block mb-2">
             {vehicle.currentStatus || "INVENTORY"}
           </div>
           <p className="text-xs text-muted-foreground uppercase font-bold">System ID</p>
           <p className="text-sm font-mono">{vehicle.id.slice(0, 8).toUpperCase()}</p>
           <p className="text-xs text-muted-foreground uppercase font-bold mt-2">Date Printed</p>
           <p className="text-sm font-mono">{formatDate(new Date().toISOString())}</p>
        </div>
      </div>

      {/* --- Main Vehicle Identity --- */}
      <div className="bg-muted p-6 rounded-lg border border-border mb-8 print:border-slate-300">
        <div className="grid grid-cols-2 gap-8">
            <div>
                <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Make & Model</p>
                <h2 className="text-2xl font-bold text-foreground">{vehicle.brandName} {vehicle.model}</h2>
                <p className="text-lg text-muted-foreground">{vehicle.variant}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Registration No.</p>
                    <div className="font-mono text-lg font-bold bg-card border border-border px-3 py-1 inline-block rounded">
                        {vehicle.registrationNumber || "UNREGISTERED"}
                    </div>
                    {vehicle.oldRegistrationNumber && (
                        <div className="mt-1 flex items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold">Old Reg No:</span>
                            <span className="font-mono text-xs font-semibold bg-muted border border-border px-1.5 py-0.5 rounded inline-block">
                                {vehicle.oldRegistrationNumber}
                            </span>
                        </div>
                    )}
                </div>
                <div>
                    <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Model Year</p>
                    <p className="text-lg font-bold">{vehicle.modelYear}</p>
                </div>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-12 mb-8">
        {/* --- Technical Specs --- */}
        <div>
            <h3 className="text-sm font-bold uppercase text-foreground mb-4 border-b border-border pb-2 flex items-center gap-2">
                <Settings2 size={16} /> Technical Specifications
            </h3>
            <div className="space-y-1">
                <DetailRow label="Chassis Number" value={vehicle.chassisNumber} icon={Hash} />
                <DetailRow label="Engine Number" value={vehicle.engineNumber} icon={Hash} />
                <DetailRow label="Body Type" value={vehicle.bodyType} icon={Car} />
                <DetailRow label="Exterior Color" value={vehicle.color} icon={Car} />
                <DetailRow label="Transmission" value={vehicle.transmission} icon={Settings2} />
                <DetailRow label="Fuel Type" value={vehicle.fuelType} icon={Fuel} />
                <DetailRow label="Mileage" value={`${vehicle.mileage?.toLocaleString()} km`} icon={Gauge} />
                <DetailRow label="Manufacturing Year" value={vehicle.year} icon={Calendar} />
            </div>
        </div>

        {/* --- Status --- */}
        <div>
            <h3 className="text-sm font-bold uppercase text-foreground mb-4 border-b border-border pb-2 flex items-center gap-2">
                <FileText size={16} /> Status & Documentation
            </h3>
            <div className="space-y-1">
                <DetailRow label="File Status" value={vehicle.fileStatus} />
                <DetailRow label="Plate Status" value={vehicle.plateStatus} />
                {vehicle.oldRegistrationNumber && <DetailRow label="Old Registration No." value={vehicle.oldRegistrationNumber} />}
                <DetailRow label="CPLC Counter" value={vehicle.cplcCounter} />
                <DetailRow label="Registered Year" value={vehicle.registrationYear} />
            </div>
        </div>
      </div>

      {/* --- Full Ownership Details (Conditional) --- */}
      {hasAnyOwner && (
        <div className="mb-8">
            <h3 className="text-sm font-bold uppercase text-foreground mb-4 border-b border-border pb-2 flex items-center gap-2">
                <User size={16} /> Ownership & Possession
            </h3>
            
            <div className={`grid gap-8 ${hasCurrentOwner && hasRegOwner ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {/* Current Owner */}
                {hasCurrentOwner && (
                    <div className="p-4 border border-border rounded-lg">
                        <p className="text-xs font-bold text-muted-foreground uppercase mb-3">Current Possession</p>
                        <div className="space-y-2">
                            <DetailRow label="Name" value={currentOwner?.name || vehicle.ownerName} icon={User} />
                            <DetailRow label="Phone" value={currentOwner?.phone || vehicle.ownerContact} icon={Phone} />
                            <DetailRow label="CNIC / ID" value={currentOwner?.cnic} icon={CreditCard} />
                            <DetailRow label="Address" value={currentOwner?.address} icon={MapPin} />
                        </div>
                    </div>
                )}

                {/* Registered Owner */}
                {hasRegOwner && (
                    <div className="p-4 border border-border rounded-lg">
                        <p className="text-xs font-bold text-muted-foreground uppercase mb-3">Book / Registered Owner</p>
                        <div className="space-y-2">
                            <DetailRow label="Name" value={regOwner?.name || vehicle.registeredOwnerName} icon={User} />
                            <DetailRow label="Phone" value={regOwner?.phone || vehicle.registeredOwnerContact} icon={Phone} />
                            <DetailRow label="CNIC / ID" value={regOwner?.cnic} icon={CreditCard} />
                            <DetailRow label="Address" value={regOwner?.address} icon={MapPin} />
                        </div>
                    </div>
                )}
            </div>
        </div>
      )}

      {/* --- Footer --- */}
      <div className="mt-12 pt-6 border-t border-border flex justify-between items-end text-[10px] text-muted-foreground uppercase tracking-wider">
        <div>
            <p>Zohaib Motors Tracking System</p>
            <p>Generated by Anzi & Co.</p>
        </div>
        <div className="text-right">
            <p>Barcode Reference</p>
            <p className="font-mono text-xs text-foreground">{vehicle.barcode || vehicle.chassisNumber}</p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 15mm; }
          body * {
            visibility: hidden;
          }
          #print-content, #print-content * {
            visibility: visible;
            color: #0A0F28 !important; /* Force all text to dark color */
          }
          #print-content .text-[#B4232F] {
            color: #B4232F !important; /* Keep brand crimson */
          }
          #print-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background-color: white !important;
          }
          /* Solid borders for print */
          #print-content .border-b,
          #print-content .border-t,
          #print-content .border-border,
          #print-content .border-slate-900 {
            border-color: #0A0F28 !important;
          }
          .print-hide {
            display: none !important;
          }
        }
      `}</style>

      {/* Screen Preview Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200 print-hide">
        <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col shadow-xl bg-card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border bg-muted">
            <div className="flex items-center gap-2">
              <Printer className="text-muted-foreground" size={20} />
              <h3 className="font-semibold text-foreground">Print Preview</h3>
            </div>
            <div className="flex gap-2">
                <Button onClick={handlePrint} className="gap-2 bg-secondary hover:bg-secondary/90 text-white text-white">
                    <Printer size={16} /> Print Sheet
                </Button>
                <Button variant="ghost" size="icon" onClick={onClose}>
                    <X size={18} />
                </Button>
            </div>
          </div>
          
          <div className="flex flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto bg-muted p-4 md:p-8">
                <div className="shadow-2xl shadow-slate-200 rounded-xl overflow-hidden ring-1 ring-slate-200 bg-card">
                    <VehicleDocument />
                </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Print Layer */}
      <div className="hidden print:block">
        <VehicleDocument />
      </div>
    </>
  );
};