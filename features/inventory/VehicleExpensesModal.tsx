"use client";
import { useState, useEffect } from "react";
import {
  collection, addDoc, onSnapshot, query, where, orderBy,
  serverTimestamp, doc, runTransaction, updateDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Loader2, PlusCircle, Wrench, CheckCircle2, Trash2, Receipt } from "lucide-react";

interface VehicleExpensesModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicle: any | null;
}

export const VehicleExpensesModal = ({ isOpen, onClose, vehicle }: VehicleExpensesModalProps) => {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);

  // Form state
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Fetch existing expenses for this vehicle
  useEffect(() => {
    if (!vehicle?.id) return;
    const q = query(
      collection(db, "vehicle-expenses"),
      where("vehicleId", "==", vehicle.id),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [vehicle?.id]);

  // Fetch cash/bank accounts
  useEffect(() => {
    const q = query(collection(db, "accounts"), orderBy("name"));
    const unsub = onSnapshot(q, (snap) => {
      setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !vehicle) return;

    const amountVal = parseFloat(amount);
    if (!description.trim() || amountVal <= 0 || !paymentAccountId) {
      setMessage("Error: Please fill in all expense fields.");
      return;
    }

    if (!vehicle.vehicleAccountId) {
      setMessage("Error: This vehicle does not have a linked ledger account. Re-register the vehicle with purchase details.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      await runTransaction(db, async (tx) => {
        // --- READ PHASE FIRST ---
        // 1. Get vehicle asset account
        const vehicleAccRef = doc(db, "accounts", vehicle.vehicleAccountId);
        const vehicleAccSnap = await tx.get(vehicleAccRef);
        if (!vehicleAccSnap.exists()) throw new Error("Vehicle asset account not found.");
        const vehicleAccBal = vehicleAccSnap.data().balance || 0;

        // 2. Get payment account
        const payAccRef = doc(db, "accounts", paymentAccountId);
        const payAccSnap = await tx.get(payAccRef);
        if (!payAccSnap.exists()) throw new Error("Payment account not found.");
        const payAccName = payAccSnap.data().name;
        const payAccBal = payAccSnap.data().balance || 0;

        // 3. Get vehicle/car document
        const carRef = doc(db, "cars", vehicle.id);
        const carSnap = await tx.get(carRef);
        if (!carSnap.exists()) throw new Error("Vehicle record not found.");

        // --- WRITE PHASE SECOND ---
        // 1. Update vehicle asset account balance (capitalize expense)
        tx.update(vehicleAccRef, {
          balance: vehicleAccBal + amountVal,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid
        });

        // 2. Deduct from payment account
        tx.update(payAccRef, {
          balance: payAccBal - amountVal,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid
        });

        // 3. Voucher: Debit Vehicle Asset
        const v1Ref = doc(collection(db, "vouchers"));
        tx.set(v1Ref, {
          voucherNo: "JV-" + Math.floor(100000 + Math.random() * 900000),
          date: expenseDate,
          accountId: vehicle.vehicleAccountId,
          accountName: vehicleAccSnap.data().name,
          type: "debit",
          amount: amountVal,
          description: `Vehicle expense: ${description} — ${vehicle.brandName} ${vehicle.model} (${vehicle.chassisNumber?.slice(-4) || ""})`,
          vehicleId: vehicle.id,
          createdAt: serverTimestamp(),
          createdBy: user.uid
        });

        // 4. Voucher: Credit Payment Account
        const v2Ref = doc(collection(db, "vouchers"));
        tx.set(v2Ref, {
          voucherNo: "JV-" + Math.floor(100000 + Math.random() * 900000),
          date: expenseDate,
          accountId: paymentAccountId,
          accountName: payAccName,
          type: "credit",
          amount: amountVal,
          description: `Vehicle expense payment: ${description} — ${vehicle.brandName} ${vehicle.model}`,
          vehicleId: vehicle.id,
          createdAt: serverTimestamp(),
          createdBy: user.uid
        });

        // 5. Save expense record
        const expRef = doc(collection(db, "vehicle-expenses"));
        tx.set(expRef, {
          vehicleId: vehicle.id,
          vehicleName: `${vehicle.brandName} ${vehicle.model}`,
          amount: amountVal,
          expenseDate,
          description: description.trim(),
          paymentAccountId,
          paymentAccountName: payAccName,
          createdAt: serverTimestamp(),
          createdBy: user.uid
        });

        // 6. Update vehicle totalExpenses and capitalizedCost
        const currentTotal = carSnap.data().totalExpenses || 0;
        const currentCapitalized = carSnap.data().capitalizedCost || 0;
        tx.update(carRef, {
          totalExpenses: currentTotal + amountVal,
          capitalizedCost: currentCapitalized + amountVal,
          updatedAt: serverTimestamp()
        });
      });

      setMessage("Success: Expense recorded and accounts updated.");
      setDescription("");
      setAmount("");
      setPaymentAccountId("");
      setExpenseDate(new Date().toISOString().split("T")[0]);

    } catch (err: any) {
      console.error("Expense error:", err);
      setMessage(`Error: ${err.message || "Could not record expense."}`);
    } finally {
      setSaving(false);
    }
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench size={18} className="text-secondary" />
            Vehicle Expenses
          </DialogTitle>
          <DialogDescription>
            Record expenses for <strong>{vehicle?.brandName} {vehicle?.model} ({vehicle?.modelYear || vehicle?.year})</strong>.
            Each expense is capitalized into the vehicle&apos;s asset account.
          </DialogDescription>
        </DialogHeader>

        {/* Summary Bar */}
        <div className="grid grid-cols-3 gap-3 py-2">
          <div className="p-3 bg-muted rounded-lg border border-border text-center">
            <p className="text-xs text-blue-500 font-medium">Purchase Price</p>
            <p className="text-sm font-bold text-blue-900">Rs. {Number(vehicle?.purchasePrice || 0).toLocaleString()}</p>
          </div>
          <div className="p-3 bg-muted rounded-lg border border-border text-center">
            <p className="text-xs text-secondary font-medium">Total Expenses</p>
            <p className="text-sm font-bold text-orange-900">Rs. {totalExpenses.toLocaleString()}</p>
          </div>
          <div className="p-3 bg-muted rounded-lg border border-border text-center">
            <p className="text-xs text-muted-foreground font-medium">Capitalized Cost</p>
            <p className="text-sm font-bold text-foreground">Rs. {((vehicle?.purchasePrice || 0) + totalExpenses).toLocaleString()}</p>
          </div>
        </div>

        {/* Add Expense Form */}
        <form onSubmit={handleAddExpense} className="space-y-3 border border-dashed border-orange-200 bg-muted/30 rounded-xl p-4">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Add New Expense</h4>

          {message && (
            <div className={`p-2 rounded text-xs font-medium flex items-center gap-1.5
              ${message.includes("Error") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
              {!message.includes("Error") && <CheckCircle2 size={12} />}
              {message}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Description *</label>
              <Input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="e.g. Dent & Paint, Engine Service..."
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Amount (PKR) *</label>
              <Input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Date *</label>
              <Input
                type="date"
                value={expenseDate}
                onChange={e => setExpenseDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Pay From Account *</label>
              <Select value={paymentAccountId} onValueChange={setPaymentAccountId} required>
                <SelectTrigger className="bg-card">
                  <SelectValue placeholder="Select cash/bank account..." />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name} (Rs. {Number(acc.balance).toLocaleString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={saving} className="bg-orange-600 hover:bg-orange-700 gap-1.5">
              {saving ? <><Loader2 size={13} className="animate-spin" />Saving...</> : <><PlusCircle size={13} />Record Expense</>}
            </Button>
          </div>
        </form>

        {/* Expenses List */}
        <div className="flex-1 overflow-y-auto space-y-2 mt-2">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Expense History ({expenses.length})</h4>
          {expenses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Receipt size={28} className="mx-auto mb-2 opacity-20" />
              <p className="text-xs">No expenses recorded for this vehicle yet.</p>
            </div>
          ) : (
            expenses.map(exp => (
              <div key={exp.id}
                className="flex items-center justify-between p-3 bg-card border border-border rounded-lg">
                <div>
                  <p className="text-sm font-semibold text-foreground">{exp.description}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {exp.expenseDate} · Paid via {exp.paymentAccountName}
                  </p>
                </div>
                <span className="text-sm font-bold text-orange-700">
                  Rs. {Number(exp.amount).toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
