"use client";
import { useState, useEffect } from "react";
import {
  collection, onSnapshot, query, orderBy, serverTimestamp,
  doc, runTransaction, updateDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  CheckCircle2, Loader2, Car, DollarSign, Users, Wallet,
  FileText, Info, TrendingUp, TrendingDown, AlertTriangle, ShoppingBag
} from "lucide-react";
import { UserPlus, Eye, Trash2, Printer } from "lucide-react";
import { SearchSelector } from "@/components/ui/SearchSelector";
import { VehicleSelector } from "@/features/inventory/VehicleSelector";
import { QuickAddClientDialog } from "./QuickAddClientDialog";
import { VehicleDetailModal } from "@/features/inventory/VehicleDetailModal";
import { SaleInvoicePrintModal } from "./SaleInvoicePrintModal";

export const SaleInvoiceManager = () => {
  const { user } = useAuth();

  // Data
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);

  // Selection
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState<any | null>(null);

  // Sale fields
  const [salePrice, setSalePrice] = useState("");
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split("T")[0]);
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [receivingAccountId, setReceivingAccountId] = useState("");
  const [saleRegNo, setSaleRegNo] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerFatherName, setOwnerFatherName] = useState("");
  const [ownerCnic, setOwnerCnic] = useState("");

  // Installment fields
  const [isInstallment, setIsInstallment] = useState(false);
  const [downPayment, setDownPayment] = useState("");
  const [monthsPeriod, setMonthsPeriod] = useState("");
  const [installmentEndDate, setInstallmentEndDate] = useState("");
  const [monthlyDueAmount, setMonthlyDueAmount] = useState("");
  const [remainingAmount, setRemainingAmount] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");

  // Invoice history
  const [saleInvoices, setSaleInvoices] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewingVehicle, setViewingVehicle] = useState<any | null>(null);
  const [printingInvoice, setPrintingInvoice] = useState<any | null>(null);

  // UI
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showQuickAddClient, setShowQuickAddClient] = useState(false);

  // Fetch vehicles
  useEffect(() => {
    const q = query(collection(db, "cars"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const all: any[] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setVehicles(all.filter(v => !v.isSold && v.purchasePrice > 0));
      setSaleInvoices(all.filter(v => v.isSold));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "accounts"), orderBy("name"));
    const unsub = onSnapshot(q, (snap) => {
      setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // Sync selected vehicle object
  useEffect(() => {
    const v = vehicles.find(v => v.id === selectedVehicleId) || null;
    setSelectedVehicle(v);
    setSalePrice("");
    setBuyerName("");
    setBuyerPhone("");
    setReceivingAccountId("");
    setSaleRegNo(v?.registrationNumber || "");
    setOwnerName("");
    setOwnerFatherName("");
    setOwnerCnic("");
    setIsInstallment(false);
    setDownPayment("");
    setMonthsPeriod("");
    setInstallmentEndDate("");
    setMonthlyDueAmount("");
    setRemainingAmount("");
    setClientPhone("");
    setClientEmail("");
    setMessage("");
  }, [selectedVehicleId, vehicles]);

  // Recalculate remaining amount for installments
  useEffect(() => {
    if (isInstallment && salePrice) {
      const down = parseFloat(downPayment) || 0;
      const total = parseFloat(salePrice) || 0;
      setRemainingAmount((total - down).toString());
    }
  }, [salePrice, downPayment, isInstallment]);

  // Recalculate installment end date
  useEffect(() => {
    if (isInstallment && saleDate && monthsPeriod) {
      const months = parseInt(monthsPeriod) || 0;
      if (months > 0) {
        const date = new Date(saleDate);
        date.setMonth(date.getMonth() + months);
        setInstallmentEndDate(date.toISOString().split("T")[0]);
      } else {
        setInstallmentEndDate("");
      }
    }
  }, [saleDate, monthsPeriod, isInstallment]);

  // Recalculate monthly due amount
  useEffect(() => {
    if (isInstallment && remainingAmount && monthsPeriod) {
      const rem = parseFloat(remainingAmount) || 0;
      const months = parseInt(monthsPeriod) || 0;
      if (months > 0) {
        setMonthlyDueAmount(Math.ceil(rem / months).toString());
      } else {
        setMonthlyDueAmount("");
      }
    }
  }, [remainingAmount, monthsPeriod, isInstallment]);

  const salePriceVal = parseFloat(salePrice) || 0;
  const capitalizedCost = selectedVehicle?.capitalizedCost || selectedVehicle?.purchasePrice || 0;
  const profit = salePriceVal - capitalizedCost;

  const commissionAmount = 0;

  const handleCreateSaleInvoice = async () => {
    if (!user || !selectedVehicle) return;
    if (salePriceVal <= 0) { setMessage("Error: Please enter a valid sale price."); return; }
    if (!receivingAccountId) { setMessage("Error: Please select the Customer account."); return; }
    if (!selectedVehicle.vehicleAccountId) { setMessage("Error: This vehicle does not have a linked ledger account. Generate a Purchase Invoice first."); return; }

    setLoading(true);
    setMessage("");

    try {
      await runTransaction(db, async (tx) => {
        // --- READ PHASE ---

        // 1. Vehicle asset account
        const vehicleAccRef = doc(db, "accounts", selectedVehicle.vehicleAccountId);
        const vehicleAccSnap = await tx.get(vehicleAccRef);
        if (!vehicleAccSnap.exists()) throw new Error("Vehicle asset account not found.");
        const vehicleAccName = vehicleAccSnap.data().name;
        const vehicleAccBal = vehicleAccSnap.data().balance || 0;

        // 2. Receiving account
        const receivingAccRef = doc(db, "accounts", receivingAccountId);
        const receivingAccSnap = await tx.get(receivingAccRef);
        if (!receivingAccSnap.exists()) throw new Error("Receiving account not found.");
        const receivingAccName = receivingAccSnap.data().name;
        const receivingAccBal = receivingAccSnap.data().balance || 0;



        // --- WRITE PHASE ---
        const vDate = saleDate;
        const bookValue = vehicleAccBal;
        const saleProfit = salePriceVal - bookValue;

        // \u2500\u2500 VOUCHER 1: Main Sale \u2014 Cash/Bank IN \u2194 Vehicle Asset OUT \u2500\u2500
        // Receiving account (cash/bank) DEBITED \u2014 money comes IN
        const receivingPrevBal = receivingAccBal;
        const receivingNewBal = receivingAccBal + salePriceVal;
        // Vehicle asset account CREDITED \u2014 asset leaves
        const vehiclePrevBal = vehicleAccBal;
        const vehicleNewBal = 0;

        tx.update(receivingAccRef, {
          balance: receivingNewBal,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid
        });
        tx.update(vehicleAccRef, {
          balance: vehicleNewBal,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid
        });

        const invoiceId = "SI-" + Math.floor(100000 + Math.random() * 900000);

        // Single double-entry voucher: cash account (debit) ↔ vehicle asset (credit)
        tx.set(doc(collection(db, "vouchers")), {
          voucherNo: invoiceId,
          date: vDate,
          description: `Sale Invoice: ${selectedVehicle.brandName} ${selectedVehicle.model} · Chassis: ${selectedVehicle.chassisNumber?.slice(-4) || ""} · Buyer: ${buyerName || "N/A"} · Reg: ${selectedVehicle.registrationNumber || "Unregistered"}`,
          amount: salePriceVal,
          debit: salePriceVal,
          credit: 0,
          // Cash/bank leg (money IN \u2192 debit)
          cashAccountId: receivingAccountId,
          cashAccountName: receivingAccName,
          cashType: "debit",
          cashPreviousBalance: receivingPrevBal,
          cashNewBalance: receivingNewBal,
          // Vehicle asset leg (asset cleared \u2192 credit)
          counterAccountId: selectedVehicle.vehicleAccountId,
          counterAccountName: vehicleAccName,
          counterType: "credit",
          counterPreviousBalance: vehiclePrevBal,
          counterNewBalance: vehicleNewBal,
          // Backward compat
          accountId: receivingAccountId,
          accountName: receivingAccName,
          type: "debit",
          previousBalance: receivingPrevBal,
          newBalance: receivingNewBal,
          vehicleId: selectedVehicle.id,
          invoiceType: "SALE",
          saleProfit,
          buyerName: buyerName.trim() || null,
          buyerPhone: buyerPhone.trim() || null,
          ownerName: ownerName.trim() || null,
          ownerFatherName: ownerFatherName.trim() || null,
          ownerCnic: ownerCnic.trim() || null,
          createdAt: serverTimestamp(),
          createdBy: user.uid
        });

        // ──

        // G. Mark vehicle as sold
        const carRef = doc(db, "cars", selectedVehicle.id);
        const updateData: any = {
          isSold: true,
          salePrice: salePriceVal,
          saleDate: vDate,
          buyerName: buyerName.trim() || null,
          buyerPhone: buyerPhone.trim() || null,
          ownerName: ownerName.trim() || null,
          ownerFatherName: ownerFatherName.trim() || null,
          ownerCnic: ownerCnic.trim() || null,
          saleAccountId: receivingAccountId,
          commissionPaid: 0,
          netProfit: profit,
          currentStatus: "SOLD",
          updatedAt: serverTimestamp()
        };
        
        if (saleRegNo !== (selectedVehicle.registrationNumber || "")) {
            updateData.registrationNumber = saleRegNo;
        }

        tx.update(carRef, updateData);

        // I. Installment Plan
        if (isInstallment) {
            const dp = parseFloat(downPayment) || 0;
            const remaining = parseFloat(remainingAmount) || 0;
            const months = parseInt(monthsPeriod) || 0;
            const monthlyDue = parseFloat(monthlyDueAmount) || 0;
            
            // --- SCHEDULE GENERATION ---
            let schedule = [];
            let currDate = new Date(vDate);
            currDate.setMonth(currDate.getMonth() + 1); // first payment due next month
            
            for (let i = 1; i <= months; i++) {
              schedule.push({
                id: `inst-${i}`,
                dueDate: currDate.toISOString().split("T")[0],
                amount: monthlyDue,
                paid: false
              });
              currDate.setMonth(currDate.getMonth() + 1);
            }

            const planRef = doc(collection(db, "installmentPlans"));
            tx.set(planRef, {
                clientId: receivingAccountId,
                clientName: buyerName.trim() || "Unknown",
                clientPhone: clientPhone.trim() || buyerPhone.trim() || "",
                clientEmail: clientEmail.trim() || null,
                vehicleId: selectedVehicle.id,
                vehicleName: `${selectedVehicle.brandName} ${selectedVehicle.model}`,
                totalAmount: salePriceVal,
                downPayment: dp,
                remainingAmount: remaining,
                monthsPeriod: months,
                monthlyDueAmount: monthlyDue,
                totalReceived: 0,
                startDate: vDate,
                endDate: installmentEndDate || null,
                installmentSchedule: schedule,
                status: "active",
                invoiceId: invoiceId,
                createdAt: serverTimestamp(),
                createdBy: user.uid
            });
        }

        // H. Log
        tx.set(doc(collection(db, "logs")), {
          action: `Sale Invoice: ${selectedVehicle.brandName} ${selectedVehicle.model} for Rs. ${salePriceVal.toLocaleString()}`,
          performedBy: user.uid,
          timestamp: serverTimestamp(),
          type: "SALE_INVOICE",
          vehicleId: selectedVehicle.id
        });
      });

      setMessage(`Success: Sale invoice created for ${selectedVehicle.brandName} ${selectedVehicle.model}. Vehicle marked as sold.`);
      setSelectedVehicleId("");
    } catch (err: any) {
      console.error("Sale invoice error:", err);
      setMessage(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const InfoRow = ({ label, value }: { label: string; value: any }) => (
    <div className="flex justify-between items-center py-1.5 border-b border-border last:border-0">
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      <span className="text-xs font-semibold text-foreground">{value || "—"}</span>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card className="bg-card border-border shadow-xl">
        <CardHeader className="border-b border-border bg-muted">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-secondary text-primary rounded-xl shadow-inner border border-primary/20">
              <ShoppingBag size={20} />
            </div>
            <div>
              <CardTitle className="text-lg text-foreground">Sale Invoice</CardTitle>
              <CardDescription className="text-muted-foreground">Select an available vehicle and record its sale. Only purchased (invoiced) vehicles are shown.</CardDescription>
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
              <Car size={13} /> Select Vehicle (Available for Sale) *
            </label>
            {vehicles.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-xs border border-dashed border-slate-200 rounded-lg">No available vehicles found. Generate a Purchase Invoice first.</div>
            ) : (
              <VehicleSelector
                vehicles={vehicles}
                value={selectedVehicleId}
                onChange={setSelectedVehicleId}
                placeholder="Choose a vehicle to sell..."
                showCost={true}
              />
            )}
            {vehicles.length === 0 && (
              <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                <AlertTriangle size={12} /> All vehicles are either sold or haven't had a Purchase Invoice generated yet.
              </p>
            )}
          </div>

          {/* Vehicle Details */}
          {selectedVehicle && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Left: Vehicle Info */}
              <div className="bg-muted rounded-xl border border-border p-4 space-y-0.5">
                <div className="flex items-center gap-2 mb-3">
                  <Info size={14} className="text-muted-foreground" />
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Vehicle Details</span>
                </div>
                <InfoRow label="Brand & Model" value={`${selectedVehicle.brandName} ${selectedVehicle.model}`} />
                <InfoRow label="Variant" value={selectedVehicle.variant} />
                <InfoRow label="Year" value={selectedVehicle.modelYear || selectedVehicle.year} />
                <InfoRow label="Color" value={selectedVehicle.color} />
                <InfoRow label="Fuel Type" value={selectedVehicle.fuelType} />
                <InfoRow label="Transmission" value={selectedVehicle.transmission} />
                <InfoRow label="Chassis No." value={selectedVehicle.chassisNumber} />
                <InfoRow label="Engine No." value={selectedVehicle.engineNumber} />
                <InfoRow label="Registration No." value={selectedVehicle.registrationNumber} />
              </div>

              {/* Right: Financial Info */}
              <div className="bg-muted rounded-xl border border-border p-4 space-y-0.5">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign size={14} className="text-muted-foreground" />
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Cost Details</span>
                </div>
                <InfoRow label="Purchase Price" value={`Rs. ${Number(selectedVehicle.purchasePrice || 0).toLocaleString()}`} />
                <InfoRow label="Total Expenses" value={`Rs. ${Number(selectedVehicle.totalExpenses || 0).toLocaleString()}`} />
                <InfoRow label="Capitalized Cost" value={`Rs. ${Number(capitalizedCost).toLocaleString()}`} />
                <InfoRow label="Payment Status" value={selectedVehicle.isPaid ? "Paid" : "Unpaid"} />
                <InfoRow label="Seller" value={selectedVehicle.sellerClientName} />
              </div>
            </div>
          )}

          {/* Sale Form */}
          {selectedVehicle && (
            <div className="space-y-5 pt-2 border-t border-border">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-secondary rounded-md text-primary border border-primary/20"><DollarSign size={14} /></div>
                <h4 className="text-sm font-bold text-foreground uppercase tracking-wider">Sale Details</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Sale Price (PKR) *</label>
                  <Input
                    type="number"
                    placeholder="Enter sale amount..."
                    value={salePrice}
                    onChange={e => setSalePrice(e.target.value)}
                    className="font-semibold h-10 bg-card text-foreground border-border placeholder:text-muted-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Sale Date *</label>
                  <Input
                    type="date"
                    value={saleDate}
                    onChange={e => setSaleDate(e.target.value)}
                    className="h-10 bg-card text-foreground border-border text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Users size={12} /> Customer *
                </label>
                <SearchSelector
                  className="bg-card text-foreground border-border hover:bg-muted"
                  items={accounts}
                  value={receivingAccountId}
                  onChange={(val) => {
                    setReceivingAccountId(val);
                    const acc = accounts.find(a => a.id === val);
                    if (acc) {
                      setOwnerName(acc.name || "");
                      setOwnerFatherName(acc.fatherName || "");
                      setOwnerCnic(acc.cnic || "");
                      setBuyerName(acc.name || "");
                      const phoneVal = acc.phone || acc.phoneNumber || "";
                      setBuyerPhone(phoneVal);
                      setClientPhone(phoneVal);
                      setClientEmail(acc.email || "");
                    }
                  }}
                  placeholder="Select customer account..."
                  searchPlaceholder="Search account..."
                  getSearchFields={(acc) => [acc.name, acc.shopName, acc.typeName]}
                  itemKey={(acc) => acc.id}
                  renderTrigger={(selected) =>
                    selected ? (
                      <span>
                        {selected.name} <span className="text-muted-foreground text-xs ml-1">(Rs. {Number(selected.balance).toLocaleString()})</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Select seller account...</span>
                    )
                  }
                  renderItem={(acc) => (
                    <div className="flex justify-between items-center w-full text-left">
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{acc.name}</span>
                        {acc.shopName && <span className="text-[10px] text-muted-foreground">{acc.shopName}</span>}
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">Rs. {Number(acc.balance).toLocaleString()}</span>
                    </div>
                  )}
                  actionNode={
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full justify-start text-primary hover:text-primary hover:bg-primary/10 h-9 px-2"
                      onClick={() => setShowQuickAddClient(true)}
                    >
                      <UserPlus size={16} className="mr-2" /> Add New Client
                    </Button>
                  }
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Buyer Name (Optional)</label>
                  <Input
                    value={buyerName}
                    onChange={e => setBuyerName(e.target.value)}
                    placeholder="e.g. Ahmed Khan"
                    className="h-10 bg-card text-foreground border-border placeholder:text-muted-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Registration No.</label>
                  <Input
                    value={saleRegNo}
                    onChange={e => setSaleRegNo(e.target.value)}
                    placeholder="e.g. ABC-123"
                    className="h-10 bg-card text-foreground border-border placeholder:text-muted-foreground uppercase"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-border mt-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 bg-secondary rounded-md text-primary border border-primary/20"><FileText size={14} /></div>
                  <h4 className="text-sm font-bold text-foreground uppercase tracking-wider">Registration / Owner Details</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Owner Name</label>
                    <Input
                      value={ownerName}
                      onChange={e => setOwnerName(e.target.value)}
                      placeholder="e.g. Ahmed Khan"
                      className="h-10 bg-card text-foreground border-border placeholder:text-muted-foreground"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Father Name</label>
                    <Input
                      value={ownerFatherName}
                      onChange={e => setOwnerFatherName(e.target.value)}
                      placeholder="e.g. Ali Khan"
                      className="h-10 bg-card text-foreground border-border placeholder:text-muted-foreground"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">CNIC Number</label>
                    <Input
                      value={ownerCnic}
                      onChange={e => setOwnerCnic(e.target.value)}
                      placeholder="e.g. 12345-1234567-1"
                      className="h-10 bg-card text-foreground border-border placeholder:text-muted-foreground"
                    />
                  </div>
                </div>
              </div>

              {/* Installment Toggle & Fields */}
              <div className="pt-2 border-t border-border mt-4">
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="checkbox"
                    id="installments-toggle"
                    checked={isInstallment}
                    onChange={e => setIsInstallment(e.target.checked)}
                    className="w-4 h-4 rounded border-border"
                  />
                  <label htmlFor="installments-toggle" className="text-sm font-bold text-foreground cursor-pointer">
                    Enable Installment Plan
                  </label>
                </div>

                {isInstallment && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 border border-border rounded-xl">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Down Payment (PKR) *</label>
                      <Input
                        type="number"
                        value={downPayment}
                        onChange={e => setDownPayment(e.target.value)}
                        placeholder="e.g. 500000"
                        className="h-10 bg-card text-foreground border-border"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Remaining Amount</label>
                      <Input
                        type="number"
                        value={remainingAmount}
                        onChange={e => setRemainingAmount(e.target.value)}
                        className="h-10 bg-card text-foreground border-border"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Months Period *</label>
                      <Input
                        type="number"
                        value={monthsPeriod}
                        onChange={e => setMonthsPeriod(e.target.value)}
                        placeholder="e.g. 12"
                        className="h-10 bg-card text-foreground border-border"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">End Date</label>
                      <Input
                        type="date"
                        value={installmentEndDate}
                        onChange={e => setInstallmentEndDate(e.target.value)}
                        className="h-10 bg-card text-foreground border-border text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Monthly Due Amount (Calculated)</label>
                      <div className="h-10 px-3 flex items-center bg-muted text-foreground border border-border rounded-md text-sm font-semibold">
                        Rs. {Number(monthlyDueAmount || 0).toLocaleString()}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Client Phone (WhatsApp) *</label>
                      <Input
                        type="text"
                        value={clientPhone}
                        onChange={e => setClientPhone(e.target.value)}
                        placeholder="e.g. 03001234567"
                        className="h-10 bg-card text-foreground border-border"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Client Email</label>
                      <Input
                        type="email"
                        value={clientEmail}
                        onChange={e => setClientEmail(e.target.value)}
                        placeholder="e.g. client@email.com"
                        className="h-10 bg-card text-foreground border-border"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* P&L Preview */}
              {salePriceVal > 0 && (
                <div className="p-4 bg-muted/50 rounded-xl border border-border">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Transaction Preview</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sale Price</span>
                      <span className="font-semibold text-primary">Rs. {salePriceVal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Capitalized Cost</span>
                      <span className="font-semibold text-foreground">− Rs. {capitalizedCost.toLocaleString()}</span>
                    </div>
                    <div className={`flex justify-between font-bold border-t border-border pt-2 mt-1 ${
                      profit >= 0 ? "text-primary" : "text-red-400"
                    }`}>
                      <span className="flex items-center gap-1">
                        {profit >= 0
                          ? <TrendingUp size={14} />
                          : <TrendingDown size={14} />
                        }
                        Net {profit >= 0 ? "Profit" : "Loss"}
                      </span>
                      <span>Rs. {Math.abs(profit).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Submit Button */}
          {selectedVehicle && (
            <div className="pt-2 flex justify-end">
              <Button
                onClick={handleCreateSaleInvoice}
                disabled={loading || salePriceVal <= 0 || !receivingAccountId}
                className="bg-secondary hover:bg-secondary/90 text-white h-11 px-8 gap-2 font-semibold"
              >
                {loading
                  ? <><Loader2 size={16} className="animate-spin" /> Processing...</>
                  : <><CheckCircle2 size={16} /> Confirm Sale Invoice</>
                }
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Sale Invoices History Table ── */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-secondary text-primary rounded-xl shadow-inner border border-primary/20">
              <ShoppingBag size={18} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Sale Invoice History</h2>
              <p className="text-xs text-muted-foreground">All vehicles sold with full financial details</p>
            </div>
            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/100/10 text-primary border border-primary/20">
              {saleInvoices.length} sold
            </span>
          </div>
          <input
            type="text"
            placeholder="Search by vehicle, buyer..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="h-9 px-3 text-sm border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary w-64"
          />
        </div>

        {saleInvoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-card border border-dashed border-border rounded-2xl text-muted-foreground">
            <ShoppingBag size={36} className="mb-3 opacity-30" />
            <p className="font-medium text-sm text-muted-foreground">No sale invoices generated yet</p>
            <p className="text-xs mt-1">Complete a sale using the form above to see it here.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border shadow-lg bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border text-foreground">
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">#</th>
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">Vehicle</th>
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">Chassis No.</th>
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">Buyer</th>
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">Sale Date</th>
                    <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wide">Cost</th>
                    <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wide">Sale Price</th>
                    <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wide">Net P&L</th>
                    <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {saleInvoices
                    .filter(inv => {
                      if (!searchTerm) return true;
                      const s = searchTerm.toLowerCase();
                      return (
                        `${inv.brandName} ${inv.model}`.toLowerCase().includes(s) ||
                        (inv.chassisNumber || "").toLowerCase().includes(s) ||
                        (inv.buyerName || "").toLowerCase().includes(s)
                      );
                    })
                    .map((inv, idx) => {
                      const cost = Number(inv.capitalizedCost || inv.purchasePrice || 0);
                      const sale = Number(inv.salePrice || 0);
                      const netPL = Number(inv.netProfit ?? (sale - cost));
                      const isProfit = netPL >= 0;
                      return (
                        <tr key={inv.id} className="hover:bg-muted/50 transition-colors duration-150">
                          <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{idx + 1}</td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-foreground">{inv.brandName} {inv.model}</div>
                            <div className="text-xs text-muted-foreground">{inv.modelYear || inv.year} · {inv.color}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded text-foreground">
                              {inv.chassisNumber || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-foreground text-xs">
                            <div className="font-medium">{inv.buyerName || <span className="text-zinc-600">—</span>}</div>
                            {inv.buyerPhone && <div className="text-muted-foreground">{inv.buyerPhone}</div>}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">
                            {inv.saleDate || "—"}
                          </td>
                          <td className="px-4 py-3 text-right text-muted-foreground text-xs">
                            Rs. {cost.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-bold text-primary text-sm">
                              Rs. {sale.toLocaleString()}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-right">
                            <span className={`font-bold text-sm flex items-center justify-end gap-1 ${
                              isProfit ? "text-primary" : "text-red-400"
                            }`}>
                              {isProfit ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                              {isProfit ? "+" : "-"}Rs. {Math.abs(netPL).toLocaleString()}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => setViewingVehicle(inv)} className="h-8 w-8 text-muted-foreground hover:text-primary" title="View Details">
                                <Eye size={16} />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => setPrintingInvoice(inv)} className="h-8 w-8 text-muted-foreground hover:text-blue-600 hover:bg-blue-50" title="Print Invoice">
                                <Printer size={16} />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => {
                                  if (confirm("Are you sure you want to delete this sale invoice? The vehicle will be reverted to SHOWROOM status.")) {
                                    const carRef = doc(db, "cars", inv.id);
                                    updateDoc(carRef, {
                                      isSold: false,
                                      salePrice: null,
                                      saleDate: null,
                                      buyerName: null,
                                      buyerPhone: null,
                                      ownerName: null,
                                      ownerFatherName: null,
                                      ownerCnic: null,
                                      saleAccountId: null,
                                      netProfit: null,
                                      currentStatus: "SHOWROOM"
                                    });
                                  }
                              }} className="h-8 w-8 text-muted-foreground hover:text-red-600">
                                <Trash2 size={16} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            {saleInvoices.filter(inv => {
              if (!searchTerm) return true;
              const s = searchTerm.toLowerCase();
              return `${inv.brandName} ${inv.model}`.toLowerCase().includes(s) || (inv.buyerName || "").toLowerCase().includes(s);
            }).length === 0 && (
              <div className="p-8 text-center text-muted-foreground text-sm">No invoices match your search.</div>
            )}
            {/* Footer summary */}
            <div className="px-4 py-3 bg-muted border-t border-border flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                {saleInvoices.length} vehicle{saleInvoices.length !== 1 ? "s" : ""} sold
              </span>
              <div className="flex gap-6">
                <span className="text-xs text-muted-foreground">
                  Total Revenue: <strong className="text-primary">
                    Rs. {saleInvoices.reduce((s, i) => s + (Number(i.salePrice) || 0), 0).toLocaleString()}
                  </strong>
                </span>
                <span className="text-xs text-muted-foreground">
                  Net Profit: <strong className="text-primary">
                    Rs. {saleInvoices.reduce((s, i) => s + (Number(i.netProfit) || 0), 0).toLocaleString()}
                  </strong>
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <QuickAddClientDialog
        open={showQuickAddClient}
        onClose={() => setShowQuickAddClient(false)}
        onCreated={(accountId) => setReceivingAccountId(accountId)}
      />

      <VehicleDetailModal
        isOpen={!!viewingVehicle}
        onClose={() => setViewingVehicle(null)}
        vehicle={viewingVehicle}
      />

      <SaleInvoicePrintModal
        isOpen={!!printingInvoice}
        onClose={() => setPrintingInvoice(null)}
        invoice={printingInvoice}
      />
    </div>
  );
};
