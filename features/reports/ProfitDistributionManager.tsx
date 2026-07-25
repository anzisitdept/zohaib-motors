"use client";
import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy, doc, runTransaction, serverTimestamp, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PieChart, Plus, CheckCircle2, History, Car, Calculator, AlertTriangle, Users, Trash2 } from "lucide-react";
import { SearchSelector } from "@/components/ui/SearchSelector";

export const ProfitDistributionManager = () => {
  const { user } = useAuth();
  
  // Data
  const [soldCars, setSoldCars] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  
  // State
  const [selectedCarId, setSelectedCarId] = useState("");
  const [selectedCar, setSelectedCar] = useState<any | null>(null);
  
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

    // 2. Fetch Partners
    const qPartners = query(collection(db, "accounts"), where("typeName", "==", "Partner"));
    const unsubPartners = onSnapshot(qPartners, snap => {
      setPartners(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    
    // 3. Fetch Distribution History
    const qDist = query(collection(db, "profitDistributions"), orderBy("createdAt", "desc"));
    const unsubDist = onSnapshot(qDist, snap => {
      setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubCars(); unsubPartners(); unsubDist(); };
  }, []);

  useEffect(() => {
    const car = soldCars.find(c => c.id === selectedCarId) || null;
    setSelectedCar(car);
    setSplits([]);
  }, [selectedCarId, soldCars]);

  const netProfit = selectedCar ? Number(selectedCar.netProfit ?? (Number(selectedCar.salePrice || 0) - Number(selectedCar.capitalizedCost || 0) - Number(selectedCar.commissionPaid || 0))) : 0;

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
      const evenAmt = (netProfit / count).toFixed(0);
      setSplits(splits.map(s => ({ ...s, value: evenAmt })));
    }
  };

  // Validate totals
  let totalAllocated = 0;
  splits.forEach(s => {
    const val = Number(s.value) || 0;
    if (splitMethod === "percentage") {
      totalAllocated += (netProfit * val) / 100;
    } else {
      totalAllocated += val;
    }
  });
  
  const isBalanced = splitMethod === "percentage" 
    ? Math.abs(splits.reduce((sum, s) => sum + (Number(s.value) || 0), 0) - 100) < 0.1
    : Math.abs(totalAllocated - netProfit) < 1;

  const handlePostDistribution = async () => {
    if (!selectedCar) return;
    if (splits.some(s => !s.partnerId || !s.value)) {
      alert("Please fill in all partner split details."); return;
    }
    if (!isBalanced) {
      alert(splitMethod === "percentage" ? "Total percentage must equal 100%." : "Total allocated amount must equal the Net Profit.");
      return;
    }
    if (!confirm("Are you sure you want to POST this profit distribution? This will update partner account balances and cannot be undone.")) return;

    setPosting(true);
    try {
      await runTransaction(db, async (tx) => {
        // 1. Prepare breakdown
        const breakdown = splits.map(s => {
          const val = Number(s.value);
          const amount = splitMethod === "percentage" ? (netProfit * val) / 100 : val;
          return {
            partnerId: s.partnerId,
            partnerName: s.partnerName,
            percentage: splitMethod === "percentage" ? val : (val / netProfit) * 100,
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
                description: `Profit Distribution: ${selectedCar.brandName} ${selectedCar.model} · Partner: ${split.partnerName}`,
                amount: split.amount,
                debit: split.amount,
                credit: split.amount,
                counterAccountId: split.partnerId,
                counterAccountName: split.partnerName,
                counterType: "credit",
                vehicleId: selectedCar.id,
                createdAt: serverTimestamp(),
                createdBy: user?.uid
              });
            }
          }
        }

        // 3. Mark car as distributed
        tx.update(doc(db, "cars", selectedCar.id), {
          profitDistributed: true,
          updatedAt: serverTimestamp()
        });

        // 4. Save Distribution Record
        tx.set(doc(collection(db, "profitDistributions")), {
          vehicleId: selectedCar.id,
          vehicleName: `${selectedCar.brandName} ${selectedCar.model}`,
          chassisNumber: selectedCar.chassisNumber || "N/A",
          revenue: selectedCar.salePrice,
          cogs: selectedCar.capitalizedCost,
          netProfit: netProfit,
          breakdown: breakdown,
          createdAt: serverTimestamp(),
          createdBy: user?.uid
        });
      });
      
      setSelectedCarId("");
      alert("Profit distribution successfully posted!");
    } catch (err: any) {
      console.error(err);
      alert("Failed to post distribution: " + err.message);
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-600 rounded-xl text-white shadow-sm">
            <PieChart size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Deal-by-Deal Profit Share</h1>
            <p className="text-sm text-muted-foreground">Distribute net profits from sold vehicles to partners.</p>
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
                  <Car size={18} className="text-indigo-600" /> Select Sold Vehicle
                </CardTitle>
                <CardDescription>Choose a sold vehicle to distribute its profit. Vehicles already distributed are hidden.</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <SearchSelector
                  items={soldCars}
                  value={selectedCarId}
                  onChange={setSelectedCarId}
                  placeholder="Select a vehicle..."
                  searchPlaceholder="Search by name or chassis..."
                  getSearchFields={c => [c.brandName, c.model, c.chassisNumber]}
                  itemKey={c => c.id}
                  renderTrigger={selected => selected ? <span className="font-semibold text-foreground">{selected.brandName} {selected.model} <span className="text-muted-foreground ml-2">(Profit: Rs. {Number(selected.netProfit ?? (selected.salePrice - selected.capitalizedCost - (selected.commissionPaid||0))).toLocaleString()})</span></span> : <span className="text-muted-foreground">Choose a sold vehicle...</span>}
                  renderItem={c => (
                    <div className="flex justify-between items-center w-full text-left">
                      <div>
                        <div className="font-semibold">{c.brandName} {c.model}</div>
                        <div className="text-xs text-muted-foreground">Chassis: {c.chassisNumber}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-muted-foreground uppercase">Net Profit</div>
                        <div className="font-bold text-emerald-600">Rs. {Number(c.netProfit ?? (c.salePrice - c.capitalizedCost - (c.commissionPaid||0))).toLocaleString()}</div>
                      </div>
                    </div>
                  )}
                />

                {selectedCar && (
                  <div className="mt-6 space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-muted p-4 rounded-xl border border-border">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Sale Revenue</p>
                        <p className="text-lg font-semibold text-foreground">Rs. {Number(selectedCar.salePrice || 0).toLocaleString()}</p>
                      </div>
                      <div className="bg-muted p-4 rounded-xl border border-border">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Total COGS</p>
                        <p className="text-lg font-semibold text-foreground">Rs. {Number(selectedCar.capitalizedCost || 0).toLocaleString()}</p>
                      </div>
                      <div className="bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50">
                        <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-1">Net Profit</p>
                        <p className="text-xl font-black text-emerald-700 dark:text-emerald-400">Rs. {netProfit.toLocaleString()}</p>
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
                            <div className="flex-1">
                              <select 
                                value={split.partnerId}
                                onChange={e => updateSplit(idx, "partnerId", e.target.value)}
                                className="w-full h-10 px-3 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                              >
                                <option value="" className="text-muted-foreground">Select Partner...</option>
                                {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                              </select>
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
                {!selectedCar ? (
                  <div className="text-center text-muted-foreground text-xs py-8">Select a vehicle to view summary.</div>
                ) : (
                  <>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Total Net Profit</span>
                        <span className="font-bold text-foreground">Rs. {netProfit.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Allocated</span>
                        <span className="font-bold text-indigo-600">Rs. {totalAllocated.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm border-t border-border pt-3">
                        <span className="font-bold text-foreground">Remaining</span>
                        <span className={`font-black ${netProfit - totalAllocated === 0 ? "text-emerald-500" : "text-red-500"}`}>
                          Rs. {Math.abs(netProfit - totalAllocated).toLocaleString()}
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
                      disabled={posting || !selectedCar || !isBalanced || splits.length === 0}
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
                    <div className="font-semibold text-sm text-foreground truncate">{h.vehicleName}</div>
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
