import { useState } from "react";
import { doc, updateDoc, serverTimestamp, addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { addToHistory } from "@/utils/vehicleHistory";
import { FileText, ShoppingCart, Repeat, FilePlus } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface ExciseTypeDialogProps {
    isOpen: boolean;
    onClose: () => void;
    vehicle: any;
    onSuccess: () => void;
}

export const ExciseTypeDialog = ({ isOpen, onClose, vehicle, onSuccess }: ExciseTypeDialogProps) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [selectedType, setSelectedType] = useState<string>("At Excise for new registration");

    const handleConfirm = async () => {
        if (!user || !vehicle) return;
        setLoading(true);

        const newStatus = "At Excise";

        try {
            // Update vehicle document status and excise type
            await updateDoc(doc(db, "cars", vehicle.id), {
                fileStatus: newStatus,
                exciseType: selectedType,
                updatedAt: serverTimestamp()
            });

            // Log the action
            await addDoc(collection(db, "logs"), {
                action: `Updated Doc Status: ${newStatus}`,
                vehicleId: vehicle.id,
                details: `Changed from ${vehicle.fileStatus || "Not Applied"} to ${newStatus} (${selectedType})`,
                performedBy: user.uid,
                timestamp: serverTimestamp(),
                type: "STATUS_UPDATE"
            });

            // Add to Vehicle History
            await addToHistory(
                vehicle.id,
                "Document Status Update",
                `Changed status to ${newStatus} - ${selectedType}`,
                user.uid,
                { type: "FILE", status: newStatus, exciseType: selectedType }
            );

            onSuccess();
            onClose();
        } catch (error) {
            console.error("Error updating excise status:", error);
        } finally {
            setLoading(false);
        }
    };

    const options = [
        {
            id: "purchase",
            value: "At Excise for Purchase",
            label: "For Purchase",
            description: "Document submission for vehicle purchase",
            icon: ShoppingCart
        },
        {
            id: "transfer",
            value: "At Excise for Transfer",
            label: "For Transfer",
            description: "Transfer of ownership processing",
            icon: Repeat
        },
        {
            id: "registration",
            value: "At Excise for New Registration",
            label: "For New Registration",
            description: "First time vehicle registration",
            icon: FilePlus
        }
    ];

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="text-primary" size={20} />
                        Select Excise Purpose
                    </DialogTitle>
                    <DialogDescription>
                        Please specify why the documents are being sent to Excise.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    <RadioGroup value={selectedType} onValueChange={setSelectedType} className="gap-3">
                        {options.map((option) => (
                            <div key={option.id}>
                                <RadioGroupItem
                                    value={option.value}
                                    id={option.id}
                                    className="peer sr-only"
                                />
                                <Label
                                    htmlFor={option.id}
                                    className="flex items-center justify-between rounded-md border-2 border-border bg-card p-4 hover:bg-muted hover:text-foreground peer-data-[state=checked]:border-purple-500 peer-data-[state=checked]:bg-muted [&:has([data-state=checked])]:border-purple-500 cursor-pointer transition-all"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="bg-purple-100 p-2 rounded-full text-primary">
                                            <option.icon size={20} />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-foreground">{option.label}</p>
                                            <p className="text-sm text-muted-foreground">{option.description}</p>
                                        </div>
                                    </div>
                                </Label>
                            </div>
                        ))}
                    </RadioGroup>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
                    <Button onClick={handleConfirm} disabled={loading} className="bg-secondary hover:bg-secondary/90 text-white text-white">
                        {loading ? "Updating..." : "Confirm Status"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
