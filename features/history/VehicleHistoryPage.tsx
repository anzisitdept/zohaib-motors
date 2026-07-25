"use client";
import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VehicleSelector } from "@/features/delivery/VehicleSelector";
import { History, Calendar, User, UserCircle, Download, FileText } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface HistoryEntry {
    action: string;
    details: string;
    timestamp: string;
    performedBy: string;
    [key: string]: any;
}

interface Vehicle {
    id: string;
    brandName?: string;
    model: string;
    chassisNumber: string;
    registrationNumber?: string;
    registrationReason?: string;
    history?: HistoryEntry[];
    [key: string]: any;
}

export const VehicleHistoryPage = () => {
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [selectedVehicleId, setSelectedVehicleId] = useState("");
    const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
    const [userMap, setUserMap] = useState<Record<string, string>>({});

    // Fetch all vehicles for selector
    useEffect(() => {
        const q = query(collection(db, "cars"), orderBy("updatedAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const vehicleList = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Vehicle));
            setVehicles(vehicleList);
        });
        return () => unsubscribe();
    }, []);

    // Fetch users for name mapping
    useEffect(() => {
        const q = query(collection(db, "users"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const map: Record<string, string> = {};
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                map[doc.id] = data.name || data.email || "Unknown User";
            });
            setUserMap(map);
        });
        return () => unsubscribe();
    }, []);

    // Fetch selected vehicle details (real-time for history updates)
    useEffect(() => {
        if (!selectedVehicleId) {
            setSelectedVehicle(null);
            return;
        }

        const unsubscribe = onSnapshot(doc(db, "cars", selectedVehicleId), (docSnap) => {
            if (docSnap.exists()) {
                setSelectedVehicle({ id: docSnap.id, ...docSnap.data() } as Vehicle);
            }
        });
        return () => unsubscribe();
    }, [selectedVehicleId]);

    // Sort history by date desc
    const sortedHistory = selectedVehicle?.history?.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    ) || [];

    const getUserName = (entry: HistoryEntry) => {
        const userId = entry.performedBy || entry.updatedBy;
        if (!userId) return "System";
        return userMap[userId] || (userId.length > 8 ? `User ${userId.substring(0, 8)}...` : userId);
    };

    const loadImage = (url: string): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = url;
            img.onload = () => resolve(img);
            img.onerror = reject;
        });
    };

    const handleDownloadPDF = async () => {
        if (!selectedVehicle) return;

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;

        try {
            // 1. Logo (Centered)
            const logoUrl = "/carlogo.png";
            try {
                const img = await loadImage(logoUrl);
                // Aspect Ratio: 60/20 = 3:1. Width 40 -> Height 13.3
                const logoWidth = 50;
                const logoHeight = (img.height / img.width) * logoWidth;
                const xPos = (pageWidth - logoWidth) / 2;
                doc.addImage(img, 'PNG', xPos, 10, logoWidth, logoHeight);
            } catch (e) {
                console.error("Logo load failed", e);
            }
        } catch (e) {
            console.error("PDF Error", e);
        }

        let yPos = 40;

        // 2. Header
        doc.setDrawColor(15, 23, 42); // slate-900
        doc.setLineWidth(0.5);
        doc.line(14, yPos, pageWidth - 14, yPos); // Line under logo area
        yPos += 10;

        // Title and Date
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text("VEHICLE HISTORY REPORT", 14, yPos);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139); // slate-500
        doc.text("Official Record", 14, yPos + 5);

        // Date Right Aligned
        const dateStr = new Date().toLocaleDateString();
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184); // slate-400
        doc.text("DATE OF ISSUE", pageWidth - 14, yPos - 1, { align: "right" });
        doc.setFontSize(12);
        doc.setTextColor(15, 23, 42);
        doc.setFont("helvetica", "bold");
        doc.text(dateStr, pageWidth - 14, yPos + 5, { align: "right" });

        yPos += 20;

        // 3. Vehicle Reference Section
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text("REFERENCE VEHICLE", 14, yPos);
        doc.setDrawColor(226, 232, 240); // slate-200
        doc.line(14, yPos + 2, pageWidth - 14, yPos + 2);
        yPos += 10;

        // Grid Layout for Details
        const col1X = 14;
        const col2X = pageWidth / 2 + 7;

        const drawField = (label: string, value: string, x: number, y: number) => {
            doc.setFontSize(8);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(100, 116, 139); // slate-500 uppercase
            doc.text(label.toUpperCase(), x, y);

            doc.setFontSize(11);
            doc.setFont("helvetica", "normal"); // or bold for value
            doc.setTextColor(15, 23, 42);
            doc.text(value, x, y + 5);
        };

        drawField("Brand & Model", `${selectedVehicle.brandName || ""} ${selectedVehicle.model}`, col1X, yPos);
        drawField("Chassis Number", selectedVehicle.chassisNumber, col2X, yPos);
        yPos += 15;
        drawField("Registration No.", selectedVehicle.registrationNumber || "Unregistered", col1X, yPos);
        drawField("System ID", selectedVehicle.id.substring(0, 8).toUpperCase(), col2X, yPos);
        yPos += 15;
        if (selectedVehicle.registrationReason) {
            drawField("Reason", selectedVehicle.registrationReason, col1X, yPos);
            yPos += 15;
        }

        yPos += 5;

        // 4. History Table
        const tableData = sortedHistory.map(entry => [
            new Date(entry.timestamp).toLocaleString(),
            entry.action || entry.status || "-",
            entry.details || entry.note || "-",
            getUserName(entry)
        ]);

        autoTable(doc, {
            startY: yPos,
            head: [['Date / Time', 'Action', 'Details', 'User']],
            body: tableData,
            theme: 'grid', // 'striped' is default, 'grid' looks cleaner
            styles: {
                fontSize: 9,
                cellPadding: 4,
                textColor: [51, 65, 85], // slate-700
                lineColor: [226, 232, 240], // slate-200
                lineWidth: 0.1
            },
            headStyles: {
                fillColor: [248, 250, 252], // slate-50
                textColor: [15, 23, 42], // slate-900
                fontStyle: 'bold',
                lineColor: [226, 232, 240],
                lineWidth: 0.1
            },
            columnStyles: {
                0: { cellWidth: 40 },
                1: { cellWidth: 45 },
                2: { cellWidth: 'auto' },
                3: { cellWidth: 40 }
            },
            alternateRowStyles: {
                fillColor: [255, 255, 255]
            }
        });

        // 5. Footer
        const finalY = (doc as any).lastAutoTable.finalY + 20;
        doc.setDrawColor(241, 245, 249); // slate-100
        doc.line(14, finalY, pageWidth - 14, finalY);

        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139); // slate-500
        doc.text("CARUZEN TRACKING SYSTEM • OFFICIAL HISTORY RECORD", pageWidth / 2, finalY + 8, { align: "center" });
        doc.setFont("helvetica", "bold");
        doc.text("Developed By: Anzi & Co", pageWidth / 2, finalY + 13, { align: "center" });

        doc.save(`History_${selectedVehicle.chassisNumber}.pdf`);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-100 text-secondary rounded-xl">
                        <History size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-foreground tracking-tight">Vehicle History</h2>
                        <p className="text-muted-foreground">Track lifecycle events for any vehicle</p>
                    </div>
                </div>
                {selectedVehicle && (
                    <Button onClick={handleDownloadPDF} variant="outline" className="gap-2 bg-card hover:bg-muted border-border text-foreground shadow-sm">
                        <Download size={16} />
                        Download PDF Report
                    </Button>
                )}
            </div>

            <Card className="border-border shadow-sm">
                <CardHeader className="bg-muted/50 border-b border-border pb-4">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="space-y-1">
                            <CardTitle className="text-lg">Select Vehicle</CardTitle>
                            <CardDescription>Choose a vehicle to view its complete timeline</CardDescription>
                        </div>
                        <div className="w-full md:w-[350px]">
                            <VehicleSelector
                                vehicles={vehicles}
                                value={selectedVehicleId}
                                onChange={setSelectedVehicleId}
                                placeholder="Search vehicle history..."
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {!selectedVehicle ? (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                            <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
                                <History size={32} className="opacity-20" />
                            </div>
                            <p>Select a vehicle to view history</p>
                        </div>
                    ) : sortedHistory.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                            <p>No history records found for this vehicle.</p>
                        </div>
                    ) : (
                        <div className="relative">
                            <div className="absolute left-8 top-0 bottom-0 w-px border-border" />
                            <div className="divide-y divide-slate-100">
                                {sortedHistory.map((entry, index) => (
                                    <div key={index} className="relative pl-16 pr-6 py-6 hover:bg-muted transition-colors group">
                                        {/* Timestamp Bubble */}
                                        <div className="absolute left-6 -translate-x-1/2 mt-1.5 flex flex-col items-center gap-1 bg-card z-10">
                                            <div className="w-4 h-4 rounded-full border-2 border-indigo-500 bg-card shadow-sm ring-4 ring-white" />
                                        </div>

                                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                                            <div className="space-y-1">
                                                <h4 className="font-semibold text-foreground flex items-center gap-2">
                                                    {entry.action || entry.status || "System Update"}
                                                </h4>
                                                <p className="text-sm text-muted-foreground">{entry.details || entry.note || "Details not available"}</p>

                                                {/* Registration Data Expansion */}
                                                {entry.registrationData && (
                                                    <div className="mt-3 bg-muted border border-border rounded-lg p-3 text-sm space-y-3">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                                                            <div>
                                                                <span className="text-xs text-muted-foreground block">Vehicle</span>
                                                                <span className="font-medium text-foreground">
                                                                    {entry.registrationData.mfgYear} {entry.registrationData.brand} {entry.registrationData.model} {entry.registrationData.variant}
                                                                </span>
                                                            </div>
                                                             <div>
                                                                <span className="text-xs text-muted-foreground block">Chassis / Engine</span>
                                                                <span className="font-mono text-xs text-foreground">
                                                                    {entry.registrationData.chassisNumber} / {entry.registrationData.engineNumber}
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <span className="text-xs text-muted-foreground block">Registration No</span>
                                                                <span className="font-medium text-foreground">{entry.registrationData.registrationNumber}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-xs text-muted-foreground block">Specs</span>
                                                                <span className="text-foreground text-xs">
                                                                    {entry.registrationData.color} • {entry.registrationData.transmission} • {entry.registrationData.fuelType}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Ownership Section */}
                                                        <div className="pt-2 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                                                            <div>
                                                                <span className="text-xs text-muted-foreground block">Current Owner</span>
                                                                <span className="font-medium text-foreground">{entry.registrationData.currentOwner?.name}</span>
                                                                <span className="text-xs text-muted-foreground block">{entry.registrationData.currentOwner?.contact}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-xs text-muted-foreground block">Registered Owner</span>
                                                                <span className="font-medium text-foreground">{entry.registrationData.registeredOwner?.name}</span>
                                                                <span className="text-xs text-muted-foreground block">CNIC: {entry.registrationData.registeredOwner?.cnic}</span>
                                                            </div>
                                                        </div>

                                                         {/* Status Section */}
                                                         <div className="pt-2 border-t border-border flex flex-wrap gap-2">
                                                            <div className="px-2 py-1 bg-card border border-border rounded text-xs text-muted-foreground">
                                                                Source: {entry.registrationData.vehicleSource}
                                                            </div>
                                                            <div className="px-2 py-1 bg-card border border-border rounded text-xs text-muted-foreground">
                                                                Reason: {entry.registrationData.registrationReason}
                                                            </div>
                                                             <div className={`px-2 py-1 border rounded text-xs ${entry.registrationData.platesAvailable ? 'bg-green-50 border-green-100 text-green-700' : 'bg-muted border-border text-amber-700'}`}>
                                                                Plates: {entry.registrationData.plateStatus}
                                                            </div>
                                                         </div>
                                                    </div>
                                                )}

                                                {/* Meta Info */}
                                                <div className="flex items-center gap-3 pt-2 text-xs text-muted-foreground">
                                                    <div className="flex items-center gap-1 bg-muted px-2 py-1 rounded-full">
                                                        <UserCircle size={12} />
                                                        <span className="font-medium">{getUserName(entry)}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="shrink-0 text-right">
                                                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-md border border-border">
                                                    <Calendar size={12} />
                                                    {new Date(entry.timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                                </div>
                                                <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-mono">
                                                    {new Date(entry.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};
