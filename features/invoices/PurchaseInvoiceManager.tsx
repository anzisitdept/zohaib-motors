"use client";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  collection, onSnapshot, query, orderBy, serverTimestamp,
  doc, runTransaction, addDoc, getDocs, where
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
  FileText, ChevronDown, Info, CreditCard, AlertTriangle, Printer
} from "lucide-react";
import { SearchSelector } from "@/components/ui/SearchSelector";
import { VehicleSelector } from "@/features/inventory/VehicleSelector";
import { ClientSelector } from "@/features/registry/ClientSelector";
import { SaleInvoicePrintModal } from "./SaleInvoicePrintModal";
import { PurchaseInvoicePrintModal } from "./PurchaseInvoicePrintModal";

export const PurchaseInvoiceManager = () => {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const preselectedVehicleId = searchParams.get("vehicleId") || "";

  // Data
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);

  // Printing state
  const [printingInvoice, setPrintingInvoice] = useState<any | null>(null);
  const [printingPurchaseInvoice, setPrintingPurchaseInvoice] = useState<any | null>(null);

  // Selection
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState<any | null>(null);

  // Purchase fields
  const [purchasePrice, setPurchasePrice] = useState("");
  const [isPaid, setIsPaid] = useState(false);
  const [paymentAccountId, setPaymentAccountId] = useState("");

  const [selectedSellerId, setSelectedSellerId] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);

  // Installment fields
  const [isInstallment, setIsInstallment] = useState(false);
  const [downPayment, setDownPayment] = useState("");
  const [monthsPeriod, setMonthsPeriod] = useState("");
  const [installmentEndDate, setInstallmentEndDate] = useState("");
  const [monthlyDueAmount, setMonthlyDueAmount] = useState("");
  const [remainingAmount, setRemainingAmount] = useState("");

  // Invoice history
  const [purchaseInvoices, setPurchaseInvoices] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  // UI
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Fetch only unpurchased vehicles
  useEffect(() => {
    const q = query(collection(db, "cars"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const all: any[] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const eligible = all.filter(v => (!v.purchasePrice || v.purchasePrice <= 0) && v.registrationReason === "For Purchase");
      setVehicles(eligible);
      setPurchaseInvoices(all.filter(v => v.purchasePrice && v.purchasePrice > 0));

      // Auto-select vehicle if vehicleId is in URL
      if (preselectedVehicleId) {
        const target = all.find(v => v.id === preselectedVehicleId);
        if (target) setSelectedVehicleId(preselectedVehicleId);
      }
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

  useEffect(() => {
    const q = query(collection(db, "clients"), orderBy("name"));
    const unsub = onSnapshot(q, (snap) => {
      setClients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // When vehicle selection changes
  useEffect(() => {
    const v = vehicles.find(v => v.id === selectedVehicleId) || null;
    setSelectedVehicle(v);
    // Pre-fill existing data if available
    if (v) {
      setPurchasePrice(v.purchasePrice ? v.purchasePrice.toString() : "");
      setIsPaid(v.isPaid || false);
      setPaymentAccountId(v.paymentAccountId || "");
      setSelectedSellerId(v.sellerClientId || "");
    } else {
      setPurchasePrice("");
      setIsPaid(false);
      setPaymentAccountId("");
      setSelectedSellerId("");
    }
    setIsInstallment(false);
    setDownPayment("");
    setMonthsPeriod("");
    setInstallmentEndDate("");
    setMonthlyDueAmount("");
    setRemainingAmount("");
    setMessage("");
  }, [selectedVehicleId, vehicles]);

  // Recalculate remaining amount for installments
  useEffect(() => {
    if (isInstallment && purchasePrice) {
      const down = parseFloat(downPayment) || 0;
      const total = parseFloat(purchasePrice) || 0;
      setRemainingAmount((total - down).toString());
    }
  }, [purchasePrice, downPayment, isInstallment]);

  // Recalculate installment end date
  useEffect(() => {
    if (isInstallment && invoiceDate && monthsPeriod) {
      const months = parseInt(monthsPeriod) || 0;
      if (months > 0) {
        const date = new Date(invoiceDate);
        date.setMonth(date.getMonth() + months);
        setInstallmentEndDate(date.toISOString().split("T")[0]);
      } else {
        setInstallmentEndDate("");
      }
    }
  }, [invoiceDate, monthsPeriod, isInstallment]);

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

  const priceVal = parseFloat(purchasePrice) || 0;

  const handleCreateInvoice = async () => {
    if (!user || !selectedVehicle) return;
    if (selectedVehicle.purchasePrice > 0) {
      setMessage("Error: This vehicle has already been purchased. You cannot generate another purchase invoice for it.");
      return;
    }
    if (priceVal <= 0) { setMessage("Error: Please enter a valid purchase price."); return; }
    if (isPaid && !paymentAccountId) { setMessage("Error: Please select a payment account."); return; }

    setLoading(true);
    setMessage("");

    try {
      // Get or create "Vehicle Asset" account type
      let vehicleAssetTypeId = "";
      const typeQuery = query(collection(db, "account-types"), where("name", "==", "Vehicle Asset"));
      const typeSnapshot = await getDocs(typeQuery);
      if (!typeSnapshot.empty) {
        vehicleAssetTypeId = typeSnapshot.docs[0].id;
      } else {
        const typeRef = await addDoc(collection(db, "account-types"), {
          name: "Vehicle Asset",
          description: "Accounts to track vehicle assets and capitalize costs",
          createdAt: serverTimestamp(),
          createdBy: user.uid
        });
        vehicleAssetTypeId = typeRef.id;
      }

      await runTransaction(db, async (tx) => {
        // --- READ PHASE ---
        let paymentAccSnap: any = null;
        let clientAccSnap: any = null;
        let clientSnap: any = null;

        if (isPaid && paymentAccountId) {
          const ref = doc(db, "accounts", paymentAccountId);
          paymentAccSnap = await tx.get(ref);
          if (!paymentAccSnap.exists()) throw new Error("Payment account not found.");
        } else if (!isPaid && selectedSellerId) {
          const clientRef = doc(db, "clients", selectedSellerId);
          clientSnap = await tx.get(clientRef);
          if (clientSnap.exists()) {
            const clientData = clientSnap.data();
            if (clientData.accountId) {
              const cAccRef = doc(db, "accounts", clientData.accountId);
              clientAccSnap = await tx.get(cAccRef);
            } else {
              throw new Error(`Seller "${clientData.name}" has no linked ledger account. Please save the client again to auto-create one.`);
            }
          }
        }

        // --- WRITE PHASE ---
        const chassisLast4 = (selectedVehicle.chassisNumber || "").slice(-4) || "0000";
        const vehicleAccName = `Vehicle: ${selectedVehicle.brandName} ${selectedVehicle.model} (${chassisLast4})`;

        // Create or re-use vehicle ledger account
        let vehicleAccountId = selectedVehicle.vehicleAccountId;
        let vehiclePrevBal = 0; // track existing balance for voucher snapshot
        if (!vehicleAccountId) {
          const accRef = doc(collection(db, "accounts"));
          vehicleAccountId = accRef.id;
          vehiclePrevBal = 0; // brand new account
          tx.set(accRef, {
            name: vehicleAccName,
            typeId: vehicleAssetTypeId,
            typeName: "Vehicle Asset",
            balance: priceVal,
            description: `Auto-created ledger for: ${selectedVehicle.brandName} ${selectedVehicle.model}`,
            createdAt: serverTimestamp(),
            createdBy: user.uid,
            updatedAt: serverTimestamp(),
            updatedBy: user.uid
          });
        } else {
          // Update existing vehicle account balance
          const vAccRef = doc(db, "accounts", vehicleAccountId);
          const vAccSnap = await tx.get(vAccRef);
          if (vAccSnap.exists()) {
            vehiclePrevBal = vAccSnap.data().balance || 0;
            tx.update(vAccRef, {
              balance: priceVal,
              updatedAt: serverTimestamp(),
              updatedBy: user.uid
            });
          }
        }

        // ── PAID: Cash Account (credit) ↔ Vehicle Asset Account (debit) ──
        if (isPaid && paymentAccSnap) {
          const payAccRef = doc(db, "accounts", paymentAccountId);
          const payPrevBal = paymentAccSnap.data().balance || 0;
          const payNewBal = payPrevBal - priceVal;          // cash goes OUT → credit
          const payName = paymentAccSnap.data().name;
          const vehicleNewBal = priceVal;                   // asset goes IN → debit

          tx.update(payAccRef, {
            balance: payNewBal,
            updatedAt: serverTimestamp(),
            updatedBy: user.uid
          });

          const invoiceId = "PI-" + Math.floor(100000 + Math.random() * 900000);

          tx.set(doc(collection(db, "vouchers")), {
            voucherNo: invoiceId,
            date: invoiceDate,
            description: `Purchase Invoice: ${selectedVehicle.brandName} ${selectedVehicle.model} — Chassis: ${selectedVehicle.chassisNumber}`,
            amount: priceVal,
            debit: 0,
            credit: priceVal,
            cashAccountId: paymentAccountId,
            cashAccountName: payName,
            cashType: "credit",
            cashPreviousBalance: payPrevBal,
            cashNewBalance: payNewBal,
            counterAccountId: vehicleAccountId,
            counterAccountName: vehicleAccName,
            counterType: "debit",
            counterPreviousBalance: vehiclePrevBal,
            counterNewBalance: vehicleNewBal,
            accountId: paymentAccountId,
            accountName: payName,
            type: "credit",
            previousBalance: payPrevBal,
            newBalance: payNewBal,
            vehicleId: selectedVehicle.id,
            invoiceType: "PURCHASE",
            createdAt: serverTimestamp(),
            createdBy: user.uid
          });

        } else if (clientSnap && clientAccSnap) {
          // ── UNPAID: Seller/Client Payable (credit) ↔ Vehicle Asset (debit) ──
          const clientData = clientSnap.data();
          const clientAccId = clientData.accountId;
          const cAccRef = doc(db, "accounts", clientAccId);
          const cPrevBal = clientAccSnap.data().balance || 0;
          const cNewBal = cPrevBal - priceVal;              // payable increases (credit)
          const cName = clientAccSnap.data().name;
          const vehicleNewBal = priceVal;

          tx.update(cAccRef, {
            balance: cNewBal,
            updatedAt: serverTimestamp(),
            updatedBy: user.uid
          });

          const invoiceId = "PI-" + Math.floor(100000 + Math.random() * 900000);

          tx.set(doc(collection(db, "vouchers")), {
            voucherNo: invoiceId,
            date: invoiceDate,
            description: `Purchase Invoice (Unpaid) — payable to ${clientData.name} for ${selectedVehicle.brandName} ${selectedVehicle.model} · Chassis: ${selectedVehicle.chassisNumber}`,
            amount: priceVal,
            debit: 0,
            credit: priceVal,
            cashAccountId: clientAccId,
            cashAccountName: cName,
            cashType: "credit",
            cashPreviousBalance: cPrevBal,
            cashNewBalance: cNewBal,
            counterAccountId: vehicleAccountId,
            counterAccountName: vehicleAccName,
            counterType: "debit",
            counterPreviousBalance: vehiclePrevBal,
            counterNewBalance: vehicleNewBal,
            accountId: clientAccId,
            accountName: cName,
            type: "credit",
            previousBalance: cPrevBal,
            newBalance: cNewBal,
            vehicleId: selectedVehicle.id,
            invoiceType: "PURCHASE",
            createdAt: serverTimestamp(),
            createdBy: user.uid
          });

        } else {
          // ── NO PAYMENT / NO SELLER: write a standalone asset debit voucher ──
          const invoiceId = "PI-" + Math.floor(100000 + Math.random() * 900000);
          tx.set(doc(collection(db, "vouchers")), {
            voucherNo: invoiceId,
            date: invoiceDate,
            description: `Purchase Invoice (No Payment Entry): ${selectedVehicle.brandName} ${selectedVehicle.model} — Chassis: ${selectedVehicle.chassisNumber}`,
            amount: priceVal,
            debit: priceVal,
            credit: 0,
            cashAccountId: vehicleAccountId,
            cashAccountName: vehicleAccName,
            cashType: "debit",
            cashPreviousBalance: vehiclePrevBal,
            cashNewBalance: priceVal,
            counterAccountId: null,
            counterAccountName: null,
            counterType: null,
            counterPreviousBalance: null,
            counterNewBalance: null,
            accountId: vehicleAccountId,
            accountName: vehicleAccName,
            type: "debit",
            previousBalance: vehiclePrevBal,
            newBalance: priceVal,
            vehicleId: selectedVehicle.id,
            invoiceType: "PURCHASE",
            createdAt: serverTimestamp(),
            createdBy: user.uid
          });
        }

        // Update vehicle record
        const sellerClient = clients.find(c => c.id === selectedSellerId);
        const carRef = doc(db, "cars", selectedVehicle.id);
        tx.update(carRef, {
          purchasePrice: priceVal,
          isPaid,
          paymentAccountId: isPaid ? paymentAccountId : null,
          sellerClientId: selectedSellerId || null,
          sellerClientName: sellerClient?.name || "",
          sellerClientPhone: sellerClient?.phone || "",
          hasInvestor: false,
          investorId: null,
          investorName: null,
          commissionType: null,
          commissionValue: 0,
          vehicleAccountId,
          capitalizedCost: priceVal,
          totalExpenses: selectedVehicle.totalExpenses || 0,
          updatedAt: serverTimestamp()
        });

        // Installment Plan
        if (isInstallment) {
          const dp = parseFloat(downPayment) || 0;
          const remaining = parseFloat(remainingAmount) || 0;
          const months = parseInt(monthsPeriod) || 0;
          const monthlyDue = parseFloat(monthlyDueAmount) || 0;

          let schedule = [];
          let currDate = new Date(invoiceDate);
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
            clientId: selectedSellerId || null,
            clientName: sellerClient?.name || "Unknown",
            clientPhone: sellerClient?.phone || "",
            clientEmail: sellerClient?.email || null,
            vehicleId: selectedVehicle.id,
            vehicleName: `${selectedVehicle.brandName} ${selectedVehicle.model}`,
            totalAmount: priceVal,
            downPayment: dp,
            remainingAmount: remaining,
            monthsPeriod: months,
            monthlyDueAmount: monthlyDue,
            totalPaid: 0,
            startDate: invoiceDate,
            endDate: installmentEndDate || null,
            installmentSchedule: schedule,
            status: "active",
            type: "PURCHASE",
            createdAt: serverTimestamp(),
            createdBy: user.uid
          });
        }

        // Log
        tx.set(doc(collection(db, "logs")), {
          action: `Purchase Invoice: ${selectedVehicle.brandName} ${selectedVehicle.model}`,
          details: `Rs. ${priceVal.toLocaleString()} — ${isPaid ? "Paid" : "Unpaid"}`,
          performedBy: user.uid,
          timestamp: serverTimestamp(),
          type: "PURCHASE_INVOICE"
        });
      });

      setMessage(`Success: Purchase invoice created for ${selectedVehicle.brandName} ${selectedVehicle.model}. Vouchers generated.`);
      setSelectedVehicleId("");
      setSelectedSellerId("");
    } catch (err: any) {
      console.error("Purchase invoice error:", err);
      setMessage(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const InfoRow = ({ label, value }: { label: string; value: any }) => (
    <div className="flex justify-between items-center py-1.5 border-b border-slate-50 last:border-0">
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      <span className="text-xs font-semibold text-foreground">{value || "—"}</span>
    </div>
  );

  return (
    <>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Card */}
        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border bg-card">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-secondary rounded-xl text-white shadow">
                <FileText size={20} />
              </div>
              <div>
                <CardTitle className="text-lg text-foreground">Purchase Invoice</CardTitle>
                <CardDescription>Select a registered vehicle and record its purchase details.</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            {message && (
              <div className={`p-3 rounded-lg text-sm font-medium flex items-center gap-2 ${message.startsWith("Error")
                  ? "bg-red-50 text-red-700 border border-red-100"
                  : "bg-green-50 text-green-700 border border-green-100"
                }`}>
                {!message.startsWith("Error") && <CheckCircle2 size={16} />}
                {message.startsWith("Error") && <AlertTriangle size={16} />}
                {message}
              </div>
            )}

            {/* Vehicle Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Car size={13} /> Select Vehicle *
              </label>
              {vehicles.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-xs border border-dashed border-border rounded-lg">No unregistered/unpurchased vehicles found. Register a vehicle first.</div>
              ) : (
                <VehicleSelector
                  vehicles={vehicles}
                  value={selectedVehicleId}
                  onChange={setSelectedVehicleId}
                  placeholder="Choose a registered vehicle..."
                />
              )}
              {vehicles.length === 0 && (
                <p className="text-xs text-primary flex items-center gap-1 mt-1">
                  <AlertTriangle size={12} /> All registered vehicles are already purchased. Go to "New Registration" to add another vehicle first.
                </p>
              )}
            </div>

            {/* Vehicle Details Panel */}
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
                  <InfoRow label="Registration" value={selectedVehicle.registrationNumber} />
                  <InfoRow label="Source" value={selectedVehicle.vehicleSource} />
                </div>

                {/* Right: Ownership Info */}
                <div className="bg-muted rounded-xl border border-border p-4 space-y-0.5">
                  <div className="flex items-center gap-2 mb-3">
                    <Users size={14} className="text-muted-foreground" />
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Ownership & Status</span>
                  </div>
                  <InfoRow label="Current Owner" value={selectedVehicle.ownerName} />
                  <InfoRow label="Owner Contact" value={selectedVehicle.ownerContact} />
                  <InfoRow label="Registered Owner" value={selectedVehicle.registeredOwnerName} />
                  <InfoRow label="Reg. Owner CNIC" value={selectedVehicle.registeredOwnerCnic} />
                  <InfoRow label="Plate Status" value={selectedVehicle.plateStatus} />
                  <InfoRow label="File Status" value={selectedVehicle.fileStatus} />
                  <InfoRow label="Registration Reason" value={selectedVehicle.registrationReason} />
                  <InfoRow label="Current Status" value={selectedVehicle.currentStatus} />
                  {selectedVehicle.purchasePrice > 0 && (
                    <InfoRow label="Existing Purchase Price" value={`Rs. ${Number(selectedVehicle.purchasePrice).toLocaleString()}`} />
                  )}
                </div>
              </div>
            )}

            {/* Seller / Client Selection */}
            {selectedVehicle && (
              <div className="space-y-3 pt-2 border-t border-border">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-purple-100 rounded-md text-primary"><Users size={14} /></div>
                  <h4 className="text-sm font-bold text-foreground uppercase tracking-wider">Seller / Client</h4>
                  <span className="text-xs text-muted-foreground italic">(Optional — required for unpaid payable entry)</span>
                </div>
                <ClientSelector
                  clients={clients}
                  value={selectedSellerId}
                  onChange={setSelectedSellerId}
                  placeholder="Select seller / client..."
                />
                {selectedSellerId && (() => {
                  const seller = clients.find(c => c.id === selectedSellerId);
                  return seller ? (
                    <div className="flex items-center gap-3 p-3 bg-muted rounded-lg border border-border">
                      <div className="p-2 bg-purple-100 rounded-full text-primary"><Users size={14} /></div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-foreground">{seller.name}</p>
                        {seller.phone && <p className="text-xs text-muted-foreground">{seller.phone}</p>}
                        {!seller.accountId && (
                          <p className="text-xs text-primary font-medium mt-0.5">⚠ No ledger account linked — unpaid entry will be skipped</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedSellerId("")}
                        className="text-muted-foreground hover:text-red-500 transition-colors text-xs"
                      >
                        ✕ Clear
                      </button>
                    </div>
                  ) : null;
                })()}
              </div>
            )}

            {/* Purchase Details */}
            {selectedVehicle && (
              <div className="space-y-5 pt-2 border-t border-border">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-muted rounded-md text-primary"><DollarSign size={14} /></div>
                  <h4 className="text-sm font-bold text-foreground uppercase tracking-wider">Purchase Details</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Purchase Price (PKR) *</label>
                    <Input
                      type="number"
                      placeholder="Enter purchase price..."
                      value={purchasePrice}
                      onChange={e => setPurchasePrice(e.target.value)}
                      className="font-semibold h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Invoice Date *</label>
                    <Input
                      type="date"
                      value={invoiceDate}
                      onChange={e => setInvoiceDate(e.target.value)}
                      className="h-10"
                    />
                  </div>
                </div>

                {/* Paid / Unpaid Toggle */}
                <div className="flex items-center gap-4 p-3.5 bg-muted rounded-xl border border-border">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={isPaid}
                      onChange={e => setIsPaid(e.target.checked)}
                    />
                    <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-secondary"></div>
                    <span className="ml-3 text-sm font-semibold text-foreground">Payment Made (Paid)</span>
                  </label>
                  {!isPaid && (
                    <span className="text-xs text-amber-700 bg-muted px-2 py-1 rounded-lg font-medium border border-border">
                      Will be recorded as payable to seller
                    </span>
                  )}
                </div>

                {/* Payment Account (if paid) */}
                {isPaid && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                      <Wallet size={12} /> Payment Account *
                    </label>
                    <SearchSelector
                      items={accounts}
                      value={paymentAccountId}
                      onChange={setPaymentAccountId}
                      placeholder="Select cash / bank account..."
                      searchPlaceholder="Search account..."
                      getSearchFields={(acc) => [acc.name, acc.typeName]}
                      itemKey={(acc) => acc.id}
                      renderTrigger={(selected) =>
                        selected ? (
                          <span>
                            {selected.name} <span className="text-muted-foreground text-xs ml-1">(Rs. {Number(selected.balance).toLocaleString()})</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Select cash / bank account...</span>
                        )
                      }
                      renderItem={(acc) => (
                        <div className="flex justify-between items-center w-full text-left">
                          <span className="font-medium text-foreground">{acc.name}</span>
                          <span className="text-xs text-muted-foreground font-mono">Rs. {Number(acc.balance).toLocaleString()}</span>
                        </div>
                      )}
                    />
                  </div>
                )}

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
                    </div>
                  )}
                </div>

                {/* Summary Preview */}
                {priceVal > 0 && (
                  <div className="p-4 bg-card rounded-xl border border-border">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Invoice Preview</p>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Vehicle</span>
                        <span className="font-semibold">{selectedVehicle.brandName} {selectedVehicle.model}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Purchase Price</span>
                        <span className="font-bold text-primary">Rs. {priceVal.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Payment Status</span>
                        <span className={`font-semibold ${isPaid ? "text-primary" : "text-primary"}`}>
                          {isPaid ? "✓ Paid" : "⏳ Unpaid (Payable)"}
                        </span>
                      </div>
                      {!isPaid && selectedSellerId && (() => {
                        const seller = clients.find(c => c.id === selectedSellerId);
                        return seller ? (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Payable To</span>
                            <span className="font-semibold text-primary">{seller.name}</span>
                          </div>
                        ) : null;
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Action Button */}
            {selectedVehicle && (
              <div className="pt-2 flex justify-end">
                <Button
                  onClick={handleCreateInvoice}
                  disabled={loading || priceVal <= 0}
                  className="bg-secondary hover:bg-secondary/90 text-white h-11 px-8 gap-2 font-semibold"
                >
                  {loading
                    ? <><Loader2 size={16} className="animate-spin" /> Processing...</>
                    : <><FileText size={16} /> Generate Purchase Invoice</>
                  }
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Purchase Invoices History Table ── */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-secondary rounded-xl text-white shadow">
                <FileText size={18} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Purchase Invoice History</h2>
                <p className="text-xs text-muted-foreground">All generated purchase invoices</p>
              </div>
              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-primary">
                {purchaseInvoices.length} total
              </span>
            </div>
            <input
              type="text"
              placeholder="Search by vehicle, chassis..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="h-9 px-3 text-sm border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-blue-400 w-64"
            />
          </div>

          {purchaseInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-card border border-dashed border-border rounded-2xl text-muted-foreground">
              <FileText size={36} className="mb-3 opacity-30" />
              <p className="font-medium text-sm">No purchase invoices generated yet</p>
              <p className="text-xs mt-1">Generate your first invoice using the form above.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border shadow-sm bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                      <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">#</th>
                      <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">Vehicle</th>
                      <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">Chassis No.</th>
                      <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">Year / Color</th>
                      <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">Seller</th>
                      <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wide">Purchase Price</th>
                      <th className="px-4 py-3 text-center font-semibold text-xs uppercase tracking-wide">Payment</th>
                      <th className="px-4 py-3 text-center font-semibold text-xs uppercase tracking-wide">Status</th>
                      <th className="px-4 py-3 text-center font-semibold text-xs uppercase tracking-wide">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {purchaseInvoices
                      .filter(inv => {
                        if (!searchTerm) return true;
                        const s = searchTerm.toLowerCase();
                        return (
                          `${inv.brandName} ${inv.model}`.toLowerCase().includes(s) ||
                          (inv.chassisNumber || "").toLowerCase().includes(s) ||
                          (inv.sellerClientName || "").toLowerCase().includes(s)
                        );
                      })
                      .map((inv, idx) => (
                        <tr
                          key={inv.id}
                          className="hover:bg-muted/40 transition-colors duration-150"
                        >
                          <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{idx + 1}</td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-foreground">{inv.brandName} {inv.model}</div>
                            {inv.variant && <div className="text-xs text-muted-foreground">{inv.variant}</div>}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded text-foreground">
                              {inv.chassisNumber || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">
                            <div>{inv.modelYear || inv.year || "—"}</div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span
                                className="inline-block w-2.5 h-2.5 rounded-full border border-border"
                                style={{ backgroundColor: inv.color?.toLowerCase() || "#ccc" }}
                              />
                              {inv.color || "—"}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-foreground text-xs">
                            {inv.sellerClientName || <span className="text-muted-foreground">—</span>}
                            {inv.sellerClientPhone && <div className="text-muted-foreground">{inv.sellerClientPhone}</div>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-bold text-primary text-sm">
                              Rs. {Number(inv.purchasePrice || 0).toLocaleString()}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {inv.isPaid ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-primary">
                                <CheckCircle2 size={10} /> Paid
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                                ⏳ Unpaid
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {inv.isSold ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground">
                                SOLD
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-primary">
                                In Stock
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Button variant="ghost" size="icon" onClick={() => setPrintingPurchaseInvoice(inv)} className="h-8 w-8 text-muted-foreground hover:text-blue-600 hover:bg-blue-50" title="Print Invoice">
                              <Printer size={16} />
                            </Button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {purchaseInvoices.filter(inv => {
                if (!searchTerm) return true;
                const s = searchTerm.toLowerCase();
                return `${inv.brandName} ${inv.model}`.toLowerCase().includes(s) || (inv.chassisNumber || "").toLowerCase().includes(s);
              }).length === 0 && (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    No invoices match your search.
                  </div>
                )}
              {/* Footer summary */}
              <div className="px-4 py-3 bg-card border-t border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Showing {purchaseInvoices.length} purchase invoice{purchaseInvoices.length !== 1 ? "s" : ""}
                </span>
                <span className="text-xs font-bold text-primary">
                  Total Invested: Rs. {purchaseInvoices.reduce((sum, inv) => sum + (Number(inv.purchasePrice) || 0), 0).toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <SaleInvoicePrintModal
        isOpen={printingInvoice != null}
        onClose={() => setPrintingInvoice(null)}
        invoice={printingInvoice}
      />
      <PurchaseInvoicePrintModal
        isOpen={printingPurchaseInvoice != null}
        onClose={() => setPrintingPurchaseInvoice(null)}
        invoice={printingPurchaseInvoice}
      />
    </>
  );
};