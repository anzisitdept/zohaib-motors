"use client";
import { useState, useEffect } from "react";
import {
  collection, addDoc, onSnapshot, query, orderBy,
  serverTimestamp, doc, runTransaction, updateDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle2, DollarSign, TrendingUp, TrendingDown, Users } from "lucide-react";

interface VehicleSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicle: any | null;
}

export const VehicleSaleModal = ({ isOpen, onClose, vehicle }: VehicleSaleModalProps) => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [salePrice, setSalePrice] = useState("");
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split("T")[0]);
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [receivingAccountId, setReceivingAccountId] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const capitalizedCost = vehicle?.capitalizedCost || vehicle?.purchasePrice || 0;
  const salePriceVal = parseFloat(salePrice) || 0;
  const profit = salePriceVal - capitalizedCost;

  // Commission calculation
  let commissionAmount = 0;
  if (vehicle?.hasInvestor && vehicle?.commissionType && vehicle?.commissionValue) {
    if (vehicle.commissionType === "Percentage") {
      commissionAmount = profit > 0 ? (profit * vehicle.commissionValue) / 100 : 0;
    } else {
      commissionAmount = vehicle.commissionValue || 0;
    }
  }

  useEffect(() => {
    const q = query(collection(db, "accounts"), orderBy("name"));
    const unsub = onSnapshot(q, (snap) => {
      setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const handleSell = async () => {
    if (!user || !vehicle) return;

    if (salePriceVal <= 0) {
      setMessage("Error: Please enter a valid sale price.");
      return;
    }
    if (!receivingAccountId) {
      setMessage("Error: Please select the account receiving sale proceeds.");
      return;
    }
    if (!vehicle.vehicleAccountId) {
      setMessage("Error: Vehicle does not have a linked ledger account.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      await runTransaction(db, async (tx) => {
        // --- Read all needed documents first ---

        // 1. Vehicle asset account
        const vehicleAccRef = doc(db, "accounts", vehicle.vehicleAccountId);
        const vehicleAccSnap = await tx.get(vehicleAccRef);
        if (!vehicleAccSnap.exists()) throw new Error("Vehicle asset account not found.");
        const vehicleAccName = vehicleAccSnap.data().name;
        const vehicleAccBal = vehicleAccSnap.data().balance || 0;

        // 2. Receiving (cash/bank) account
        const receivingAccRef = doc(db, "accounts", receivingAccountId);
        const receivingAccSnap = await tx.get(receivingAccRef);
        if (!receivingAccSnap.exists()) throw new Error("Receiving account not found.");
        const receivingAccName = receivingAccSnap.data().name;
        const receivingAccBal = receivingAccSnap.data().balance || 0;

        // 3. Investor account (if applicable)
        let investorAccRef = null;
        let investorAccName = "";
        let investorAccBal = 0;
        if (vehicle.hasInvestor && vehicle.investorId && commissionAmount > 0) {
          // Get investor's accountId from their profile
          const investorDocRef = doc(db, "investors", vehicle.investorId);
          const investorDocSnap = await tx.get(investorDocRef);
          if (!investorDocSnap.exists()) throw new Error("Investor profile not found.");
          const investorAccountId = investorDocSnap.data().accountId;
          if (!investorAccountId) throw new Error("Investor does not have a linked ledger account. Please re-save the investor first.");
          investorAccRef = doc(db, "accounts", investorAccountId);
          const investorAccSnap = await tx.get(investorAccRef);
          if (!investorAccSnap.exists()) throw new Error("Investor ledger account not found.");
          investorAccName = investorAccSnap.data().name;
          investorAccBal = investorAccSnap.data().balance || 0;
        }

        // --- Now write all updates ---

        // A. Debit receiving account (+ sale proceeds)
        tx.update(receivingAccRef, {
          balance: receivingAccBal + salePriceVal,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid
        });

        // B. Credit vehicle asset account — clear it at BOOK VALUE (capitalised cost),
        // not at sale price. This prevents a negative residual balance when expenses
        // have been capitalised onto the asset.
        tx.update(vehicleAccRef, {
          balance: 0, // fully zero-out the asset account
          updatedAt: serverTimestamp(),
          updatedBy: user.uid
        });

        // Profit / Loss on sale (sale price vs book value)
        const bookValue = vehicleAccBal; // current balance = purchase + all expenses
        const saleProfit = salePriceVal - bookValue;

        const vDate = saleDate;

        // C. Voucher: Debit receiving account
        tx.set(doc(collection(db, "vouchers")), {
          voucherNo: "JV-" + Math.floor(100000 + Math.random() * 900000),
          date: vDate,
          accountId: receivingAccountId,
          accountName: receivingAccName,
          type: "debit",
          amount: salePriceVal,
          description: `Sale proceeds: ${vehicle.brandName} ${vehicle.model} (${vehicle.chassisNumber?.slice(-4) || ""}) sold to ${buyerName || "Buyer"}`,
          vehicleId: vehicle.id,
          createdAt: serverTimestamp(),
          createdBy: user.uid
        });

        // D. Voucher: Credit vehicle asset account (at book value, not sale price)
        tx.set(doc(collection(db, "vouchers")), {
          voucherNo: "JV-" + Math.floor(100000 + Math.random() * 900000),
          date: vDate,
          accountId: vehicle.vehicleAccountId,
          accountName: vehicleAccName,
          type: "credit",
          amount: bookValue,
          description: `Vehicle sold: ${vehicle.brandName} ${vehicle.model} — asset cleared at book value Rs. ${bookValue.toLocaleString()}`,
          vehicleId: vehicle.id,
          createdAt: serverTimestamp(),
          createdBy: user.uid
        });

        // E-0. Profit / Loss voucher on vehicle asset account
        if (saleProfit !== 0) {
          tx.set(doc(collection(db, "vouchers")), {
            voucherNo: "JV-" + Math.floor(100000 + Math.random() * 900000),
            date: vDate,
            accountId: vehicle.vehicleAccountId,
            accountName: vehicleAccName,
            type: saleProfit > 0 ? "credit" : "debit",
            amount: Math.abs(saleProfit),
            description: saleProfit > 0
              ? `Profit on sale of ${vehicle.brandName} ${vehicle.model}: Sale Rs. ${salePriceVal.toLocaleString()} − Cost Rs. ${bookValue.toLocaleString()} = +Rs. ${saleProfit.toLocaleString()}`
              : `Loss on sale of ${vehicle.brandName} ${vehicle.model}: Sale Rs. ${salePriceVal.toLocaleString()} − Cost Rs. ${bookValue.toLocaleString()} = −Rs. ${Math.abs(saleProfit).toLocaleString()}`,
            vehicleId: vehicle.id,
            createdAt: serverTimestamp(),
            createdBy: user.uid
          });
        }

        // E. Investor commission vouchers (if applicable)
        if (investorAccRef && commissionAmount > 0) {
          // Debit vehicle asset account (commission as cost)
          tx.set(doc(collection(db, "vouchers")), {
            voucherNo: "JV-" + Math.floor(100000 + Math.random() * 900000),
            date: vDate,
            accountId: vehicle.vehicleAccountId,
            accountName: vehicleAccName,
            type: "debit",
            amount: commissionAmount,
            description: `Investor commission (${vehicle.commissionType === "Percentage" ? vehicle.commissionValue + "% of profit" : "Fixed"}): ${vehicle.investorName}`,
            vehicleId: vehicle.id,
            createdAt: serverTimestamp(),
            createdBy: user.uid
          });

          // Credit investor ledger account (commission payable to investor)
          tx.set(doc(collection(db, "vouchers")), {
            voucherNo: "JV-" + Math.floor(100000 + Math.random() * 900000),
            date: vDate,
            accountId: (investorAccRef as any).id,
            accountName: investorAccName,
            type: "credit",
            amount: commissionAmount,
            description: `Commission earned on sale of ${vehicle.brandName} ${vehicle.model} — ${vehicle.commissionType === "Percentage" ? vehicle.commissionValue + "% of profit Rs." + profit.toLocaleString() : "Fixed PKR " + commissionAmount.toLocaleString()}`,
            vehicleId: vehicle.id,
            createdAt: serverTimestamp(),
            createdBy: user.uid
          });

          // Update investor account balance
          tx.update(investorAccRef, {
            balance: investorAccBal + commissionAmount,
            updatedAt: serverTimestamp(),
            updatedBy: user.uid
          });
        }

        // F. Update vehicle document as sold
        const carRef = doc(db, "cars", vehicle.id);
        tx.update(carRef, {
          isSold: true,
          salePrice: salePriceVal,
          saleDate: vDate,
          buyerName: buyerName.trim() || null,
          buyerPhone: buyerPhone.trim() || null,
          saleAccountId: receivingAccountId,
          commissionPaid: commissionAmount,
          netProfit: profit - commissionAmount,
          currentStatus: "SOLD",
          updatedAt: serverTimestamp()
        });

        // G. Log the sale
        const logRef = doc(collection(db, "logs"));
        tx.set(logRef, {
          action: `Vehicle sold: ${vehicle.brandName} ${vehicle.model} for Rs. ${salePriceVal.toLocaleString()}`,
          performedBy: user.uid,
          timestamp: serverTimestamp(),
          type: "SALE",
          vehicleId: vehicle.id
        });
      });

      setMessage("Success: Vehicle sold! Accounts updated and vouchers generated.");
      setTimeout(() => {
        onClose();
      }, 2000);

    } catch (err: any) {
      console.error("Sale error:", err);
      setMessage(`Error: ${err.message || "Could not process sale."}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign size={18} className="text-primary" />
            Mark Vehicle as Sold
          </DialogTitle>
          <DialogDescription>
            Record the sale of <strong>{vehicle?.brandName} {vehicle?.model} ({vehicle?.modelYear || vehicle?.year})</strong>.
            All accounting entries will be auto-generated.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {message && (
            <div className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2
              ${message.includes("Error") ? "bg-red-50 text-red-700 border border-red-100" : "bg-green-50 text-green-700 border border-green-100"}`}>
              {!message.includes("Error") && <CheckCircle2 size={14} />}
              {message}
            </div>
          )}

          {/* Vehicle Summary */}
          <div className="p-4 bg-muted rounded-xl border border-border space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span className="text-muted-foreground">Vehicle</span>
              <span className="font-semibold">{vehicle?.brandName} {vehicle?.model} · {vehicle?.color}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span className="text-muted-foreground">Purchase Price</span>
              <span>Rs. {Number(vehicle?.purchasePrice || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span className="text-muted-foreground">Total Expenses</span>
              <span>Rs. {Number(vehicle?.totalExpenses || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-semibold text-foreground border-t border-border pt-1.5 mt-1">
              <span>Capitalized Cost</span>
              <span>Rs. {Number(capitalizedCost).toLocaleString()}</span>
            </div>
          </div>

          {/* Sale Form */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Sale Price (PKR) *</label>
              <Input
                type="number"
                value={salePrice}
                onChange={e => setSalePrice(e.target.value)}
                placeholder="Enter sale amount..."
                className="font-semibold"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Sale Date *</label>
              <Input
                type="date"
                value={saleDate}
                onChange={e => setSaleDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Receiving Account (Cash/Bank) *</label>
            <Select value={receivingAccountId} onValueChange={setReceivingAccountId}>
              <SelectTrigger className="bg-card">
                <SelectValue placeholder="Select account to receive funds..." />
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Buyer Name</label>
              <Input value={buyerName} onChange={e => setBuyerName(e.target.value)} placeholder="Optional" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Buyer Phone</label>
              <Input value={buyerPhone} onChange={e => setBuyerPhone(e.target.value)} placeholder="Optional" />
            </div>
          </div>

          {/* Live P&L Preview */}
          {salePriceVal > 0 && (
            <div className="p-4 rounded-xl border space-y-2 bg-gradient-to-br from-slate-50 to-white">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Transaction Preview</h4>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Sale Price</span>
                <span className="font-semibold">Rs. {salePriceVal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Capitalized Cost</span>
                <span className="font-semibold">− Rs. {capitalizedCost.toLocaleString()}</span>
              </div>

              {vehicle?.hasInvestor && commissionAmount > 0 && (
                <div className="flex justify-between text-sm text-primary bg-muted px-2 py-1 rounded-lg">
                  <span className="flex items-center gap-1">
                    <Users size={12} /> Investor Commission ({vehicle.investorName})
                    {vehicle.commissionType === "Percentage" && ` · ${vehicle.commissionValue}%`}
                  </span>
                  <span className="font-semibold">− Rs. {commissionAmount.toLocaleString()}</span>
                </div>
              )}

              <div className={`flex justify-between text-sm font-bold border-t border-border pt-2 mt-1
                ${(profit - commissionAmount) >= 0 ? "text-primary" : "text-red-700"}`}>
                <span className="flex items-center gap-1">
                  {(profit - commissionAmount) >= 0
                    ? <TrendingUp size={14} />
                    : <TrendingDown size={14} />
                  }
                  Net {(profit - commissionAmount) >= 0 ? "Profit" : "Loss"}
                </span>
                <span>Rs. {Math.abs(profit - commissionAmount).toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            className="bg-secondary hover:bg-secondary/90 text-white gap-2"
            onClick={handleSell}
            disabled={saving || salePriceVal <= 0}
          >
            {saving
              ? <><Loader2 size={14} className="animate-spin" />Processing...</>
              : <><CheckCircle2 size={14} />Confirm Sale</>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
