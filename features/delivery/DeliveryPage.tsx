"use client";
import { useState, useEffect } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FileText, Package, Truck, CheckCircle, Ban, Info } from "lucide-react";
import { ClientSelectionDialog } from "./ClientSelectionDialog";
import { DocumentData } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";

import { VehicleSelector } from "./VehicleSelector";

interface Vehicle extends DocumentData {
    id: string;
    model: string;
    brandName?: string;
    chassisNumber: string;
    registrationNumber?: string;
    registrationReason?: string;
    ownerName?: string;
    ownerContact?: string;
    fileStatus?: string;
    plateStatus?: string;
    docsApplied?: boolean;
    platesApplied?: boolean;
}

export const DeliveryPage = () => {
    const { userData } = useAuth();
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [selectedDocVehicleId, setSelectedDocVehicleId] = useState("");
    const [selectedPlateVehicleId, setSelectedPlateVehicleId] = useState("");
    const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);
    const [currentDeliveryType, setCurrentDeliveryType] = useState<"DOCUMENT" | "PLATE">("DOCUMENT");
    const [currentVehicle, setCurrentVehicle] = useState<Vehicle | null>(null);

    const canEditDelivered = userData?.permissions?.includes("ALL") || userData?.permissions?.includes("edit_delivered_vehicle");

    // Fetch all vehicles
    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, "cars"), (snapshot) => {
            const vehicleList = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Vehicle));
            setVehicles(vehicleList);
        });
        return () => unsubscribe();
    }, []);

    // Filter vehicles for documents (docsApplied === true)
    const documentVehicles = vehicles.filter(v => v.docsApplied === true);

    // Filter vehicles for plates - exclude those with unavailable statuses
    const plateVehicles = vehicles.filter(v => {
        const status = v.plateStatus;
        // Exclude vehicles where plates are not available
        return status && status !== "Never Applied" && status !== "Not Issued from Excise" && status !== "At Party's Hand";
    });

    const selectedDocVehicle = vehicles.find(v => v.id === selectedDocVehicleId);
    const selectedPlateVehicle = vehicles.find(v => v.id === selectedPlateVehicleId);

    const handleDocumentDeliver = () => {
        if (!selectedDocVehicle) return;
        setCurrentVehicle(selectedDocVehicle);
        setCurrentDeliveryType("DOCUMENT");
        setIsClientDialogOpen(true);
    };

    const handlePlateDeliver = () => {
        if (!selectedPlateVehicle) return;
        setCurrentVehicle(selectedPlateVehicle);
        setCurrentDeliveryType("PLATE");
        setIsClientDialogOpen(true);
    };

    const handleDeliverySuccess = () => {
        // Reset selections after successful delivery
        if (currentDeliveryType === "DOCUMENT") {
            setSelectedDocVehicleId("");
        } else {
            setSelectedPlateVehicleId("");
        }
    };

    const VehicleDetails = ({ vehicle }: { vehicle: Vehicle | undefined }) => {
        if (!vehicle) {
            return (
                <div className="p-6 bg-muted rounded-lg border border-dashed border-border text-center text-muted-foreground">
                    <Info size={24} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Select a vehicle to view details</p>
                </div>
            );
        }

        return (
            <div className="p-4 bg-card rounded-lg border border-border space-y-3">
                <h4 className="text-xs font-bold text-muted-foreground uppercase border-b border-border pb-2">
                    Vehicle Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                        <span className="text-muted-foreground text-xs">Model:</span>
                        <p className="font-semibold">{vehicle.brandName} {vehicle.model}</p>
                    </div>
                    <div>
                        <span className="text-muted-foreground text-xs">Chassis:</span>
                        <p className="font-mono text-xs">{vehicle.chassisNumber}</p>
                    </div>
                    <div>
                        <span className="text-muted-foreground text-xs">Reg. Number:</span>
                        <p className="font-mono text-xs">{vehicle.registrationNumber || "Unregistered"}</p>
                    </div>
                    <div>
                        <span className="text-muted-foreground text-xs">Owner:</span>
                        <p className="font-medium text-xs">{vehicle.ownerName || "N/A"}</p>
                    </div>
                    {vehicle.registrationReason && (
                        <div className="col-span-2">
                            <span className="text-muted-foreground text-xs">Registration Reason:</span>
                            <p className="font-medium inline-flex items-center gap-2 ml-2">
                                <span className="px-2 py-0.5 bg-blue-100 text-primary rounded text-xs">
                                    {vehicle.registrationReason}
                                </span>
                            </p>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-900 rounded-lg">
                    <Truck size={24} className="text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Delivery Management</h1>
                    <p className="text-sm text-muted-foreground">Manage document and number plate deliveries to clients</p>
                </div>
            </div>

            {/* Dual Forms Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Document Delivery Form */}
                <Card className="border-blue-200 shadow-sm">
                    <CardHeader className="bg-muted/50 border-b border-border">
                        <div className="flex items-center gap-2">
                            <FileText size={20} className="text-primary" />
                            <CardTitle className="text-lg">Document Delivery</CardTitle>
                        </div>
                        <CardDescription>Deliver vehicle documents to clients</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        {/* Vehicle Selection */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Select Vehicle</label>
                            <VehicleSelector
                                vehicles={documentVehicles}
                                value={selectedDocVehicleId}
                                onChange={setSelectedDocVehicleId}
                                placeholder="Search by name, reg, or chassis..."
                            />
                        </div>

                        {/* Current Status */}
                        {selectedDocVehicle && (
                            <div className="p-3 bg-muted rounded-lg border border-border">
                                <span className="text-xs text-muted-foreground font-medium">Current Status:</span>
                                <p className="font-semibold text-sm mt-1">
                                    {selectedDocVehicle.fileStatus || "Applied"}
                                </p>
                            </div>
                        )}

                        {/* Vehicle Details */}
                        <VehicleDetails vehicle={selectedDocVehicle} />

                        {/* Deliver Button */}
                        <Button
                            onClick={handleDocumentDeliver}
                            disabled={
                                !selectedDocVehicle ||
                                (selectedDocVehicle.fileStatus === "Delivered" && !canEditDelivered)
                            }
                            className={selectedDocVehicle?.fileStatus === "Delivered" && canEditDelivered ? "w-full bg-amber-600 hover:bg-amber-700" : "w-full bg-secondary hover:bg-secondary/90 text-white"}
                        >
                            {selectedDocVehicle?.fileStatus === "Delivered" ? (
                                canEditDelivered ? (
                                    <>
                                        <FileText className="mr-2 h-4 w-4" />
                                        Edit Delivery
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle className="mr-2 h-4 w-4" />
                                        Already Delivered
                                    </>
                                )
                            ) : (
                                <>
                                    <FileText className="mr-2 h-4 w-4" />
                                    Deliver Documents
                                </>
                            )}
                        </Button>

                        {selectedDocVehicle?.fileStatus === "Delivered" && (
                            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                                <CheckCircle size={16} />
                                <span>Documents have been delivered</span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Number Plate Delivery Form */}
                <Card className="border-orange-200 shadow-sm">
                    <CardHeader className="bg-muted/50 border-b border-border">
                        <div className="flex items-center gap-2">
                            <Package size={20} className="text-secondary" />
                            <CardTitle className="text-lg">Number Plate Delivery</CardTitle>
                        </div>
                        <CardDescription>Deliver number plates to clients</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        {/* Vehicle Selection */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Select Vehicle</label>
                            <VehicleSelector
                                vehicles={plateVehicles}
                                value={selectedPlateVehicleId}
                                onChange={setSelectedPlateVehicleId}
                                placeholder="Search by name, reg, or chassis..."
                            />
                        </div>

                        {/* Current Status */}
                        {selectedPlateVehicle && (
                            <div className="p-3 bg-muted rounded-lg border border-border">
                                <span className="text-xs text-muted-foreground font-medium">Current Status:</span>
                                <p className="font-semibold text-sm mt-1">
                                    {selectedPlateVehicle.plateStatus || "Applied"}
                                </p>
                            </div>
                        )}

                        {/* Vehicle Details */}
                        <VehicleDetails vehicle={selectedPlateVehicle} />

                        {/* Deliver Button */}
                        <Button
                            onClick={handlePlateDeliver}
                            disabled={
                                !selectedPlateVehicle ||
                                (selectedPlateVehicle.plateStatus === "Delivered to Customer" && !canEditDelivered)
                            }
                            className={selectedPlateVehicle?.plateStatus === "Delivered to Customer" && canEditDelivered ? "w-full bg-amber-600 hover:bg-amber-700" : "w-full bg-orange-600 hover:bg-orange-700"}
                        >
                            {selectedPlateVehicle?.plateStatus === "Delivered to Customer" ? (
                                canEditDelivered ? (
                                    <>
                                        <Package className="mr-2 h-4 w-4" />
                                        Edit Delivery
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle className="mr-2 h-4 w-4" />
                                        Already Delivered
                                    </>
                                )
                            ) : (
                                <>
                                    <Package className="mr-2 h-4 w-4" />
                                    Deliver Plates
                                </>
                            )}
                        </Button>

                        {selectedPlateVehicle?.plateStatus === "Delivered to Customer" && (
                            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                                <CheckCircle size={16} />
                                <span>Plates have been delivered</span>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Client Selection Dialog */}
            <ClientSelectionDialog
                isOpen={isClientDialogOpen}
                onClose={() => setIsClientDialogOpen(false)}
                vehicle={currentVehicle}
                deliveryType={currentDeliveryType}
                onSuccess={handleDeliverySuccess}
            />
        </div>
    );
};
