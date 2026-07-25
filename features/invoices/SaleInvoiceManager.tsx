"use client";
import { useState, useEffect } from "react";
import {
  collection, onSnapshot, query, orderBy, serverTimestamp,
  doc, runTransaction
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
import { SearchSelector } from "@/components/ui/SearchSelector";
import { VehicleSelector } from "@/features/inventory/VehicleSelector";
import { QuickAddClientDialog } from "./QuickAddClientDialog";
import { UserPlus } from "lucide-react";

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

  // Invoice history
  const [saleInvoices, setSaleInvoices] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

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
    setMessage("");
  }, [selectedVehicleId, vehicles]);

  const salePriceVal = parseFloat(salePrice) || 0;
  const capitalizedCost = selectedVehicle?.capitalizedCost || selectedVehicle?.purchasePrice || 0;
  const profit = salePriceVal - capitalizedCost;

  let commissionAmount = 0;
  if (selectedVehicle?.hasInvestor && selectedVehicle?.commissionType && selectedVehicle?.commissionValue) {
    if (selectedVehicle.commissionType === "Percentage") {
      commissionAmount = profit > 0 ? (profit * selectedVehicle.commissionValue) / 100 : 0;
    } else {
      commissionAmount = selectedVehicle.commissionValue || 0;
    }
  }

  const handleCreateSaleInvoice = async () => {
    if (!user || !selectedVehicle) return;
    if (salePriceVal <= 0) { setMessage("Error: Please enter a valid sale price."); return; }
    if (!receivingAccountId) { setMessage("Error: Please select the receiving account."); return; }
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

        // 3. Investor account (if applicable)
        let investorAccRef: any = null;
        let investorAccName = "";
        let investorAccBal = 0;
        if (selectedVehicle.hasInvestor && selectedVehicle.investorId && commissionAmount > 0) {
          const investorDocRef = doc(db, "investors", selectedVehicle.investorId);
          const investorDocSnap = await tx.get(investorDocRef);
          if (!investorDocSnap.exists()) throw new Error("Investor profile not found.");
          const investorAccountId = investorDocSnap.data().accountId;
          if (!investorAccountId) throw new Error("Investor does not have a linked ledger account.");
          investorAccRef = doc(db, "accounts", investorAccountId);
          const investorAccSnap = await tx.get(investorAccRef);
          if (!investorAccSnap.exists()) throw new Error("Investor ledger account not found.");
          const invAccData = investorAccSnap.data() as any;
          investorAccName = invAccData?.name || "";
          investorAccBal = invAccData?.balance || 0;
        }

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

        // Single double-entry voucher: cash account (debit) \u2194 vehicle asset (credit)
        tx.set(doc(collection(db, "vouchers")), {
          voucherNo: "SI-" + Math.floor(100000 + Math.random() * 900000),
          date: vDate,
          description: `Sale Invoice: ${selectedVehicle.brandName} ${selectedVehicle.model} \u00b7 Chassis: ${selectedVehicle.chassisNumber?.slice(-4) || ""} \u00b7 Buyer: ${buyerName || "N/A"} \u00b7 Reg: ${selectedVehicle.registrationNumber || "Unregistered"}`,
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
          createdAt: serverTimestamp(),
          createdBy: user.uid
        });

        // \u2500\u2500 VOUCHER 2 (optional): Investor Commission \u2014 Cash OUT \u2194 Investor Account IN \u2500\u2500
        if (investorAccRef && commissionAmount > 0) {
          const invPrevBal = investorAccBal;
          const invNewBal = investorAccBal + commissionAmount;
          // Commission comes from the receiving/cash account
          const cashAfterCommission = receivingNewBal - commissionAmount;

          tx.update(receivingAccRef, {
            balance: cashAfterCommission,
            updatedAt: serverTimestamp(),
            updatedBy: user.uid
          });
          tx.update(investorAccRef, {
            balance: invNewBal,
            updatedAt: serverTimestamp(),
            updatedBy: user.uid
          });

          tx.set(doc(collection(db, "vouchers")), {
            voucherNo: "SI-" + Math.floor(100000 + Math.random() * 900000),
            date: vDate,
            description: `Investor Commission (${selectedVehicle.commissionType === "Percentage" ? selectedVehicle.commissionValue + "% of profit" : "Fixed"}) \u2014 ${selectedVehicle.investorName} \u00b7 Vehicle: ${selectedVehicle.brandName} ${selectedVehicle.model}`,
            amount: commissionAmount,
            debit: 0,
            credit: commissionAmount,
            // Cash account leg (commission paid out \u2192 credit)
            cashAccountId: receivingAccountId,
            cashAccountName: receivingAccName,
            cashType: "credit",
            cashPreviousBalance: receivingNewBal,
            cashNewBalance: cashAfterCommission,
            // Investor account leg (commission received \u2192 debit)
            counterAccountId: investorAccRef.id,
            counterAccountName: investorAccName,
            counterType: "debit",
            counterPreviousBalance: invPrevBal,
            counterNewBalance: invNewBal,
            // Backward compat
            accountId: receivingAccountId,
            accountName: receivingAccName,
            type: "credit",
            previousBalance: receivingNewBal,
            newBalance: cashAfterCommission,
            vehicleId: selectedVehicle.id,
            invoiceType: "SALE_COMMISSION",
            createdAt: serverTimestamp(),
            createdBy: user.uid
          });
        }

        // G. Mark vehicle as sold
        const carRef = doc(db, "cars", selectedVehicle.id);
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
    <div className="flex justify-between items-center py-1.5 border-b border-slate-50 last:border-0">
      <span className="text-xs text-slate-400 font-medium">{label}</span>
      <span className="text-xs font-semibold text-slate-800">{value || "—"}</span>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600 rounded-xl text-white shadow">
              <ShoppingBag size={20} />
            </div>
            <div>
              <CardTitle className="text-lg text-slate-900">Sale Invoice</CardTitle>
              <CardDescription>Select an available vehicle and record its sale. Only purchased (invoiced) vehicles are shown.</CardDescription>
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
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
              <Car size={13} /> Select Vehicle (Available for Sale) *
            </label>
            {vehicles.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-lg">No available vehicles found. Generate a Purchase Invoice first.</div>
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
              <div className="bg-slate-50 rounded-xl border border-slate-100 p-4 space-y-0.5">
                <div className="flex items-center gap-2 mb-3">
                  <Info size={14} className="text-slate-400" />
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Vehicle Details</span>
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
              <div className="bg-slate-50 rounded-xl border border-slate-100 p-4 space-y-0.5">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign size={14} className="text-slate-400" />
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Cost & Investor Info</span>
                </div>
                <InfoRow label="Purchase Price" value={`Rs. ${Number(selectedVehicle.purchasePrice || 0).toLocaleString()}`} />
                <InfoRow label="Total Expenses" value={`Rs. ${Number(selectedVehicle.totalExpenses || 0).toLocaleString()}`} />
                <InfoRow label="Capitalized Cost" value={`Rs. ${Number(capitalizedCost).toLocaleString()}`} />
                <InfoRow label="Payment Status" value={selectedVehicle.isPaid ? "Paid" : "Unpaid"} />
                <InfoRow label="Seller" value={selectedVehicle.sellerClientName} />
                <InfoRow label="Has Investor" value={selectedVehicle.hasInvestor ? "Yes" : "No"} />
                {selectedVehicle.hasInvestor && (
                  <>
                    <InfoRow label="Investor" value={selectedVehicle.investorName} />
                    <InfoRow
                      label="Commission"
                      value={selectedVehicle.commissionType === "Percentage"
                        ? `${selectedVehicle.commissionValue}% of profit`
                        : `Rs. ${Number(selectedVehicle.commissionValue || 0).toLocaleString()} (Fixed)`}
                    />
                  </>
                )}
              </div>
            </div>
          )}

          {/* Sale Form */}
          {selectedVehicle && (
            <div className="space-y-5 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-100 rounded-md text-emerald-600"><DollarSign size={14} /></div>
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Sale Details</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500">Sale Price (PKR) *</label>
                  <Input
                    type="number"
                    placeholder="Enter sale amount..."
                    value={salePrice}
                    onChange={e => setSalePrice(e.target.value)}
                    className="font-semibold h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500">Sale Date *</label>
                  <Input
                    type="date"
                    value={saleDate}
                    onChange={e => setSaleDate(e.target.value)}
                    className="h-10"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                  <Users size={12} /> Seller *
                </label>
                <SearchSelector
                  items={accounts}
                  value={receivingAccountId}
                  onChange={setReceivingAccountId}
                  placeholder="Select seller account..."
                  searchPlaceholder="Search account..."
                  getSearchFields={(acc) => [acc.name, acc.shopName, acc.typeName]}
                  itemKey={(acc) => acc.id}
                  renderTrigger={(selected) =>
                    selected ? (
                      <span>
                        {selected.name} <span className="text-slate-400 text-xs ml-1">(Rs. {Number(selected.balance).toLocaleString()})</span>
                      </span>
                    ) : (
                      <span className="text-slate-400">Select seller account...</span>
                    )
                  }
                  renderItem={(acc) => (
                    <div className="flex justify-between items-center w-full text-left">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-800">{acc.name}</span>
                        {acc.shopName && <span className="text-[10px] text-slate-500">{acc.shopName}</span>}
                      </div>
                      <span className="text-xs text-slate-500 font-mono">Rs. {Number(acc.balance).toLocaleString()}</span>
                    </div>
                  )}
                  actionNode={
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full justify-start text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 h-9 px-2"
                      onClick={() => setShowQuickAddClient(true)}
                    >
                      <UserPlus size={16} className="mr-2" /> Add New Client
                    </Button>
                  }
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500">Buyer Name (Optional)</label>
                  <Input
                    value={buyerName}
                    onChange={e => setBuyerName(e.target.value)}
                    placeholder="e.g. Ahmed Khan"
                    className="h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500">Buyer Phone (Optional)</label>
                  <Input
                    value={buyerPhone}
                    onChange={e => setBuyerPhone(e.target.value)}
                    placeholder="e.g. 0300-1234567"
                    className="h-10"
                  />
                </div>
              </div>

              {/* P&L Preview */}
              {salePriceVal > 0 && (
                <div className="p-4 bg-gradient-to-br from-emerald-50 to-slate-50 rounded-xl border border-emerald-100">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Transaction Preview</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Sale Price</span>
                      <span className="font-semibold text-emerald-700">Rs. {salePriceVal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Capitalized Cost</span>
                      <span className="font-semibold text-slate-700">− Rs. {capitalizedCost.toLocaleString()}</span>
                    </div>
                    {selectedVehicle?.hasInvestor && commissionAmount > 0 && (
                      <div className="flex justify-between text-purple-700 bg-purple-50 px-2 py-1 rounded-lg">
                        <span className="flex items-center gap-1">
                          <Users size={12} /> Commission ({selectedVehicle.investorName}
                          {selectedVehicle.commissionType === "Percentage" && ` · ${selectedVehicle.commissionValue}%`})
                        </span>
                        <span className="font-semibold">− Rs. {commissionAmount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className={`flex justify-between font-bold border-t border-slate-200 pt-2 mt-1 ${
                      (profit - commissionAmount) >= 0 ? "text-emerald-700" : "text-red-700"
                    }`}>
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
                className="bg-emerald-600 hover:bg-emerald-700 text-white h-11 px-8 gap-2 font-semibold"
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
            <div className="p-2.5 bg-emerald-600 rounded-xl text-white shadow">
              <ShoppingBag size={18} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Sale Invoice History</h2>
              <p className="text-xs text-slate-400">All vehicles sold with full financial details</p>
            </div>
            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
              {saleInvoices.length} sold
            </span>
          </div>
          <input
            type="text"
            placeholder="Search by vehicle, buyer..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 w-64"
          />
        </div>

        {saleInvoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-white border border-dashed border-slate-200 rounded-2xl text-slate-400">
            <ShoppingBag size={36} className="mb-3 opacity-30" />
            <p className="font-medium text-sm">No sale invoices generated yet</p>
            <p className="text-xs mt-1">Complete a sale using the form above to see it here.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white">
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">#</th>
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">Vehicle</th>
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">Chassis No.</th>
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">Buyer</th>
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">Sale Date</th>
                    <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wide">Cost</th>
                    <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wide">Sale Price</th>
                    <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wide">Commission</th>
                    <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wide">Net P&L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
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
                      const commission = Number(inv.commissionPaid || 0);
                      const netPL = Number(inv.netProfit ?? (sale - cost - commission));
                      const isProfit = netPL >= 0;
                      return (
                        <tr key={inv.id} className="hover:bg-emerald-50/40 transition-colors duration-150">
                          <td className="px-4 py-3 text-slate-400 font-mono text-xs">{idx + 1}</td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900">{inv.brandName} {inv.model}</div>
                            <div className="text-xs text-slate-400">{inv.modelYear || inv.year} · {inv.color}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                              {inv.chassisNumber || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-700 text-xs">
                            <div className="font-medium">{inv.buyerName || <span className="text-slate-300">—</span>}</div>
                            {inv.buyerPhone && <div className="text-slate-400">{inv.buyerPhone}</div>}
                          </td>
                          <td className="px-4 py-3 text-slate-600 text-xs">
                            {inv.saleDate || "—"}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600 text-xs">
                            Rs. {cost.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-bold text-emerald-700 text-sm">
                              Rs. {sale.toLocaleString()}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-xs">
                            {commission > 0 ? (
                              <span className="text-purple-600 font-medium">
                                Rs. {commission.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-bold text-sm flex items-center justify-end gap-1 ${
                              isProfit ? "text-emerald-600" : "text-red-500"
                            }`}>
                              {isProfit ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                              {isProfit ? "+" : "-"}Rs. {Math.abs(netPL).toLocaleString()}
                            </span>
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
              <div className="p-8 text-center text-slate-400 text-sm">No invoices match your search.</div>
            )}
            {/* Footer summary */}
            <div className="px-4 py-3 bg-gradient-to-r from-emerald-50 to-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-slate-400">
                {saleInvoices.length} vehicle{saleInvoices.length !== 1 ? "s" : ""} sold
              </span>
              <div className="flex gap-6">
                <span className="text-xs text-slate-500">
                  Total Revenue: <strong className="text-emerald-700">
                    Rs. {saleInvoices.reduce((s, i) => s + (Number(i.salePrice) || 0), 0).toLocaleString()}
                  </strong>
                </span>
                <span className="text-xs text-slate-500">
                  Net Profit: <strong className="text-emerald-700">
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
    </div>
  );
};
