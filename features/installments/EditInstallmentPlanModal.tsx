import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2, Calendar, DollarSign, CheckCircle2 } from "lucide-react";

export const EditInstallmentPlanModal = ({ plan, open, onClose }: { plan: any, open: boolean, onClose: () => void }) => {
  const [schedule, setSchedule] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (plan && plan.installmentSchedule) {
      setSchedule(JSON.parse(JSON.stringify(plan.installmentSchedule)));
    }
  }, [plan]);

  const handleUpdateItem = (index: number, field: string, value: any) => {
    const updated = [...schedule];
    if (field === "amount") {
      updated[index][field] = parseFloat(value) || 0;
    } else {
      updated[index][field] = value;
    }
    setSchedule(updated);
  };

  const handleSaveChanges = async () => {
    if (!plan) return;
    setLoading(true);
    try {
      const planRef = doc(db, "installmentPlans", plan.id);
      
      // Recalculate total monthly installment amount if it changed
      const unpaid = schedule.filter(s => !s.paid);
      
      await updateDoc(planRef, {
        installmentSchedule: schedule,
        updatedAt: serverTimestamp()
      });
      onClose();
    } catch (err: any) {
      console.error(err);
      alert("Failed to update schedule: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!plan) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit Installment Schedule</DialogTitle>
          <DialogDescription>
            Modify the due dates or amounts for {plan.clientName}'s unpaid installments.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-2 mt-4">
          {schedule.map((inst, idx) => (
            <div key={inst.id} className={`p-3 rounded-lg border flex flex-col md:flex-row gap-3 ${inst.paid ? "bg-emerald-50/50 border-emerald-100 opacity-60 pointer-events-none" : "bg-card border-border"}`}>
              <div className="flex-1 space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                  <Calendar size={12} /> Due Date
                </label>
                <Input 
                  type="date" 
                  value={inst.dueDate} 
                  onChange={e => handleUpdateItem(idx, "dueDate", e.target.value)}
                  disabled={inst.paid}
                  className="h-9"
                />
              </div>
              <div className="flex-1 space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                  <DollarSign size={12} /> Amount (Rs)
                </label>
                <Input 
                  type="number" 
                  value={inst.amount} 
                  onChange={e => handleUpdateItem(idx, "amount", e.target.value)}
                  disabled={inst.paid}
                  className="h-9"
                />
              </div>
              {inst.paid && (
                <div className="flex items-end pb-2 text-emerald-600 font-bold text-xs gap-1">
                  <CheckCircle2 size={14} /> Paid
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleSaveChanges} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
            {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
