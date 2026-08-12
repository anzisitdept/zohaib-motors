"use client";

import { useState, useEffect, useMemo } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  FileText, Search, Filter, X, CheckCircle2, Users, ShoppingBag,
  DollarSign, TrendingUp, Wallet, Car, AlertTriangle
} from "lucide-react";

export function PurchaseInvoicesList() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [stockFilter, setStockFilter] = useState("ALL");


  useEffect(() => {
    const q = query(collection(db, "cars"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const all: any[] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Purchase invoices are vehicles with a purchase price greater than zero
      setInvoices(all.filter(v => v.purchasePrice && v.purchasePrice > 0));
      setLoading(false);
    }, (err) => {
      console.error("Error fetching purchase invoices:", err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Filtered Invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      // 1. Search Query
      const s = searchTerm.toLowerCase().trim();
      const matchesSearch = !s ||
        `${inv.brandName} ${inv.model}`.toLowerCase().includes(s) ||
        (inv.chassisNumber || "").toLowerCase().includes(s) ||
        (inv.sellerClientName || "").toLowerCase().includes(s) ||
        (inv.color || "").toLowerCase().includes(s);

      // 2. Payment Status
      const matchesPayment = paymentFilter === "ALL" ||
        (paymentFilter === "PAID" && inv.isPaid) ||
        (paymentFilter === "UNPAID" && !inv.isPaid);

      // 3. Stock Status
      const matchesStock = stockFilter === "ALL" ||
        (stockFilter === "SOLD" && inv.isSold) ||
        (stockFilter === "INSTOCK" && !inv.isSold);

      return matchesSearch && matchesPayment && matchesStock;
    });
  }, [invoices, searchTerm, paymentFilter, stockFilter]);

  // Statistics Summary
  const stats = useMemo(() => {
    const totalCount = filteredInvoices.length;
    const totalInvested = filteredInvoices.reduce((sum, inv) => sum + (Number(inv.purchasePrice) || 0), 0);
    
    let paidCount = 0;
    let paidAmount = 0;
    let unpaidCount = 0;
    let unpaidAmount = 0;
    let soldCount = 0;
    let inStockCount = 0;

    filteredInvoices.forEach(inv => {
      const price = Number(inv.purchasePrice) || 0;
      if (inv.isPaid) {
        paidCount++;
        paidAmount += price;
      } else {
        unpaidCount++;
        unpaidAmount += price;
      }

      if (inv.isSold) {
        soldCount++;
      } else {
        inStockCount++;
      }
    });

    return {
      totalCount,
      totalInvested,
      paidCount,
      paidAmount,
      unpaidCount,
      unpaidAmount,
      soldCount,
      inStockCount
    };
  }, [filteredInvoices]);

  const clearFilters = () => {
    setSearchTerm("");
    setPaymentFilter("ALL");
    setStockFilter("ALL");

  };

  const hasActiveFilters = searchTerm || paymentFilter !== "ALL" || stockFilter !== "ALL";

  return (
    <div className="space-y-6">
      {/* --- Dashboard Statistics Cards --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Invoices */}
        <Card className="border-border/80 shadow-sm overflow-hidden bg-card hover:shadow-md transition-shadow duration-200">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Total Purchases</span>
              <p className="text-3xl font-extrabold text-foreground">{stats.totalCount}</p>
              <p className="text-xs text-muted-foreground font-medium">Invoices listed</p>
            </div>
            <div className="p-3.5 bg-muted text-primary rounded-2xl shadow-inner">
              <FileText size={24} />
            </div>
          </CardContent>
        </Card>

        {/* Total Invested capital */}
        <Card className="border-border/80 shadow-sm overflow-hidden bg-card hover:shadow-md transition-shadow duration-200">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Total Capital Outlay</span>
              <p className="text-2xl font-extrabold text-primary">Rs. {stats.totalInvested.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground font-medium">Total cost of vehicles</p>
            </div>
            <div className="p-3.5 bg-muted text-primary rounded-2xl shadow-inner">
              <DollarSign size={24} />
            </div>
          </CardContent>
        </Card>

        {/* Paid vs Unpaid */}
        <Card className="border-border/80 shadow-sm overflow-hidden bg-card hover:shadow-md transition-shadow duration-200">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1 w-full">
              <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider block">Payment Summary</span>
              <div className="flex items-baseline justify-between mt-1">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-primary">Paid: {stats.paidCount}</span>
                  <span className="text-sm font-bold text-foreground">Rs. {stats.paidAmount.toLocaleString()}</span>
                </div>
                <div className="border-l border-border h-8 mx-2" />
                <div className="flex flex-col text-right">
                  <span className="text-xs font-semibold text-primary">Unpaid: {stats.unpaidCount}</span>
                  <span className="text-sm font-bold text-foreground">Rs. {stats.unpaidAmount.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stock Status */}
        <Card className="border-border/80 shadow-sm overflow-hidden bg-card hover:shadow-md transition-shadow duration-200">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Inventory Status</span>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex flex-col">
                  <span className="text-2xl font-extrabold text-foreground">{stats.inStockCount}</span>
                  <span className="text-[10px] text-primary bg-muted px-1.5 py-0.5 rounded-full font-bold uppercase">In Stock</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-2xl font-extrabold text-muted-foreground">{stats.soldCount}</span>
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full font-bold uppercase">Sold</span>
                </div>
              </div>
            </div>
            <div className="p-3.5 bg-emerald-50 text-primary rounded-2xl shadow-inner">
              <ShoppingBag size={24} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* --- Filter and Search Toolbar --- */}
      <Card className="border-border shadow-sm print-hide bg-muted/50">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col lg:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 text-muted-foreground" size={16} />
              <Input
                className="pl-10 bg-card border-border shadow-sm"
                placeholder="Search by vehicle name, chassis number, seller name..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap gap-2.5 items-center">
              {/* Payment Filter */}
              <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger className="w-[140px] h-10 bg-card text-xs border-border shadow-sm">
                  <SelectValue placeholder="Payment status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Payments</SelectItem>
                  <SelectItem value="PAID">Paid Only</SelectItem>
                  <SelectItem value="UNPAID">Unpaid Only</SelectItem>
                </SelectContent>
              </Select>

              {/* Stock Filter */}
              <Select value={stockFilter} onValueChange={setStockFilter}>
                <SelectTrigger className="w-[140px] h-10 bg-card text-xs border-border shadow-sm">
                  <SelectValue placeholder="Stock status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Inventory</SelectItem>
                  <SelectItem value="INSTOCK">In Stock</SelectItem>
                  <SelectItem value="SOLD">Marked SOLD</SelectItem>
                </SelectContent>
              </Select>



              {/* Reset Button */}
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-10 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-3"
                >
                  <X size={14} className="mr-1" /> Reset Filters
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* --- Invoices History Table --- */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-card border border-border rounded-2xl shadow-sm">
          <p className="text-muted-foreground text-sm font-medium">Loading purchase invoices...</p>
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-card border border-dashed border-border rounded-2xl text-muted-foreground">
          <FileText size={48} className="mb-3 opacity-30 text-blue-500" />
          <p className="font-semibold text-muted-foreground text-base">No Purchase Invoices Found</p>
          <p className="text-xs text-muted-foreground mt-1">Try refining your search keyword or active filters.</p>
          {hasActiveFilters && (
            <Button variant="link" onClick={clearFilters} className="mt-3 text-primary font-medium">Clear Filters</Button>
          )}
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
                  <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">Seller Details</th>
                  <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wide">Purchase Price</th>
                  <th className="px-4 py-3 text-center font-semibold text-xs uppercase tracking-wide">Payment</th>

                  <th className="px-4 py-3 text-center font-semibold text-xs uppercase tracking-wide">Stock Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((inv, idx) => (
                  <tr
                    key={inv.id}
                    className="hover:bg-muted/50 transition-colors duration-150"
                  >
                    <td className="px-4 py-3.5 text-muted-foreground font-mono text-xs">{idx + 1}</td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-foreground">{inv.brandName} {inv.model}</div>
                      {inv.variant && <div className="text-xs text-muted-foreground mt-0.5">{inv.variant}</div>}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-mono text-xs bg-muted px-2.5 py-1 rounded text-foreground border border-border/50">
                        {inv.chassisNumber || inv.chassisNo || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground text-xs">
                      <div className="font-medium">{inv.modelYear || inv.year || "—"}</div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span
                          className="inline-block w-3.5 h-3.5 rounded-full border border-border shadow-sm"
                          style={{ backgroundColor: inv.color?.toLowerCase() || "#ccc" }}
                        />
                        <span>{inv.color || "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-foreground text-xs">
                      <div className="font-medium text-foreground">{inv.sellerClientName || <span className="text-muted-foreground">—</span>}</div>
                      {inv.sellerClientPhone && <div className="text-muted-foreground font-mono mt-0.5">{inv.sellerClientPhone}</div>}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="font-bold text-foreground text-sm">
                        Rs. {Number(inv.purchasePrice || 0).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {inv.isPaid ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-primary">
                          <CheckCircle2 size={10} /> Paid
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                          ⏳ Unpaid
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      {inv.isSold ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground">
                          SOLD
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-primary">
                          <Car size={10} /> In Stock
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Footer Summary */}
          <div className="px-4 py-3 bg-card border-t border-border flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Showing {filteredInvoices.length} of {invoices.length} purchase invoice{invoices.length !== 1 ? "s" : ""}
            </span>
            <span className="text-xs font-bold text-primary">
              Filtered Capital Outlay: Rs. {stats.totalInvested.toLocaleString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
