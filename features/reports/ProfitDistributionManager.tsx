"use client";
import { useState, useEffect, useMemo } from "react";
import { collection, onSnapshot, query, orderBy, doc, runTransaction, serverTimestamp, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PieChart, Plus, CheckCircle2, History, Calendar, Calculator, AlertTriangle, Trash2 } from "lucide-react";
import { SearchSelector } from "@/components/ui/SearchSelector";

export const ProfitDistributionManager = () => {
  const { user } = useAuth();
  
  // Data
  const [soldCars, setSoldCars] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  
  // State
  const [selectedMonth, setSelectedMonth] = useState("");
  
  // Split logic
  const [splitMethod, setSplitMethod] = useState<"percentage" | "amount">("percentage");
  const [splits, setSplits] = useState<{ partnerId: string; partnerName: string; value: string }[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    // 1. Fetch Sold Cars (that haven't had profit distributed yet)
    const qCars = query(collection(db, "cars"), where("isSold", "==", true));
    const unsubCars = onSnapshot(qCars, snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() as any }));
      // Filter out cars that already have profit distributed
      setSoldCars(all.filter(c => !c.profitDistributed).sort((a, b) => b.saleDate?.localeCompare(a.saleDate)));
    });

    // 2. Fetch Partners (All Accounts)
    const qPartners = query(collection(db, "accounts"));
    const unsubPartners = onSnapshot(qPartners, snap => {
      // Sort in memory just in case
      const accs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      accs.sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));
      setPartners(accs);
      setLoading(false);
    });
    
    // 3. Fetch Distribution History
    const qDist = query(collection(db, "profitDistributions"), orderBy("createdAt", "desc"));
    const unsubDist = onSnapshot(qDist, snap => {
      setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubCars(); unsubPartners(); unsubDist(); };
  }, []);

  // Group un-distributed cars by month (YYYY-MM)
  const carsByMonth = useMemo(() => {
    const groups: Record<string, any[]> = {};
    soldCars.forEach(car => {
      if (car.saleDate) {
        const monthStr = car.saleDate.substring(0, 7); // YYYY-MM
        if (!groups[monthStr]) groups[monthStr] = [];
        groups[monthStr].push(car);
      }
    });
    return groups;
  }, [soldCars]);

  const availableMonths = useMemo(() => {
    return Object.keys(carsByMonth).sort((a, b) => b.localeCompare(a));
  }, [carsByMonth]);

  useEffect(() => {
    setSplits([]);
  }, [selectedMonth]);

  const selectedCars = selectedMonth ? carsByMonth[selectedMonth] || [] : [];
  
  // Calculate totals for the selected month
  const totalRevenue = selectedCars.reduce((sum, c) => sum + Number(c.salePrice || 0), 0);
  const totalCOGS = selectedCars.reduce((sum, c) => sum + Number(c.capitalizedCost || 0), 0);
  const totalCommission = selectedCars.reduce((sum, c) => sum + Number(c.commissionPaid || 0), 0);
  
  const totalNetProfit = selectedCars.reduce((sum, c) => {
    const carProfit = Number(c.netProfit ?? (Number(c.salePrice || 0) - Number(c.capitalizedCost || 0) - Number(c.commissionPaid || 0)));
    return sum + carProfit;
  }, 0);

  const formatMonthName = (YYYYMM: string) => {
    if (!YYYYMM) return "";
    const [year, month] = YYYYMM.split("-");
    const date = new Date(Number(year), Number(month) - 1);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  const addPartnerSplit = () => {
    setSplits([...splits, { partnerId: "", partnerName: "", value: "" }]);
  };

  const updateSplit = (index: number, field: string, val: string) => {
    const newSplits = [...splits];
    if (field === "partnerId") {
      const p = partners.find(pt => pt.id === val);
      newSplits[index].partnerId = val;
      newSplits[index].partnerName = p ? p.name : "";
    } else {
      newSplits[index].value = val;
    }
    setSplits(newSplits);
  };

  const removeSplit = (index: number) => {
    const newSplits = [...splits];
    newSplits.splice(index, 1);
    setSplits(newSplits);
  };

  const splitEvenly = () => {
    if (splits.length === 0) return;
    const count = splits.length;
    
    if (splitMethod === "percentage") {
      const evenPct = (100 / count).toFixed(2);
      setSplits(splits.map(s => ({ ...s, value: evenPct })));
    } else {
      const evenAmt = (totalNetProfit / count).toFixed(0);
      setSplits(splits.map(s => ({ ...s, value: evenAmt })));
    }
  };

  // Validate totals
  let totalAllocated = 0;
  splits.forEach(s => {
    const val = Number(s.value) || 0;
    if (splitMethod === "percentage") {
      totalAllocated += (totalNetProfit * val) / 100;
    } else {
      totalAllocated += val;
    }
  });
  
  const isBalanced = splitMethod === "percentage" 
    ? Math.abs(splits.reduce((sum, s) => sum + (Number(s.value) || 0), 0) - 100) < 0.1
    : Math.abs(totalAllocated - totalNetProfit) < 1;

  const handlePostDistribution = async () => {
    if (!selectedMonth || selectedCars.length === 0) return;
    if (splits.some(s => !s.partnerId || !s.value)) {
      alert("Please fill in all partner split details."); return;
    }
    if (!isBalanced) {
      alert(splitMethod === "percentage" ? "Total percentage must equal 100%." : "Total allocated amount must equal the Net Profit.");
      return;
    }
    if (!confirm("Are you sure you want to POST this monthly profit distribution? This will update partner account balances and mark all vehicles in this month as distributed.")) return;

    setPosting(true);
    try {
      const monthName = formatMonthName(selectedMonth);

      await runTransaction(db, async (tx) => {
        // 1. Prepare breakdown
        const breakdown = splits.map(s => {
          const val = Number(s.value);
          const amount = splitMethod === "percentage" ? (totalNetProfit * val) / 100 : val;
          return {
            partnerId: s.partnerId,
            partnerName: s.partnerName,
            percentage: splitMethod === "percentage" ? val : (val / totalNetProfit) * 100,
            amount: amount
          };
        });

        // 2. Distribute to partner accounts
        for (const split of breakdown) {
          if (split.amount > 0) {
            const pRef = doc(db, "accounts", split.partnerId);
            const pSnap = await tx.get(pRef);
            if (pSnap.exists()) {
              const prevBal = Number(pSnap.data().balance || 0);
              const newBal = prevBal + split.amount; 
              
              tx.update(pRef, {
                balance: newBal,
                updatedAt: serverTimestamp()
              });
              
              // Voucher
              const vRef = doc(collection(db, "vouchers"));
              tx.set(vRef, {
                voucherNo: "PD-" + Math.floor(100000 + Math.random() * 900000),
                date: new Date().toISOString().split("T")[0],
                description: `Monthly Profit Distribution: ${monthName} · Partner: ${split.partnerName}`,
                amount: split.amount,
                debit: split.amount,
                credit: split.amount,
                counterAccountId: split.partnerId,
                counterAccountName: split.partnerName,
                counterType: "credit",
                reference: selectedMonth,
                createdAt: serverTimestamp(),
                createdBy: user?.uid
              });
            }
          }
        }

        // 3. Mark cars as distributed
        for (const car of selectedCars) {
          tx.update(doc(db, "cars", car.id), {
            profitDistributed: true,
            updatedAt: serverTimestamp()
          });
        }

        // 4. Save Distribution Record
        tx.set(doc(collection(db, "profitDistributions")), {
          month: selectedMonth,
          monthName: monthName,
          title: `Monthly Distribution - ${monthName}`,
          carsIncluded: selectedCars.map(c => c.id),
          carsCount: selectedCars.length,
          revenue: totalRevenue,
          cogs: totalCOGS,
          commission: totalCommission,
          netProfit: totalNetProfit,
          breakdown: breakdown,
          createdAt: serverTimestamp(),
          createdBy: user?.uid
        });
      });
      
      setSelectedMonth("");
      alert("Monthly profit distribution successfully posted!");
    } catch (err: any) {
      console.error(err);
      alert("Failed to post distribution: " + err.message);
    } finally {
      setPosting(false);
    }
  };

  const monthItems = availableMonths.map(m => ({
    id: m,
    name: formatMonthName(m),
    count: carsByMonth[m].length,
    profit: carsByMonth[m].reduce((sum, c) => sum + Number(c.netProfit ?? (Number(c.salePrice || 0) - Number(c.capitalizedCost || 0) - Number(c.commissionPaid || 0))), 0)
  }));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-600 rounded-xl text-white shadow-sm">
            <PieChart size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Monthly Profit Distribution</h1>
            <p className="text-sm text-muted-foreground">Distribute net profits from sold vehicles to partners at the end of each month.</p>
          </div>
        </div>
      </div>

      {loading ? (
        <Card className="border-border shadow-sm p-16 text-center text-muted-foreground">Loading...</Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Col: Setup Split */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border shadow-sm">
              <CardHeader className="border-b border-border bg-card">
                <CardTitle className="text-base text-foreground flex items-center gap-2">
                  <Calendar size={18} className="text-indigo-600" /> Select Month
                </CardTitle>
                <CardDescription>Choose a month to distribute the total profit from all vehicles sold during that time.</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                {availableMonths.length === 0 ? (
                  <div className="text-sm text-muted-foreground p-4 bg-muted rounded-lg border border-border">
                    No pending vehicles found to distribute.
                  </div>
                ) : (
                  <SearchSelector
                    items={monthItems}
                    value={selectedMonth}
                    onChange={setSelectedMonth}
                    placeholder="Select a month..."
                    searchPlaceholder="Search month..."
                    getSearchFields={m => [m.name, m.id]}
                    itemKey={m => m.id}
                    renderTrigger={selected => selected ? <span className="font-semibold text-foreground">{selected.name} <span className="text-muted-foreground ml-2">({selected.count} cars · Profit: Rs. {selected.profit.toLocaleString()})</span></span> : <span className="text-muted-foreground">Choose a month...</span>}
                    renderItem={m => (
                      <div className="flex justify-between items-center w-full text-left">
                        <div>
                          <div className="font-semibold">{m.name}</div>
                          <div className="text-xs text-muted-foreground">{m.count} vehicles pending</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] text-muted-foreground uppercase">Monthly Profit</div>
                          <div className="font-bold text-emerald-600">Rs. {m.profit.toLocaleString()}</div>
                        </div>
                      </div>
                    )}
                  />
                )}

                {selectedMonth && (
                  <div className="mt-6 space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-muted p-4 rounded-xl border border-border">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Total Revenue</p>
                        <p className="text-lg font-semibold text-foreground">Rs. {totalRevenue.toLocaleString()}</p>
                      </div>
                      <div className="bg-muted p-4 rounded-xl border border-border">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Total COGS</p>
                        <p className="text-lg font-semibold text-foreground">Rs. {totalCOGS.toLocaleString()}</p>
                      </div>
                      <div className="bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50">
                        <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-1">Total Net Profit</p>
                        <p className="text-xl font-black text-emerald-700 dark:text-emerald-400">Rs. {totalNetProfit.toLocaleString()}</p>
                      </div>
                    </div>
                    
                    <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3">
                       <p className="text-xs font-semibold mb-2">Vehicles Included ({selectedCars.length}):</p>
                       <div className="flex flex-wrap gap-2">
                          {selectedCars.map(c => (
                            <span key={c.id} className="text-[10px] bg-white dark:bg-slate-800 px-2 py-1 rounded shadow-sm border border-border">
                              {c.brandName} {c.model} (Rs. {Number(c.netProfit ?? (Number(c.salePrice || 0) - Number(c.capitalizedCost || 0) - Number(c.commissionPaid || 0))).toLocaleString()})
                            </span>
                          ))}
                       </div>
                    </div>

                    <div className="pt-4 border-t border-border space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-foreground">Partner Allocation</h4>
                        <div className="flex bg-muted p-1 rounded-lg border border-border">
                          <button onClick={() => setSplitMethod("percentage")} className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${splitMethod === "percentage" ? "bg-white dark:bg-slate-800 shadow-sm text-foreground" : "text-muted-foreground"}`}>Percentage %</button>
                          <button onClick={() => setSplitMethod("amount")} className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${splitMethod === "amount" ? "bg-white dark:bg-slate-800 shadow-sm text-foreground" : "text-muted-foreground"}`}>Fixed Amount</button>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {splits.map((split, idx) => (
                          <div key={idx} className="flex items-center gap-3">
                            <div className="flex-1 min-w-[200px]">
                              <SearchSelector
                                items={partners}
                                value={split.partnerId}
                                onChange={val => updateSplit(idx, "partnerId", val)}
                                placeholder="Select Ledger Account..."
                                searchPlaceholder="Search accounts..."
                                getSearchFields={p => [p.name, p.typeName]}
                                itemKey={p => p.id}
                                renderTrigger={selected => selected ? <span className="font-semibold text-sm truncate">{selected.name} <span className="text-muted-foreground text-xs font-normal">({selected.typeName || "Account"})</span></span> : <span className="text-muted-foreground text-sm">Select Account...</span>}
                                renderItem={p => (
                                  <div className="flex justify-between items-center w-full">
                                    <div className="font-medium text-sm">{p.name}</div>
                                    <div className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded">{p.typeName || "Account"}</div>
                                  </div>
                                )}
                              />
                            </div>
                            <div className="w-32 relative">
                              <Input 
                                type="number" 
                                value={split.value} 
                                onChange={e => updateSplit(idx, "value", e.target.value)} 
                                placeholder={splitMethod === "percentage" ? "e.g. 50" : "e.g. 50000"} 
                                className="h-10 pr-8 font-semibold bg-card"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">
                                {splitMethod === "percentage" ? "%" : "Rs"}
                              </span>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => removeSplit(idx)} className="text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0">
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center gap-3 mt-4">
                        <Button variant="outline" onClick={addPartnerSplit} className="text-xs font-semibold border-dashed h-9">
                          <Plus size={14} className="mr-1.5" /> Add Partner
                        </Button>
                        {splits.length > 0 && (
                          <Button variant="secondary" onClick={splitEvenly} className="text-xs font-semibold h-9">
                            <Calculator size={14} className="mr-1.5" /> Split Evenly
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Col: Summary & Post */}
          <div className="space-y-6">
            <Card className="border-border shadow-sm">
              <CardHeader className="bg-indigo-50 dark:bg-indigo-950/20 border-b border-indigo-100 dark:border-indigo-900/50">
                <CardTitle className="text-sm text-indigo-900 dark:text-indigo-400">Distribution Summary</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {!selectedMonth ? (
                  <div className="text-center text-muted-foreground text-xs py-8">Select a month to view summary.</div>
                ) : (
                  <>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Total Net Profit</span>
                        <span className="font-bold text-foreground">Rs. {totalNetProfit.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Allocated</span>
                        <span className="font-bold text-indigo-600">Rs. {totalAllocated.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm border-t border-border pt-3">
                        <span className="font-bold text-foreground">Remaining</span>
                        <span className={`font-black ${totalNetProfit - totalAllocated === 0 ? "text-emerald-500" : "text-red-500"}`}>
                          Rs. {Math.abs(totalNetProfit - totalAllocated).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {!isBalanced && splits.length > 0 && (
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-400 text-xs rounded-lg border border-amber-200 dark:border-amber-900/50 flex gap-2">
                        <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                        <span>The allocation must perfectly match the total Net Profit to proceed.</span>
                      </div>
                    )}

                    <Button 
                      onClick={handlePostDistribution} 
                      disabled={posting || !selectedMonth || !isBalanced || splits.length === 0}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-12 shadow-sm"
                    >
                      {posting ? "Posting..." : <><CheckCircle2 size={18} className="mr-2" /> Post to Ledgers</>}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm">
              <CardHeader className="border-b border-border pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <History size={16} className="text-muted-foreground" /> Recent History
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {history.slice(0, 5).map(h => (
                  <div key={h.id} className="p-4 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <div className="font-semibold text-sm text-foreground truncate">{h.title || h.vehicleName}</div>
                    <div className="flex justify-between items-center mt-1 text-xs">
                      <span className="text-muted-foreground">{new Date(h.createdAt?.toDate()).toLocaleDateString()}</span>
                      <span className="font-bold text-emerald-600">Rs. {Number(h.netProfit).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
                {history.length === 0 && <div className="p-6 text-center text-xs text-muted-foreground">No distribution history.</div>}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};
