import { useState } from "react";
import { doc, updateDoc, serverTimestamp, addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { addToHistory } from "@/utils/vehicleHistory";
import { CreditCard, Building2, AlertCircle, CheckCircle2, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PlateStatusDialogProps {
    isOpen: boolean;
    onClose: () => void;
    vehicle: any;
}

export const PlateStatusDialog = ({ isOpen, onClose, vehicle }: PlateStatusDialogProps) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);

    if (!vehicle) return null;

    const currentStatus = vehicle.plateStatus || "Never Applied";
    const isDelivered = currentStatus.toLowerCase().includes("delivered");

    // Initialize availablity based on status
    const [isAvailable, setIsAvailable] = useState(() => {
        if (vehicle.platesAvailable !== undefined) return vehicle.platesAvailable;
        // Fallback for legacy
        if (currentStatus === "Not Issued from Excise" || currentStatus === "At Party's Hand") return false;
        return true;
    });

    const handleUpdateStatus = async (newStatus: string, available: boolean) => {
        if (!user) return;
        setLoading(true);

        try {
            // Update vehicle plate status
            await updateDoc(doc(db, "cars", vehicle.id), {
                plateStatus: newStatus,
                platesAvailable: available,
                updatedAt: serverTimestamp()
            });

            // Log the action
            await addDoc(collection(db, "logs"), {
                action: `Updated Plate Status: ${newStatus}`,
                vehicleId: vehicle.id,
                details: `Changed from ${currentStatus} to ${newStatus} (Available: ${available})`,
                performedBy: user.uid,
                timestamp: serverTimestamp(),
                type: "STATUS_UPDATE"
            });

            // Add to Vehicle History
            await addToHistory(
                vehicle.id,
                "Plate Status Update",
                `Changed status from ${currentStatus} to ${newStatus}`,
                user.uid,
                { type: "PLATE", status: newStatus, available }
            );

            onClose();
        } catch (error) {
            console.error("Error updating status:", error);
        } finally {
            setLoading(false);
        }
    };



    const unavailableOptions = [
        {
            value: "Not Issued from Excise",
            label: "Not Issued",
            desc: "Delayed/Pending",
            icon: <AlertCircle size={24} className="text-red-500" />,
            color: "red"
        },
        {
            value: "At Party's Hand",
            label: "At Party",
            desc: "With Owner",
            icon: <User size={24} className="text-muted-foreground" />,
            color: "slate"
        }
    ];

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CreditCard className="text-foreground" size={20} />
                        Update Number Plate Status
                    </DialogTitle>
                    <DialogDescription>
                        Track the production and collection status of number plates.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg border border-border">
                        <span className="text-sm font-medium text-muted-foreground">Current Status:</span>
                        <Badge variant="outline" className="text-sm font-bold px-3 py-1 bg-card">
                            {currentStatus}
                        </Badge>
                    </div>

                    {isDelivered ? (
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex gap-3 text-green-800">
                            <CheckCircle2 className="shrink-0 mt-0.5" size={20} />
                            <div className="text-sm">
                                <p className="font-bold mb-1">Plates Delivered</p>
                                <p>The plates have been delivered to the customer. No further status updates are allowed here.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Toggle Switch */}
                            <div className="flex items-center justify-between px-1">
                                <div>
                                    <p className="font-bold text-sm text-foreground">Plates Available?</p>
                                    <p className="text-xs text-muted-foreground">Are plates physically in the showroom / process?</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={isAvailable}
                                        onChange={(e) => setIsAvailable(e.target.checked)}
                                    />
                                    <div className="w-11 h-6 border-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-900"></div>
                                </label>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {isAvailable ? (
                                    /* Available - Single Option: Showroom */
                                    <Button
                                        variant="outline"
                                        className={`h-auto py-4 flex flex-col gap-2 relative overflow-hidden col-span-1 sm:col-span-2 ${currentStatus === "Showroom"
                                            ? "border-blue-500 bg-muted ring-1 ring-blue-500 text-primary"
                                            : "hover:bg-muted border-border"
                                            }`}
                                        disabled={currentStatus === "Showroom" || loading}
                                        onClick={() => handleUpdateStatus("Showroom", true)}
                                    >
                                        <div className={`p-3 rounded-full ${currentStatus === "Showroom" ? "bg-card" : "bg-muted"}`}>
                                            <Building2 size={24} className="text-blue-500" />
                                        </div>
                                        <div className="text-center">
                                            <div className="font-bold text-sm">In Showroom</div>
                                            <div className="text-[10px] opacity-80 font-normal">Plates Available</div>
                                        </div>
                                    </Button>
                                ) : (
                                    /* Unavailable Options */
                                    unavailableOptions.map((option) => (
                                        <Button
                                            key={option.value}
                                            variant="outline"
                                            className={`h-auto py-3 flex flex-col gap-2 relative overflow-hidden ${currentStatus === option.value
                                                ? `border-${option.color}-500 bg-${option.color}-50 ring-1 ring-${option.color}-500 text-${option.color}-700`
                                                : "hover:bg-muted border-border"
                                                }`}
                                            disabled={currentStatus === option.value || loading}
                                            onClick={() => handleUpdateStatus(option.value, false)}
                                        >
                                            <div className={`p-2 rounded-full ${currentStatus === option.value ? "bg-card" : "bg-muted"}`}>
                                                {option.icon}
                                            </div>
                                            <div className="text-center">
                                                <div className="font-bold text-sm">{option.label}</div>
                                                <div className="text-[10px] opacity-80 font-normal">{option.desc}</div>
                                            </div>
                                        </Button>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {!isDelivered && (
                        <div className="flex items-start gap-2 p-3 bg-muted/50 rounded text-xs text-primary">
                            <AlertCircle size={14} className="mt-0.5 shrink-0" />
                            <p>
                                Marking as <span className="font-bold">Delivered</span> is only available via the Delivery Management page.
                            </p>
                        </div>
                    )}

                </div>
            </DialogContent>
        </Dialog>
    );
};
