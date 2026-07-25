import { useState } from "react";
import { doc, updateDoc, serverTimestamp, addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { addToHistory } from "@/utils/vehicleHistory";
import { FileText, Building2, Truck, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SendToExciseDialog } from "./SendToExciseDialog";
import { ReturnedToShowroomDialog } from "./ReturnedToShowroomDialog";

interface DocStatusDialogProps {
    isOpen: boolean;
    onClose: () => void;
    vehicle: any;
}

export const DocStatusDialog = ({ isOpen, onClose, vehicle }: DocStatusDialogProps) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [showExciseDialog, setShowExciseDialog] = useState(false);
    const [showReturnDialog, setShowReturnDialog] = useState(false);
    const [validationError, setValidationError] = useState<{ title: string, message: string } | null>(null);

    if (!vehicle) return null;

    const currentStatus = vehicle.fileStatus || "Not Applied";
    const isDelivered = currentStatus.toLowerCase().includes("delivered");

    const handleUpdateStatus = async (newStatus: string) => {
        if (!user) return;

        // Validation Logic
        const validTransitions: Record<string, string[]> = {
            "Not Applied": ["Showroom", "At Excise"],
            "Showroom": ["At Excise"],
            "At Excise": ["Returned Back to Showroom"],
            "Returned Back to Showroom": ["At Excise"]
        };

        const allowed = validTransitions[currentStatus] || [];
        if (!allowed.includes(newStatus)) {
            let requiredNext = allowed.join(" or ");
            if (currentStatus === "Showroom" && newStatus === "Returned Back to Showroom") {
                setValidationError({
                    title: "Invalid Transition",
                    message: `Documents are currently at Showroom. They cannot be marked as returned from Excise until they are sent to Excise first. Next valid step: At Excise`
                });
            } else if (currentStatus === "At Excise" && newStatus === "Showroom") {
                setValidationError({
                    title: "Invalid Transition",
                    message: `Documents are currently at Excise. You must use 'Returned Back' instead of a regular 'Showroom' status. Next valid step: Returned Back to Showroom`
                });
            } else {
                setValidationError({
                    title: "Action Not Allowed",
                    message: `You cannot move documents from '${currentStatus}' directly to '${newStatus}'. Next valid step: ${requiredNext || 'None'}`
                });
            }
            return;
        }

        // Handle Dialog flows based on status selection
        if (newStatus === "At Excise") {
            setShowExciseDialog(true);
            return;
        }

        if (newStatus === "Returned Back to Showroom") {
            setShowReturnDialog(true);
            return;
        }

        setLoading(true);

        try {
            // Update vehicle document status
            await updateDoc(doc(db, "cars", vehicle.id), {
                fileStatus: newStatus,
                updatedAt: serverTimestamp()
            });

            // Log the action
            await addDoc(collection(db, "logs"), {
                action: `Updated Doc Status: ${newStatus}`,
                vehicleId: vehicle.id,
                details: `Changed from ${currentStatus} to ${newStatus}`,
                performedBy: user.uid,
                timestamp: serverTimestamp(),
                type: "STATUS_UPDATE"
            });

            // Add to Vehicle History
            await addToHistory(
                vehicle.id,
                "Document Status Update",
                `Changed status from ${currentStatus} to ${newStatus}`,
                user.uid,
                { type: "FILE", status: newStatus }
            );

            onClose();
        } catch (error) {
            console.error("Error updating status:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileText className="text-primary" size={20} />
                            Update Document Status
                        </DialogTitle>
                        <DialogDescription>
                            Manage the location and status of vehicle documents.
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
                                    <p className="font-bold mb-1">Documents Delivered</p>
                                    <p>This vehicle's documents have been delivered to the customer. No further status updates are allowed here.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {/* Showroom Option */}
                                <Button
                                    variant={currentStatus === "Showroom" ? "outline" : "default"}
                                    className={`h-auto py-4 flex flex-col gap-2 ${currentStatus === "Showroom" ? "border-blue-200 bg-muted text-primary hover:bg-blue-100" : "bg-card hover:bg-muted border border-border text-foreground hover:border-blue-300"}`}
                                    disabled={currentStatus === "Showroom" || loading}
                                    onClick={() => handleUpdateStatus("Showroom")}
                                >
                                    <div className={`p-2 rounded-full ${currentStatus === "Showroom" ? "bg-card" : "bg-muted group-hover:bg-card"}`}>
                                        <Building2 size={24} className={currentStatus === "Showroom" ? "text-primary" : "text-muted-foreground"} />
                                    </div>
                                    <div className="text-center">
                                        <div className="font-bold">Showroom</div>
                                        <div className="text-[10px] opacity-80 font-normal">Docs at Showroom</div>
                                    </div>
                                </Button>

                                {/* Excise Option */}
                                <Button
                                    variant={currentStatus === "At Excise" ? "outline" : "default"}
                                    className={`h-auto py-4 flex flex-col gap-2 ${currentStatus === "At Excise" ? "border-purple-200 bg-muted text-primary hover:bg-purple-100" : "bg-card hover:bg-muted border border-border text-foreground hover:border-purple-300"}`}
                                    disabled={currentStatus === "At Excise" || loading}
                                    onClick={() => handleUpdateStatus("At Excise")}
                                >
                                    <div className={`p-2 rounded-full ${currentStatus === "At Excise" ? "bg-card" : "bg-muted group-hover:bg-card"}`}>
                                        <FileText size={24} className={currentStatus === "At Excise" ? "text-primary" : "text-muted-foreground"} />
                                    </div>
                                    <div className="text-center">
                                        <div className="font-bold">At Excise</div>
                                        <div className="text-[10px] opacity-80 font-normal">Docs with Excise</div>
                                    </div>
                                </Button>

                                {/* Returned to Showroom Option - Only show if current status is related to Excise or if explicitly needed */}
                                <Button
                                    variant={currentStatus === "Returned Back to Showroom" ? "outline" : "default"}
                                    className={`h-auto py-4 flex flex-col gap-2 ${currentStatus === "Returned Back to Showroom" ? "border-amber-200 bg-muted text-amber-700 hover:bg-amber-100" : "bg-card hover:bg-muted border border-border text-foreground hover:border-amber-300"}`}
                                    disabled={currentStatus === "Returned Back to Showroom" || loading}
                                    onClick={() => handleUpdateStatus("Returned Back to Showroom")}
                                >
                                    <div className={`p-2 rounded-full ${currentStatus === "Returned Back to Showroom" ? "bg-card" : "bg-muted group-hover:bg-card"}`}>
                                        <RefreshCw size={24} className={currentStatus === "Returned Back to Showroom" ? "text-primary" : "text-muted-foreground"} />
                                    </div>
                                    <div className="text-center">
                                        <div className="font-bold leading-tight">Returned Back</div>
                                        <div className="text-[10px] opacity-80 font-normal">Docs Back from Excise</div>
                                    </div>
                                </Button>
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

                    <DialogFooter>
                        <Button variant="ghost" onClick={onClose} disabled={loading}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <SendToExciseDialog
                isOpen={showExciseDialog}
                onClose={() => setShowExciseDialog(false)}
                vehicle={vehicle}
                onSuccess={onClose}
            />

            <ReturnedToShowroomDialog
                isOpen={showReturnDialog}
                onClose={() => setShowReturnDialog(false)}
                vehicle={vehicle}
                onSuccess={onClose}
            />

            {/* Validation Error Popup */}
            <Dialog open={!!validationError} onOpenChange={(open) => { if (!open) setValidationError(null); }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <AlertCircle size={22} />
                            {validationError?.title}
                        </DialogTitle>
                        <DialogDescription className="text-foreground mt-3 text-base leading-relaxed">
                            {validationError?.message}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4">
                        <Button variant="default" onClick={() => setValidationError(null)} className="w-full sm:w-auto">
                            Understood
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};
