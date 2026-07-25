import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Printer, Car, Calendar, Gauge, Fuel, Settings2, FileText, User, Hash, MapPin, Phone, CreditCard, PenTool } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { formatDate } from "@/lib/dateUtils";

interface VehicleDeliveryModalProps {
    isOpen: boolean;
    onClose: () => void;
    vehicle: any;
}

export const VehicleDeliveryModal = ({ isOpen, onClose, vehicle }: VehicleDeliveryModalProps) => {
    const [currentOwner, setCurrentOwner] = useState<any>(null);
    const [regOwner, setRegOwner] = useState<any>(null);
    const [deliveryRecipient, setDeliveryRecipient] = useState<any>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!vehicle) return;

        const fetchClients = async () => {
            if (vehicle.ownerId) {
                try {
                    const snap = await getDoc(doc(db, "clients", vehicle.ownerId));
                    if (snap.exists()) setCurrentOwner(snap.data());
                } catch (e) { console.error(e); }
            } else {
                setCurrentOwner(null);
            }

            if (vehicle.registeredOwnerId) {
                try {
                    const snapRq = await getDoc(doc(db, "clients", vehicle.registeredOwnerId));
                    if (snapRq.exists()) setRegOwner(snapRq.data());
                } catch (e) { console.error(e); }
            } else {
                setRegOwner(null);
            }

            // 3. Fetch Delivery Recipient
            if (vehicle.docDeliveredToClientId) {
                try {
                    const snapDr = await getDoc(doc(db, "clients", vehicle.docDeliveredToClientId));
                    if (snapDr.exists()) setDeliveryRecipient(snapDr.data());
                } catch (e) { console.error(e); }
            } else {
                setDeliveryRecipient(null);
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

    const DeliveryDocument = () => (
        <div className="bg-card p-8 md:p-12 max-w-4xl mx-auto text-foreground font-sans relative">

            {/* --- Header --- */}
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-8">
                <div className="flex flex-col">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <div className="mb-3 -ml-1"><h2 className="text-3xl font-black tracking-tighter bg-gradient-to-r from-[#E5484D] to-[#8a1c20] bg-clip-text text-transparent uppercase drop-shadow-sm leading-none">ZOHAIB MOTORS</h2><div className="h-1 w-12 bg-[#1C1F26] mt-1 rounded-full opacity-80"></div></div>
                    <h1 className="text-3xl font-bold uppercase tracking-tight text-foreground">Vehicle Delivery Note</h1>
                    <p className="text-sm text-muted-foreground font-medium mt-1">Official Handover Document</p>
                </div>
                <div className="text-right space-y-1">
                    <div className="bg-emerald-700 text-white px-4 py-1.5 text-sm font-bold tracking-widest inline-block mb-2">
                        DELIVERED
                    </div>
                    <p className="text-xs text-muted-foreground uppercase font-bold">System ID</p>
                    <p className="text-sm font-mono">{vehicle.id.slice(0, 8).toUpperCase()}</p>
                    <p className="text-xs text-muted-foreground uppercase font-bold mt-2">Delivery Date</p>
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
                                <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                                    <span className="font-bold uppercase text-[9px] text-muted-foreground">Old Reg:</span>
                                    <span className="font-mono font-semibold">{vehicle.oldRegistrationNumber}</span>
                                </div>
                            )}
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Chassis No.</p>
                            <p className="text-lg font-mono font-bold">{vehicle.chassisNumber}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-12 mb-8">
                {/* --- Key Specs --- */}
                <div>
                    <h3 className="text-sm font-bold uppercase text-foreground mb-4 border-b border-border pb-2 flex items-center gap-2">
                        <Settings2 size={16} /> Vehicle Details
                    </h3>
                    <div className="space-y-1">
                        <DetailRow label="Engine Number" value={vehicle.engineNumber} icon={Hash} />
                        <DetailRow label="Exterior Color" value={vehicle.color} icon={Car} />
                        <DetailRow label="Model Year" value={vehicle.modelYear} icon={Calendar} />
                        <DetailRow label="Mileage" value={`${vehicle.mileage?.toLocaleString() || 0} km`} icon={Gauge} />
                    </div>
                </div>

                {/* --- Recipient Details (Who it was delivered to) --- */}
                <div>
                    <h3 className="text-sm font-bold uppercase text-foreground mb-4 border-b border-border pb-2 flex items-center gap-2">
                        <User size={16} /> Delivered To
                    </h3>
                    <div className="space-y-1">
                        <DetailRow label="Recipient Name" value={deliveryRecipient?.name || vehicle.docDeliveredToName || vehicle.ownerName} />
                        <DetailRow label="Phone" value={deliveryRecipient?.phone || vehicle.docDeliveredToContact || vehicle.ownerContact} icon={Phone} />
                        <DetailRow label="CNIC / ID" value={deliveryRecipient?.cnic} icon={CreditCard} />
                        <DetailRow label="Address" value={deliveryRecipient?.address} icon={MapPin} />
                        {vehicle.deliveryNotes && <DetailRow label="Notes" value={vehicle.deliveryNotes} />}
                    </div>
                </div>
            </div>

            {/* --- Signatures Section --- */}
            <div className="mt-16 mb-8">
                <h3 className="text-sm font-bold uppercase text-foreground mb-6 border-b border-border pb-2 flex items-center gap-2">
                    <PenTool size={16} /> Acknowledgement
                </h3>
                <p className="text-xs text-muted-foreground mb-8 italic">
                    By signing below, I acknowledge that I have received the vehicle described above in good condition and with all necessary documentation and accessories as agreed.
                </p>

                <div className="grid grid-cols-2 gap-12 mt-12">
                    <div className="border-t-2 border-slate-300 pt-2">
                        <p className="text-sm font-bold text-foreground uppercase">Received By</p>
                        <p className="text-xs text-muted-foreground mt-1">Client Signature & Date</p>
                    </div>
                    <div className="border-t-2 border-slate-300 pt-2">
                        <p className="text-sm font-bold text-foreground uppercase">Authorized By</p>
                        <p className="text-xs text-muted-foreground mt-1">Showroom Representative</p>
                    </div>
                </div>
            </div>

            {/* --- Footer --- */}
            <div className="mt-12 pt-6 border-t border-border flex justify-between items-end text-[10px] text-muted-foreground uppercase tracking-wider">
                <div>
                    <p>Zohaib Motors Tracking System</p>
                    <p>Generated by Anzi & Co.</p>
                </div>
                <div className="text-right">
                    <p>Scan for Digital Record</p>
                    <p className="font-mono text-xs text-foreground">{vehicle.barcode || vehicle.chassisNumber}</p>
                </div>
            </div>
        </div>
    );

    return (
        <>
            <style jsx global>{`
        @media print {
          /* Hide everything in body except our portal */
          body > *:not(#print-portal-root) {
            display: none !important;
          }
          
          /* Ensure body is ready for print */
          body {
            background: white !important;
            height: auto !important;
            overflow: visible !important;
          }

          /* Show our portal content */
          #print-portal-root {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            background: white;
            z-index: 9999;
          }
        }
      `}</style>

            {/* Screen Preview Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200 print-hide">
                <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col shadow-xl bg-card overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b border-border bg-muted">
                        <div className="flex items-center gap-2">
                            <Printer className="text-muted-foreground" size={20} />
                            <h3 className="font-semibold text-foreground">Print Preview - Delivery Note</h3>
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={handlePrint} className="gap-2 bg-secondary hover:bg-secondary/90 text-white text-white">
                                <Printer size={16} /> Print Note
                            </Button>
                            <Button variant="ghost" size="icon" onClick={onClose}>
                                <X size={18} />
                            </Button>
                        </div>
                    </div>

                    <div className="flex flex-1 overflow-hidden">
                        <div className="flex-1 overflow-y-auto bg-muted p-4 md:p-8">
                            <div className="shadow-2xl shadow-slate-200 rounded-xl overflow-hidden ring-1 ring-slate-200 bg-card">
                                <DeliveryDocument />
                            </div>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Print Layer - Rendered directly into body to avoid layout issues */}
            {mounted && createPortal(
                <div id="print-portal-root">
                    <DeliveryDocument />
                </div>,
                document.body
            )}
        </>
    );
};
