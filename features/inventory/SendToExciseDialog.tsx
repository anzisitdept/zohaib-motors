import { useState } from "react";
import { doc, updateDoc, serverTimestamp, addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { addToHistory } from "@/utils/vehicleHistory";
import { FileText, Loader2, Building2, Truck, Hand, ArrowLeft } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface SendToExciseDialogProps {
    isOpen: boolean;
    onClose: () => void;
    vehicle: any;
    onSuccess: () => void;
}

export const SendToExciseDialog = ({ isOpen, onClose, vehicle, onSuccess }: SendToExciseDialogProps) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<1 | 2>(1);
    const [purpose, setPurpose] = useState<"Transfer" | "New Registration" | "">("");
    const [method, setMethod] = useState<string>("hand");
    const [details, setDetails] = useState<string>("");

    if (!vehicle) return null;

    const handleNext = () => {
        if (step === 1 && purpose) {
            setStep(2);
        }
    };

    const handleBack = () => {
        setStep(1);
    };

    const handleConfirm = async () => {
        if (!user || !purpose) return;
        setLoading(true);

        const methodLabel = method === "courier" ? "Sent through Courier" : "Sent through Hand";

        try {
            // 1. Update Vehicle Status
            await updateDoc(doc(db, "cars", vehicle.id), {
                fileStatus: "At Excise",
                excisePurpose: purpose,
                exciseMethod: methodLabel,
                exciseDetails: details,
                updatedAt: serverTimestamp()
            });

            // 2. Log Action
            await addDoc(collection(db, "logs"), {
                action: `Sent Documents to Excise`,
                vehicleId: vehicle.id,
                details: `Purpose: ${purpose}. Method: ${methodLabel}. Details: ${details}`,
                performedBy: user.uid,
                timestamp: serverTimestamp(),
                type: "DOC_STATUS"
            });

            // 3. Add to History
            await addToHistory(
                vehicle.id,
                "Sent Documents to Excise",
                `Sent for ${purpose} via ${methodLabel}`,
                user.uid,
                { type: "FILE", status: "At Excise", purpose, method: methodLabel, details }
            );

            onSuccess();
            setStep(1); // Reset step
            setPurpose("");
            setDetails("");
            setMethod("hand");
        } catch (error) {
            console.error("Error sending to excise:", error);
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
                        Send Documents to Excise
                    </DialogTitle>
                    <DialogDescription>
                        {step === 1 ? "Specify the purpose for sending documents." : "Specify how documents are being sent."}
                    </DialogDescription>
                </DialogHeader>

                {step === 1 ? (
                    <div className="grid grid-cols-2 gap-4 py-4">
                        <button
                            onClick={() => setPurpose("New Registration")}
                            className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 text-center ${purpose === "New Registration"
                                ? "border-purple-600 bg-muted text-primary"
                                : "border-border bg-card hover:border-purple-200 hover:bg-muted text-muted-foreground"
                                }`}
                        >
                            <FileText size={24} className={purpose === "New Registration" ? "text-primary" : "text-muted-foreground"} />
                            <span className="font-bold text-sm">For New Registration</span>
                        </button>

                        <button
                            onClick={() => setPurpose("Transfer")}
                            className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 text-center ${purpose === "Transfer"
                                ? "border-purple-600 bg-muted text-primary"
                                : "border-border bg-card hover:border-purple-200 hover:bg-muted text-muted-foreground"
                                }`}
                        >
                            <FileText size={24} className={purpose === "Transfer" ? "text-primary" : "text-muted-foreground"} />
                            <span className="font-bold text-sm">For Transfer</span>
                        </button>
                    </div>
                ) : (
                    <div className="py-2 space-y-6">
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
                )}

                <DialogFooter className="flex justify-between items-center sm:justify-between">
                    {step === 2 ? (
                        <Button variant="ghost" onClick={handleBack} disabled={loading} className="gap-2">
                            <ArrowLeft size={16} /> Back
                        </Button>
                    ) : (
                        <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
                    )}

                    {step === 1 ? (
                        <Button onClick={handleNext} disabled={!purpose} className="bg-secondary hover:bg-secondary/90 text-white">
                            Next Step
                        </Button>
                    ) : (
                        <Button
                            onClick={handleConfirm}
                            disabled={loading}
                            className="bg-secondary hover:bg-secondary/90 text-white"
                        >
                            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</> : "Confirm Send"}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
