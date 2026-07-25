"use client";
import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy, serverTimestamp, doc, runTransaction } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle2, Loader2, Car, DollarSign, Calendar, Mail, AlertTriangle } from "lucide-react";
import { SearchSelector } from "@/components/ui/SearchSelector";
import { VehicleSelector } from "@/features/inventory/VehicleSelector";
import { useRouter } from "next/navigation";

export const InstallmentPlanForm = () => {
  const { user } = useAuth();
  const router = useRouter();

  // Data
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);

  // Selection
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState<any | null>(null);
  const [buyerAccountId, setBuyerAccountId] = useState("");
  const [receivingAccountId, setReceivingAccountId] = useState("");

  // Configuration
  const [salePrice, setSalePrice] = useState("");
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [installmentMonths, setInstallmentMonths] = useState("12");
  const [monthlyInstallment, setMonthlyInstallment] = useState("");
  const [firstDueDate, setFirstDueDate] = useState("");

  // Email Notification Fields
  const [clientEmail, setClientEmail] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");

  // UI
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Fetch available vehicles
  useEffect(() => {
    const q = query(collection(db, "cars"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const all: any[] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setVehicles(all.filter(v => !v.isSold && v.purchasePrice > 0));
    });
    return () => unsub();
  }, []);

  // Fetch accounts (for buyer and receiving cash)
  useEffect(() => {
    const q = query(collection(db, "accounts"), orderBy("name"));
    const unsub = onSnapshot(q, (snap) => {
      setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // Sync selected vehicle
  useEffect(() => {
    const v = vehicles.find(v => v.id === selectedVehicleId) || null;
    setSelectedVehicle(v);
  }, [selectedVehicleId, vehicles]);

  const handleCreatePlan = async () => {
    if (!user || !selectedVehicle) return;
    if (!buyerAccountId) { setMessage("Error: Please select a buyer ledger account."); return; }
    if (!receivingAccountId) { setMessage("Error: Please select a receiving account for the down payment."); return; }
    
    const totalSalePrice = parseFloat(salePrice) || 0;
    const downPayment = parseFloat(advanceAmount) || 0;
    const mths = parseInt(installmentMonths) || 0;
    const monthlyAmt = parseFloat(monthlyInstallment) || 0;
    
    if (totalSalePrice <= 0) { setMessage("Error: Please enter a valid total sale price."); return; }
    if (mths <= 0) { setMessage("Error: Please enter valid installment months."); return; }
    if (monthlyAmt <= 0) { setMessage("Error: Please enter a valid monthly amount."); return; }
    if (!firstDueDate) { setMessage("Error: Please select the first due date."); return; }

    setLoading(true);
    setMessage("");

    try {
      await runTransaction(db, async (tx) => {
        // --- READ PHASE ---
        const vehicleAccRef = doc(db, "accounts", selectedVehicle.vehicleAccountId);
        const vehicleAccSnap = await tx.get(vehicleAccRef);
        if (!vehicleAccSnap.exists()) throw new Error("Vehicle asset account not found.");
        const vehicleAccBal = vehicleAccSnap.data().balance || 0;

        const buyerAccRef = doc(db, "accounts", buyerAccountId);
        const buyerAccSnap = await tx.get(buyerAccRef);
        if (!buyerAccSnap.exists()) throw new Error("Buyer account not found.");
        const buyerAccBal = buyerAccSnap.data().balance || 0;
        const buyerAccName = buyerAccSnap.data().name;

        const receivingAccRef = doc(db, "accounts", receivingAccountId);
        const receivingAccSnap = await tx.get(receivingAccRef);
        if (!receivingAccSnap.exists()) throw new Error("Receiving account not found.");
        const receivingAccBal = receivingAccSnap.data().balance || 0;
        const receivingAccName = receivingAccSnap.data().name;

        // --- SCHEDULE GENERATION ---
        let schedule = [];
        let currDate = new Date(firstDueDate);
        for (let i = 1; i <= mths; i++) {
          schedule.push({
            id: `inst-${i}`,
            dueDate: currDate.toISOString().split("T")[0],
            amount: monthlyAmt,
            paid: false
          });
          currDate.setMonth(currDate.getMonth() + 1);
        }

        // --- WRITE PHASE ---
        // 1. Mark Vehicle as Sold
        tx.update(doc(db, "cars", selectedVehicle.id), {
          isSold: true,
          salePrice: totalSalePrice,
          saleDate: new Date().toISOString().split("T")[0],
          buyerName: buyerAccName,
          advanceAmount: downPayment,
          balanceAmount: totalSalePrice - downPayment,
          saleAccountId: receivingAccountId,
          currentStatus: "SOLD",
          updatedAt: serverTimestamp()
        });

        // 2. Update Balances
        tx.update(receivingAccRef, {
          balance: receivingAccBal + downPayment,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid
        });

        tx.update(vehicleAccRef, {
          balance: 0,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid
        });

        const remainingBalance = totalSalePrice - downPayment;
        tx.update(buyerAccRef, {
          balance: buyerAccBal + remainingBalance,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid
        });

        // 3. Vouchers
        const vDate = new Date().toISOString().split("T")[0];
        // Down Payment Voucher
        if (downPayment > 0) {
          tx.set(doc(collection(db, "vouchers")), {
            voucherNo: "INST-DP-" + Math.floor(100000 + Math.random() * 900000),
            date: vDate,
            description: `Installment Plan Down Payment: ${selectedVehicle.brandName} ${selectedVehicle.model} \u00b7 Client: ${buyerAccName}`,
            amount: downPayment,
            debit: downPayment,
            credit: 0,
            cashAccountId: receivingAccountId,
            cashAccountName: receivingAccName,
            cashType: "debit",
            cashPreviousBalance: receivingAccBal,
            cashNewBalance: receivingAccBal + downPayment,
            counterAccountId: selectedVehicle.vehicleAccountId,
            counterType: "credit",
            counterPreviousBalance: vehicleAccBal,
            counterNewBalance: vehicleAccBal - downPayment,
            createdAt: serverTimestamp(),
            createdBy: user.uid
          });
        }

        // Installment Loan Balance Voucher
        if (remainingBalance > 0) {
          tx.set(doc(collection(db, "vouchers")), {
            voucherNo: "INST-BAL-" + Math.floor(100000 + Math.random() * 900000),
            date: vDate,
            description: `Installment Plan Balance Loan: ${selectedVehicle.brandName} ${selectedVehicle.model} \u00b7 Client: ${buyerAccName}`,
            amount: remainingBalance,
            debit: remainingBalance,
            credit: 0,
            cashAccountId: buyerAccountId,
            cashAccountName: buyerAccName,
            cashType: "debit",
            cashPreviousBalance: buyerAccBal,
            cashNewBalance: buyerAccBal + remainingBalance,
            counterAccountId: selectedVehicle.vehicleAccountId,
            counterType: "credit",
            counterPreviousBalance: Math.max(0, vehicleAccBal - downPayment),
            counterNewBalance: 0,
            createdAt: serverTimestamp(),
            createdBy: user.uid
          });
        }

        // 4. Create the Installment Plan
        const newPlanRef = doc(collection(db, "installmentPlans"));
        tx.set(newPlanRef, {
          clientId: buyerAccountId,
          clientName: buyerAccName,
          vehicleId: selectedVehicle.id,
          vehicleName: `${selectedVehicle.brandName} ${selectedVehicle.model}`,
          totalAmount: totalSalePrice,
          advancePaid: downPayment,
          outstandingBalance: remainingBalance,
          monthlyInstallmentAmount: monthlyAmt,
          installmentSchedule: schedule,
          status: "active",
          clientEmail: clientEmail.trim() || null,
          ownerEmail: ownerEmail.trim() || null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });

      setMessage("Success: Installment Plan created successfully.");
      setTimeout(() => {
        router.push("/dashboard/installments/plans");
      }, 1500);
    } catch (err: any) {
      console.error("Plan creation error:", err);
      setMessage(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card className="border-border shadow-sm">
        <CardHeader className="border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500 rounded-xl text-white shadow">
              <Calendar size={20} />
            </div>
            <div>
              <CardTitle className="text-lg text-foreground">Create Installment Plan</CardTitle>
              <CardDescription>Setup a new structured payment plan for an available vehicle.</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {message && (
            <div className={`p-3 rounded-lg text-sm font-medium flex items-center gap-2 ${
              message.startsWith("Error")
                ? "bg-red-50 text-red-700 border border-red-100"
                : "bg-green-50 text-green-700 border border-green-100"
            }`}>
              {!message.startsWith("Error") && <CheckCircle2 size={16} />}
              {message.startsWith("Error") && <AlertTriangle size={16} />}
              {message}
            </div>
          )}

          {/* Vehicle Dropdown */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Car size={13} /> Select Vehicle *
            </label>
            <VehicleSelector
              vehicles={vehicles}
              value={selectedVehicleId}
              onChange={setSelectedVehicleId}
              placeholder="Choose a vehicle..."
              showCost={true}
            />
          </div>

          {selectedVehicle && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border">
              {/* Account Selection */}
              <div className="space-y-4">
                <h5 className="text-sm font-bold text-foreground border-b pb-2">Accounts</h5>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Link Client/Buyer Account *</label>
                  <SearchSelector
                    items={accounts}
                    value={buyerAccountId}
                    onChange={setBuyerAccountId}
                    placeholder="Select client account..."
                    searchPlaceholder="Search account..."
                    getSearchFields={(acc) => [acc.name]}
                    itemKey={(acc) => acc.id}
                    renderTrigger={(selected) => selected ? <span>{selected.name}</span> : <span className="text-muted-foreground">Select account...</span>}
                    renderItem={(acc) => <div className="font-medium text-foreground">{acc.name}</div>}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Receiving Account (For Down Payment) *</label>
                  <SearchSelector
                    items={accounts}
                    value={receivingAccountId}
                    onChange={setReceivingAccountId}
                    placeholder="Select cash/bank account..."
                    searchPlaceholder="Search account..."
                    getSearchFields={(acc) => [acc.name]}
                    itemKey={(acc) => acc.id}
                    renderTrigger={(selected) => selected ? <span>{selected.name}</span> : <span className="text-muted-foreground">Select account...</span>}
                    renderItem={(acc) => <div className="font-medium text-foreground">{acc.name}</div>}
                  />
                </div>
              </div>

              {/* Plan Configuration */}
              <div className="space-y-4">
                <h5 className="text-sm font-bold text-foreground border-b pb-2">Financial Setup</h5>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Total Sale Price (PKR) *</label>
                  <Input type="number" value={salePrice} onChange={e => setSalePrice(e.target.value)} placeholder="0" className="h-10" />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Down Payment (Advance) *</label>
                  <Input type="number" value={advanceAmount} onChange={e => setAdvanceAmount(e.target.value)} placeholder="0" className="h-10" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Duration (Months) *</label>
                    <Input type="number" value={installmentMonths} onChange={e => setInstallmentMonths(e.target.value)} placeholder="12" className="h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Monthly Amount *</label>
                    <Input type="number" value={monthlyInstallment} onChange={e => setMonthlyInstallment(e.target.value)} placeholder="0" className="h-10" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">First Installment Due Date *</label>
                  <Input type="date" value={firstDueDate} onChange={e => setFirstDueDate(e.target.value)} className="h-10" />
                </div>
              </div>

              {/* Email Notifications Configuration */}
              <div className="md:col-span-2 p-5 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 rounded-xl space-y-4 mt-2">
                <h5 className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wide flex items-center gap-1.5">
                  <Mail size={14} /> Automated Email Notifications
                </h5>
                <p className="text-xs text-muted-foreground mb-2">Configure email addresses to automatically receive reminders on each installment's due date.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                   <div className="space-y-1.5">
                     <label className="text-xs font-semibold text-foreground dark:text-slate-300">Client Email (For Reminders)</label>
                     <Input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="client@example.com" className="h-10 bg-background" />
                     <p className="text-[10px] text-muted-foreground">Client gets a reminder to pay the monthly installment.</p>
                   </div>
                   <div className="space-y-1.5">
                     <label className="text-xs font-semibold text-foreground dark:text-slate-300">Owner/Admin Email (For Recovery)</label>
                     <Input type="email" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} placeholder="admin@zohaibmotors.com" className="h-10 bg-background" />
                     <p className="text-[10px] text-muted-foreground">Owner gets an alert to recover the payment for this vehicle.</p>
                   </div>
                </div>
              </div>

            </div>
          )}

          {/* Submit Button */}
          {selectedVehicle && (
            <div className="pt-4 flex justify-end border-t border-border mt-6">
              <Button
                onClick={handleCreatePlan}
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white h-11 px-8 gap-2 font-semibold shadow-sm"
              >
                {loading
                  ? <><Loader2 size={16} className="animate-spin" /> Generating Plan...</>
                  : <><CheckCircle2 size={16} /> Finalize Installment Plan</>
                }
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
