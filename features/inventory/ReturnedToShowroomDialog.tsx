import { useState } from "react";
import { doc, updateDoc, serverTimestamp, addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { addToHistory } from "@/utils/vehicleHistory";
import { Building2, Truck, Hand, PackageOpen } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ReturnedToShowroomDialogProps {
    isOpen: boolean;
    onClose: () => void;
    vehicle: any;
    onSuccess: () => void;
}

export const ReturnedToShowroomDialog = ({ isOpen, onClose, vehicle, onSuccess }: ReturnedToShowroomDialogProps) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [method, setMethod] = useState<string>("hand");
    const [details, setDetails] = useState<string>("");
    const [newRegNo, setNewRegNo] = useState<string>("");

    const handleConfirm = async () => {
        if (!user || !vehicle) return;
        setLoading(true);

        const newStatus = "Returned Back to Showroom";
        const methodLabel = method === "courier" ? "Sent through Courier" : "Sent through Hand";

        try {
            // Update vehicle document status and return details
            const updateData: any = {
                fileStatus: newStatus,
                returnedToShowroomMethod: methodLabel,
                returnedToShowroomDetails: details,
                updatedAt: serverTimestamp()
            };

            const updatedRegNo = newRegNo.trim().toUpperCase();
            if (updatedRegNo) {
                if (vehicle.registrationNumber) {
                    updateData.oldRegistrationNumber = vehicle.registrationNumber;
                }
                updateData.registrationNumber = updatedRegNo;
            }

            await updateDoc(doc(db, "cars", vehicle.id), updateData);

            // Log the action
            await addDoc(collection(db, "logs"), {
                action: `Updated Doc Status: ${newStatus}`,
                vehicleId: vehicle.id,
                details: `Returned via ${methodLabel}. Details: ${details}${updatedRegNo ? `. New Reg No: ${updatedRegNo}` : ""}`,
                performedBy: user.uid,
                timestamp: serverTimestamp(),
                type: "STATUS_UPDATE"
            });

            // Add to Vehicle History
            await addToHistory(
                vehicle.id,
                "Document Returned to Showroom",
                `Returned via ${methodLabel}${updatedRegNo ? `. New Reg No: ${updatedRegNo}` : ""}`,
                user.uid,
                {
                    type: "FILE",
                    status: newStatus,
                    method: methodLabel,
                    details: details,
                    ...(updatedRegNo && {
                        newRegistrationNumber: updatedRegNo,
                        oldRegistrationNumber: vehicle.registrationNumber || ""
                    })
                }
            );

            onSuccess();
            onClose();
        } catch (error) {
            console.error("Error updating return status:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Building2 className="text-primary" size={20} />
                        Return Documents to Showroom
                    </DialogTitle>
                    <DialogDescription>
                        Specify how the documents are being returned to the showroom.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-6">
                    <div className="space-y-3">
                        <Label className="text-base font-semibold">Delivery Method</Label>
                        <RadioGroup value={method} onValueChange={setMethod} className="grid grid-cols-2 gap-4">
                            <div>
                                <RadioGroupItem value="courier" id="courier" className="peer sr-only" />
                                <Label
                                    htmlFor="courier"
                                    className="flex flex-col items-center justify-between rounded-md border-2 border-border bg-card p-4 hover:bg-muted hover:text-foreground peer-data-[state=checked]:border-blue-500 peer-data-[state=checked]:bg-muted [&:has([data-state=checked])]:border-blue-500 cursor-pointer transition-all h-full"
                                >
                                    <Truck className="mb-2 h-6 w-6 text-muted-foreground peer-data-[state=checked]:text-primary" />
                                    <span className="font-medium text-center">Through Courier</span>
                                </Label>
                            </div>
                            <div>
                                <RadioGroupItem value="hand" id="hand" className="peer sr-only" />
                                <Label
                                    htmlFor="hand"
                                    className="flex flex-col items-center justify-between rounded-md border-2 border-border bg-card p-4 hover:bg-muted hover:text-foreground peer-data-[state=checked]:border-blue-500 peer-data-[state=checked]:bg-muted [&:has([data-state=checked])]:border-blue-500 cursor-pointer transition-all h-full"
                                >
                                    <Hand className="mb-2 h-6 w-6 text-muted-foreground peer-data-[state=checked]:text-primary" />
                                    <span className="font-medium text-center">Through Hand</span>
                                </Label>
                            </div>
                        </RadioGroup>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="newRegNo" className="text-base font-semibold">New Registration No. (Optional)</Label>
                        <Input
                            id="newRegNo"
                            placeholder="Enter new registration number..."
                            value={newRegNo}
                            onChange={(e) => setNewRegNo(e.target.value)}
                            className="font-mono uppercase"
                        />
                    </div>

                    <div className="space-y-3">
                        <Label htmlFor="details" className="text-base font-semibold">Additional Details</Label>
                        <Textarea
                            id="details"
                            placeholder="Enter courier tracking number, person name, or other relevant details..."
                            value={details}
                            onChange={(e) => setDetails(e.target.value)}
                            className="min-h-[100px]"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
                    <Button onClick={handleConfirm} disabled={loading} className="bg-secondary hover:bg-secondary/90 text-white text-white">
                        {loading ? "Updating..." : "Confirm Return"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
