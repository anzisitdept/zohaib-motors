"use client";

import { useState, useEffect, useMemo } from "react";
import {
  collection, onSnapshot, query, orderBy,
  getDocs, where, runTransaction, doc, deleteDoc,
  serverTimestamp, addDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Car, Search, Filter, X, CheckCircle2, AlertTriangle,
  Coins, FileText, LayoutList, Trash2, Loader2, ShieldAlert
} from "lucide-react";

// ─── Confirmation Dialog ──────────────────────────────────────────────────────
interface DeleteConfirmDialogProps {
  vehicle: any;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
  error: string;
}

function DeleteConfirmDialog({ vehicle, onConfirm, onCancel, loading, error }: DeleteConfirmDialogProps) {
  const isSold = !!vehicle?.isSold;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={!loading ? onCancel : undefined}
      />

      {/* Dialog */}
      <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-md border border-border overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className={`px-6 pt-6 pb-4 flex items-start gap-4 ${isSold ? "bg-muted" : "bg-red-50"}`}>
          <div className={`p-2.5 rounded-xl shrink-0 ${isSold ? "bg-amber-100 text-primary" : "bg-red-100 text-red-600"}`}>
            {isSold ? <ShieldAlert size={22} /> : <Trash2 size={22} />}
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">
              {isSold ? "Cannot Delete Sold Vehicle" : "Delete Purchase Record?"}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isSold
                ? "This vehicle has already been sold. Reverse the sale first."
                : "This will permanently reverse the purchase and all related accounting entries."}
            </p>
          </div>
          {!loading && (
            <button
              onClick={onCancel}
              className="ml-auto shrink-0 text-muted-foreground hover:text-muted-foreground transition-colors mt-0.5"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Vehicle Info */}
        <div className="px-6 py-4 border-b border-border space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Vehicle</span>
            <span className="font-semibold text-foreground">{vehicle?.brandName} {vehicle?.model}</span>
          </div>
          {vehicle?.variant && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Variant</span>
              <span className="font-medium text-foreground">{vehicle.variant}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Chassis No.</span>
            <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded text-foreground">
              {vehicle?.chassisNumber || "—"}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Purchase Price</span>
            <span className="font-bold text-primary">Rs. {Number(vehicle?.purchasePrice || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Payment Status</span>
            <span className={`font-semibold text-xs px-2 py-0.5 rounded-full ${vehicle?.isPaid ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
              {vehicle?.isPaid ? "Paid" : "Unpaid"}
            </span>
          </div>
          {vehicle?.sellerClientName && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Seller</span>
              <span className="font-medium text-foreground">{vehicle.sellerClientName}</span>
            </div>
          )}
        </div>

        {/* Reversal summary */}
        {!isSold && (
          <div className="px-6 py-4 bg-red-50/50 border-b border-red-100 space-y-1.5">
            <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-2">What will be reversed:</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              Purchase invoice voucher deleted
            </div>
            {vehicle?.isPaid && vehicle?.paymentAccountId && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                Rs. {Number(vehicle.purchasePrice).toLocaleString()} credited back to payment account
              </div>
            )}
            {!vehicle?.isPaid && vehicle?.sellerClientName && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                Payable to {vehicle.sellerClientName} reversed
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              Vehicle ledger account removed
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              Vehicle purchase fields reset (vehicle remains in registry)
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-red-700 text-xs">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Actions */}
        <div className="px-6 py-5 flex gap-3 justify-end">
          {isSold ? (
            <Button onClick={onCancel} className="bg-slate-900 text-white">Close</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onCancel} disabled={loading} className="border-border">
                Cancel
              </Button>
              <Button
                onClick={onConfirm}
                disabled={loading}
                className="bg-red-600 hover:bg-red-700 text-white gap-2 min-w-[160px]"
              >
                {loading ? (
                  <><Loader2 size={15} className="animate-spin" /> Reversing...</>
                ) : (
                  <><Trash2 size={15} /> Yes, Delete & Reverse</>
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function PurchaseInventoryList() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [stockFilter, setStockFilter] = useState("ALL"); // ALL, INSTOCK, SOLD
  const [docFilter, setDocFilter] = useState("ALL");
  const [plateFilter, setPlateFilter] = useState("ALL");
  const [yearFilter, setYearFilter] = useState("ALL");

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    const q = query(collection(db, "cars"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const all: any[] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Purchase inventory = vehicles with a purchase price greater than zero
      setVehicles(all.filter(v => v.purchasePrice && v.purchasePrice > 0));
      setLoading(false);
    }, (err) => {
      console.error("Error fetching purchase inventory:", err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Extract unique mfg years for filters
  const uniqueYears = useMemo(() => {
    const years = new Set(vehicles.map(v => v.modelYear || v.year).filter(Boolean));
    return Array.from(years).sort((a: any, b: any) => b - a);
  }, [vehicles]);

  // Filtered Inventory
  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      // 1. Search Query
      const s = searchTerm.toLowerCase().trim();
      const matchesSearch = !s ||
        `${v.brandName} ${v.model}`.toLowerCase().includes(s) ||
        (v.chassisNumber || "").toLowerCase().includes(s) ||
        (v.registrationNumber || "").toLowerCase().includes(s) ||
        (v.variant || "").toLowerCase().includes(s) ||
        (v.color || "").toLowerCase().includes(s);

      // 2. Stock Status
      const matchesStock = stockFilter === "ALL" ||
        (stockFilter === "SOLD" && v.isSold) ||
        (stockFilter === "INSTOCK" && !v.isSold);

      // 3. Document Status
      const matchesDoc = docFilter === "ALL" ||
        (docFilter === "NOT_APPLIED" && (v.fileStatus === "Not Applied" || (!v.fileStatus && v.docsApplied === false))) ||
        (docFilter === "SHOWROOM" && (v.fileStatus === "Showroom" || (!v.fileStatus && v.docsApplied === true))) ||
        (docFilter === "EXCISE" && v.fileStatus === "At Excise") ||
        (docFilter === "RETURNED" && v.fileStatus === "Returned Back to Showroom") ||
        (docFilter === "DELIVERED" && v.fileStatus?.toLowerCase().includes("delivered"));

      // 4. Plate Status
      const matchesPlate = plateFilter === "ALL" ||
        (plateFilter === "NOT_AVAILABLE" && (v.plateStatus === "Never Applied" || v.plateStatus === "Not Issued from Excise" || v.plateStatus === "At Party's Hand")) ||
        (plateFilter === "SHOWROOM" && v.plateStatus === "Showroom") ||
        (plateFilter === "DELIVERED" && v.plateStatus?.toLowerCase().includes("delivered"));

      // 5. Mfg Year Filter
      const vehicleYear = (v.modelYear || v.year)?.toString();
      const matchesYear = yearFilter === "ALL" || vehicleYear === yearFilter;

      return matchesSearch && matchesStock && matchesDoc && matchesPlate && matchesYear;
    });
  }, [vehicles, searchTerm, stockFilter, docFilter, plateFilter, yearFilter]);

  // Valuation Stats
  const stats = useMemo(() => {
    let totalPurchasedCount = vehicles.length;
    let inStockCount = 0;
    let soldCount = 0;

    let activeValuation = 0;
    let totalValuationAllTime = 0;
    let soldRevenue = 0;

    vehicles.forEach(v => {
      const purchaseVal = Number(v.purchasePrice) || 0;
      const expensesVal = Number(v.totalExpenses) || 0;
      const capitalized = Number(v.capitalizedCost) || (purchaseVal + expensesVal);

      totalValuationAllTime += capitalized;

      if (v.isSold) {
        soldCount++;
        soldRevenue += Number(v.salePrice) || 0;
      } else {
        inStockCount++;
        activeValuation += capitalized;
      }
    });

    return { totalPurchasedCount, inStockCount, soldCount, activeValuation, totalValuationAllTime, soldRevenue };
  }, [vehicles]);

  // Filtered Summation Totals
  const filteredTotals = useMemo(() => {
    let purchaseTotal = 0;
    let expensesTotal = 0;
    let capitalizedTotal = 0;

    filteredVehicles.forEach(v => {
      const p = Number(v.purchasePrice) || 0;
      const e = Number(v.totalExpenses) || 0;
      const c = Number(v.capitalizedCost) || (p + e);
      purchaseTotal += p;
      expensesTotal += e;
      capitalizedTotal += c;
    });

    return { purchaseTotal, expensesTotal, capitalizedTotal };
  }, [filteredVehicles]);

  const clearFilters = () => {
    setSearchTerm("");
    setStockFilter("ALL");
    setDocFilter("ALL");
    setPlateFilter("ALL");
    setYearFilter("ALL");
  };

  const hasActiveFilters = searchTerm || stockFilter !== "ALL" || docFilter !== "ALL" || plateFilter !== "ALL" || yearFilter !== "ALL";

  // ─── Delete Handler ─────────────────────────────────────────────────────────
  const handleDeleteVehicle = async () => {
    if (!deleteTarget || !user) return;
    const car = deleteTarget;

    setDeleteLoading(true);
    setDeleteError("");

    try {
      // 1. Query purchase vouchers for this car BEFORE starting the transaction
      const vouchersQuery = query(
        collection(db, "vouchers"),
        where("vehicleId", "==", car.id),
        where("invoiceType", "==", "PURCHASE")
      );
      const vouchersSnap = await getDocs(vouchersQuery);
      const voucherRefs = vouchersSnap.docs.map(d => doc(db, "vouchers", d.id));

      // 2. Run atomic transaction
      await runTransaction(db, async (tx) => {
        // READ PHASE — gather all docs we need to modify
        const carRef = doc(db, "cars", car.id);
        const carSnap = await tx.get(carRef);
        if (!carSnap.exists()) throw new Error("Vehicle record not found.");

        // Read payment/seller account
        let payAccRef: any = null;
        let payAccSnap: any = null;

        if (car.isPaid && car.paymentAccountId) {
          payAccRef = doc(db, "accounts", car.paymentAccountId);
          payAccSnap = await tx.get(payAccRef);
        } else if (!car.isPaid && car.sellerClientId) {
          // Look up the client's linked account id
          const clientRef = doc(db, "clients", car.sellerClientId);
          const clientSnap = await tx.get(clientRef);
          if (clientSnap.exists() && clientSnap.data().accountId) {
            payAccRef = doc(db, "accounts", clientSnap.data().accountId);
            payAccSnap = await tx.get(payAccRef);
          }
        }

        // Read vehicle ledger account (if exists)
        let vehicleAccRef: any = null;
        if (car.vehicleAccountId) {
          vehicleAccRef = doc(db, "accounts", car.vehicleAccountId);
          await tx.get(vehicleAccRef); // must read before delete in transaction
        }

        // WRITE PHASE

        // Delete purchase vouchers
        voucherRefs.forEach(ref => tx.delete(ref));

        // Reverse payment / seller account balance
        if (payAccRef && payAccSnap?.exists()) {
          const prevBal = payAccSnap.data().balance || 0;
          const restoredBal = prevBal + Number(car.purchasePrice); // add back what was debited/credited
          tx.update(payAccRef, {
            balance: restoredBal,
            updatedAt: serverTimestamp(),
            updatedBy: user.uid
          });
        }

        // Delete vehicle ledger account
        if (vehicleAccRef) {
          tx.delete(vehicleAccRef);
        }

        // Reset car document purchase fields
        tx.update(carRef, {
          purchasePrice: 0,
          isPaid: false,
          paymentAccountId: null,
          sellerClientId: null,
          sellerClientName: "",
          sellerClientPhone: "",
          vehicleAccountId: null,
          capitalizedCost: 0,
          hasInvestor: false,
          investorId: null,
          investorName: null,
          commissionType: null,
          commissionValue: 0,
          purchaseReversedAt: serverTimestamp(),
          purchaseReversedBy: user.uid
        });

        // Write a log entry
        tx.set(doc(collection(db, "logs")), {
          action: `Purchase reversed: ${car.brandName} ${car.model} (Chassis: ${car.chassisNumber || "N/A"})`,
          details: `Rs. ${Number(car.purchasePrice).toLocaleString()} reversed — ${voucherRefs.length} voucher(s) deleted`,
          performedBy: user.uid,
          timestamp: serverTimestamp(),
          type: "PURCHASE_REVERSAL"
        });
      });

      // Success
      setDeleteTarget(null);
      setSuccessMessage(
        `✓ Purchase for ${car.brandName} ${car.model} has been reversed and ${voucherRefs.length} voucher(s) deleted.`
      );
      setTimeout(() => setSuccessMessage(""), 7000);
    } catch (err: any) {
      console.error("Delete vehicle error:", err);
      setDeleteError(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <DeleteConfirmDialog
          vehicle={deleteTarget}
          onConfirm={handleDeleteVehicle}
          onCancel={() => { setDeleteTarget(null); setDeleteError(""); }}
          loading={deleteLoading}
          error={deleteError}
        />
      )}

      {/* Success Message */}
      {successMessage && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 text-green-800 rounded-xl text-sm font-medium shadow-sm">
          <CheckCircle2 size={18} className="shrink-0 text-green-600" />
          {successMessage}
        </div>
      )}

      {/* --- Valuation Stats Cards --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Active Inventory Value */}
        <Card className="border-border/80 shadow-sm bg-card hover:shadow-md transition-shadow duration-200">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Active Stock Value</span>
              <p className="text-2xl font-extrabold text-primary">Rs. {stats.activeValuation.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground font-medium">In-stock assets valuation</p>
            </div>
            <div className="p-3.5 bg-muted text-primary rounded-2xl shadow-inner">
              <Coins size={24} />
            </div>
          </CardContent>
        </Card>

        {/* In-Stock Count */}
        <Card className="border-border/80 shadow-sm bg-card hover:shadow-md transition-shadow duration-200">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Vehicles In-Stock</span>
              <p className="text-3xl font-extrabold text-foreground">{stats.inStockCount}</p>
              <p className="text-xs text-muted-foreground font-medium">Currently in showroom</p>
            </div>
            <div className="p-3.5 bg-muted text-primary rounded-2xl shadow-inner">
              <Car size={24} />
            </div>
          </CardContent>
        </Card>

        {/* Total Cost Outlay */}
        <Card className="border-border/80 shadow-sm bg-card hover:shadow-md transition-shadow duration-200">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">All-Time Outlay</span>
              <p className="text-2xl font-bold text-foreground">Rs. {stats.totalValuationAllTime.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground font-medium">Total cost (stock + sold)</p>
            </div>
            <div className="p-3.5 bg-muted text-muted-foreground rounded-2xl shadow-inner">
              <FileText size={24} />
            </div>
          </CardContent>
        </Card>

        {/* Sold Count & Revenue */}
        <Card className="border-border/80 shadow-sm bg-card hover:shadow-md transition-shadow duration-200">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Sold Vehicles</span>
              <p className="text-2xl font-extrabold text-primary">{stats.soldCount}</p>
              <p className="text-xs text-muted-foreground font-medium">Rs. {stats.soldRevenue.toLocaleString()} revenue</p>
            </div>
            <div className="p-3.5 bg-emerald-50 text-primary rounded-2xl shadow-inner">
              <LayoutList size={24} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* --- Filter Options --- */}
      <Card className="border-border shadow-sm print-hide bg-muted/50">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 text-muted-foreground" size={16} />
              <Input
                className="pl-10 bg-card border-border shadow-sm"
                placeholder="Search by brand, model, variant, chassis or registration..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2 items-center">
              {/* Stock Status Filter */}
              <Select value={stockFilter} onValueChange={setStockFilter}>
                <SelectTrigger className="w-[130px] h-10 bg-card text-xs border-border shadow-sm">
                  <SelectValue placeholder="Stock status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Stock</SelectItem>
                  <SelectItem value="INSTOCK">In Stock</SelectItem>
                  <SelectItem value="SOLD">Sold</SelectItem>
                </SelectContent>
              </Select>

              {/* Doc Status Filter */}
              <Select value={docFilter} onValueChange={setDocFilter}>
                <SelectTrigger className="w-[140px] h-10 bg-card text-xs border-border shadow-sm">
                  <SelectValue placeholder="Document Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Documents</SelectItem>
                  <SelectItem value="NOT_APPLIED">Not Applied</SelectItem>
                  <SelectItem value="SHOWROOM">Showroom</SelectItem>
                  <SelectItem value="EXCISE">At Excise</SelectItem>
                  <SelectItem value="RETURNED">Returned</SelectItem>
                  <SelectItem value="DELIVERED">Delivered</SelectItem>
                </SelectContent>
              </Select>

              {/* Plate Status Filter */}
              <Select value={plateFilter} onValueChange={setPlateFilter}>
                <SelectTrigger className="w-[140px] h-10 bg-card text-xs border-border shadow-sm">
                  <SelectValue placeholder="Plate Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Plates</SelectItem>
                  <SelectItem value="NOT_AVAILABLE">Not Available</SelectItem>
                  <SelectItem value="SHOWROOM">Showroom</SelectItem>
                  <SelectItem value="DELIVERED">Delivered</SelectItem>
                </SelectContent>
              </Select>

              {/* Mfg Year Filter */}
              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger className="w-[120px] h-10 bg-card text-xs border-border shadow-sm">
                  <SelectValue placeholder="Model Year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Years</SelectItem>
                  {uniqueYears.map((yr: any) => (
                    <SelectItem key={yr.toString()} value={yr.toString()}>{yr.toString()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Reset */}
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-10 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2.5"
                >
                  <X size={14} className="mr-1" /> Reset
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* --- Inventory Table --- */}
      {loading ? (
        <div className="flex justify-center items-center py-20 bg-card border border-border rounded-2xl shadow-sm">
          <p className="text-muted-foreground text-sm font-medium">Loading purchase inventory...</p>
        </div>
      ) : filteredVehicles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-card border border-dashed border-border rounded-2xl text-muted-foreground">
          <Car size={48} className="mb-3 opacity-30 text-blue-500" />
          <p className="font-semibold text-muted-foreground text-base">No Purchased Vehicles Found</p>
          <p className="text-xs mt-1">Try adjusting your filters or search query.</p>
          {hasActiveFilters && (
            <Button variant="link" onClick={clearFilters} className="mt-3 text-primary font-medium">Clear Filters</Button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border shadow-sm bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-blue-700 to-blue-800 text-white border-b">
                  <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">#</th>
                  <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">Vehicle</th>
                  <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">Chassis No.</th>
                  <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">Registration</th>
                  <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">Year / Color</th>
                  <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wide">Purchase Price</th>
                  <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wide">Total Expenses</th>
                  <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wide">Capitalized Cost</th>
                  <th className="px-4 py-3 text-center font-semibold text-xs uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-center font-semibold text-xs uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredVehicles.map((v, idx) => {
                  const purchase = Number(v.purchasePrice) || 0;
                  const expenses = Number(v.totalExpenses) || 0;
                  const capitalized = Number(v.capitalizedCost) || (purchase + expenses);
                  const isSold = !!v.isSold;

                  return (
                    <tr
                      key={v.id}
                      className="hover:bg-muted/50 transition-colors duration-150 group"
                    >
                      <td className="px-4 py-3.5 text-muted-foreground font-mono text-xs">{idx + 1}</td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-foreground">{v.brandName} {v.model}</div>
                        {v.variant && <div className="text-xs text-muted-foreground mt-0.5">{v.variant}</div>}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-xs bg-muted px-2.5 py-1 rounded text-foreground border border-border/50">
                          {v.chassisNumber || v.chassisNo || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        {v.registrationNumber || v.registrationNo ? (
                          <span className="font-mono text-xs text-foreground font-semibold">{v.registrationNumber || v.registrationNo}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">Unregistered</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground text-xs">
                        <div className="font-medium">{v.modelYear || v.year || "—"}</div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span
                            className="inline-block w-3.5 h-3.5 rounded-full border border-border shadow-sm"
                            style={{ backgroundColor: v.color?.toLowerCase() || "#ccc" }}
                          />
                          <span>{v.color || "—"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right font-medium text-muted-foreground">
                        Rs. {purchase.toLocaleString()}
                      </td>
                      <td className="px-4 py-3.5 text-right text-xs">
                        {expenses > 0 ? (
                          <span className="text-secondary font-semibold">
                            Rs. {expenses.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="font-bold text-primary text-sm">
                          Rs. {capitalized.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {isSold ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground">
                            SOLD
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-primary">
                            In Stock
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <button
                          onClick={() => { setDeleteError(""); setDeleteTarget(v); }}
                          title={isSold ? "Cannot delete a sold vehicle — reverse the sale first" : "Delete purchase record & reverse accounting"}
                          className={`
                            inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                            transition-all duration-150
                            ${isSold
                              ? "text-muted-foreground cursor-not-allowed bg-muted border border-border"
                              : "text-red-500 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200 opacity-0 group-hover:opacity-100"
                            }
                          `}
                        >
                          <Trash2 size={13} />
                          {isSold ? "Sold" : "Delete"}
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {/* --- Dynamic Summation Row --- */}
                <tr className="bg-muted/80 font-bold border-t-2 border-border">
                  <td className="px-4 py-3 text-muted-foreground text-xs font-mono">TOTAL</td>
                  <td className="px-4 py-3 text-foreground" colSpan={4}>
                    Showing {filteredVehicles.length} matching vehicles
                  </td>
                  <td className="px-4 py-3 text-right text-foreground text-sm">
                    Rs. {filteredTotals.purchaseTotal.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-orange-700 text-sm">
                    Rs. {filteredTotals.expensesTotal.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-blue-800 text-sm font-extrabold bg-muted/50">
                    Rs. {filteredTotals.capitalizedTotal.toLocaleString()}
                  </td>
                  <td className="px-4 py-3" colSpan={2} />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
