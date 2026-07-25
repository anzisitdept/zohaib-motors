"use client";
import { useState, useEffect } from "react";
import { collection, doc, runTransaction, query, orderBy, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchSelector } from "@/components/ui/SearchSelector";
import { CheckCircle2, Loader2, AlertTriangle, DollarSign, Calendar } from "lucide-react";

export const RecordPaymentModal = ({ plan, open, onClose }: { plan: any, open: boolean, onClose: () => void }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [accounts, setAccounts] = useState<any[]>([]);

  // Form
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [method, setMethod] = useState("cash");
  const [receivingAccountId, setReceivingAccountId] = useState("");
  
  // Find next unpaid installment to pre-fill amount
  useEffect(() => {
    if (plan && open) {
      const unpaid = (plan.installmentSchedule || []).filter((i: any) => !i.paid).sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
      if (unpaid.length > 0) {
        setAmount(unpaid[0].amount.toString());
      } else {
        setAmount("");
      }
      setMessage("");
    }
  }, [plan, open]);

  useEffect(() => {
    const q = query(collection(db, "accounts"), orderBy("name"));
    const unsub = onSnapshot(q, (snap) => {
      setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const handleRecordPayment = async () => {
    const amountVal = parseFloat(amount);
    if (isNaN(amountVal) || amountVal <= 0) {
      setMessage("Error: Please enter a valid amount.");
      return;
    }
    if (!receivingAccountId) {
      setMessage("Error: Please select a receiving account.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      await runTransaction(db, async (tx) => {
        // 1. Get Plan
        const planRef = doc(db, "installmentPlans", plan.id);
        const planSnap = await tx.get(planRef);
        if (!planSnap.exists()) throw new Error("Plan not found.");
        const planData = planSnap.data();
        
        // 2. Get Receiving Account
        const accRef = doc(db, "accounts", receivingAccountId);
        const accSnap = await tx.get(accRef);
        if (!accSnap.exists()) throw new Error("Receiving account not found.");
        const accName = accSnap.data().name;
        const accPrevBal = accSnap.data().balance || 0;
        const accNewBal = accPrevBal + amountVal;

        // 3. Update Plan Schedule
        let remainingToApply = amountVal;
        let schedule = [...(planData.installmentSchedule || [])];
        
        // Sort chronologically just to apply payment safely
        schedule.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
        
        for (let i = 0; i < schedule.length; i++) {
          if (!schedule[i].paid && remainingToApply > 0) {
            // Assume full payment per installment strictly for simplicity, or partial?
            // The PRD implies marking an installment as paid. We'll mark as paid if amount >= installment amount.
            // But if they pay exactly 1 installment, it matches. 
            // If they pay multiple, it clears multiple.
            if (remainingToApply >= schedule[i].amount) {
              remainingToApply -= schedule[i].amount;
              schedule[i].paid = true;
              schedule[i].paidAt = new Date(date).toISOString();
            } else {
              // Partial payment (complex): for now, just apply it against the outstanding balance.
              // We won't mark it fully paid unless amount is met. We can just leave it unpaid but track total outstanding.
            }
          }
        }

        const newOutstandingBalance = Math.max(0, (planData.outstandingBalance || 0) - amountVal);
        const isSettled = newOutstandingBalance === 0;

        // Update Account Balance
        tx.update(accRef, {
          balance: accNewBal,
          updatedAt: serverTimestamp(),
          updatedBy: user?.uid
        });

        // Add to subcollection payments
        const paymentRef = doc(collection(db, "installmentPlans", plan.id, "payments"));
        tx.set(paymentRef, {
          amount: amountVal,
          paidAt: date,
          method,
          receivingAccountId,
          recordedBy: user?.uid,
          createdAt: serverTimestamp()
        });

        // Update Plan Document
        tx.update(planRef, {
          outstandingBalance: newOutstandingBalance,
          installmentSchedule: schedule,
          status: isSettled ? "settled" : planData.status,
          updatedAt: serverTimestamp()
        });

        // Log Voucher Entry (Receiving Account DEBIT, Client/Installment Receivable CREDIT)
        // Here we just write a single entry to indicate money received. 
        const vRef = doc(collection(db, "vouchers"));
        tx.set(vRef, {
          voucherNo: "REC-" + Math.floor(100000 + Math.random() * 900000),
          date,
          description: `Installment Payment from ${planData.clientName || planData.clientId} for Vehicle ${planData.vehicleFileId}`,
          amount: amountVal,
          debit: amountVal,
          credit: 0,
          cashAccountId: receivingAccountId,
          cashAccountName: accName,
          cashType: "debit",
          cashPreviousBalance: accPrevBal,
          cashNewBalance: accNewBal,
          counterAccountId: planData.clientId, // Client as counter account
          counterAccountName: planData.clientName,
          counterType: "credit",
          counterPreviousBalance: planData.outstandingBalance,
          counterNewBalance: newOutstandingBalance,
          createdAt: serverTimestamp(),
          createdBy: user?.uid
        });

        // Log Activity
        tx.set(doc(collection(db, "logs")), {
          action: `Recorded Installment Payment of Rs. ${amountVal.toLocaleString()} for ${planData.clientName}`,
          performedBy: user?.uid,
          timestamp: serverTimestamp(),
          type: "INSTALLMENT_PAYMENT"
        });
      });

      setMessage("Success! Payment recorded.");
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error(err);
      setMessage(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!open || !plan) return null;

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="text-emerald-500" size={20} />
            Record Payment
          </DialogTitle>
          <DialogDescription>
            Applying payment to {plan.clientName}'s plan. Outstanding balance is <strong>Rs. {Number(plan.outstandingBalance || 0).toLocaleString()}</strong>.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {message && (
            <div className={`p-3 rounded-lg text-sm font-medium flex items-center gap-2 ${
              message.startsWith("Error")
                ? "bg-red-50 text-red-700 border border-red-100"
                : "bg-green-50 text-green-700 border border-green-100"
            }`}>
              {message.startsWith("Error") ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
              {message}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Payment Amount (PKR) *</label>
            <Input 
              type="number" 
              value={amount} 
              onChange={e => setAmount(e.target.value)} 
              placeholder="e.g. 25000"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Payment Date *</label>
            <Input 
              type="date" 
              value={date} 
              onChange={e => setDate(e.target.value)} 
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Payment Method *</label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Receiving Account *</label>
            <SearchSelector
              items={accounts}
              value={receivingAccountId}
              onChange={setReceivingAccountId}
              placeholder="Select account to receive funds..."
              searchPlaceholder="Search account..."
              getSearchFields={(acc) => [acc.name]}
              itemKey={(acc) => acc.id}
              renderTrigger={(selected) =>
                selected ? (
                  <span>{selected.name} (Rs. {Number(selected.balance).toLocaleString()})</span>
                ) : (
                  <span className="text-muted-foreground">Select receiving account...</span>
                )
              }
              renderItem={(acc) => (
                <div className="flex justify-between w-full">
                  <span>{acc.name}</span>
                  <span className="text-muted-foreground text-xs">Rs. {Number(acc.balance).toLocaleString()}</span>
                </div>
              )}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleRecordPayment} disabled={loading || !amount || !receivingAccountId} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {loading ? <><Loader2 size={16} className="animate-spin mr-2" /> Processing...</> : "Confirm Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
