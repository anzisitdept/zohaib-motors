"use client";
import { useState, useEffect } from "react";
import { collection, onSnapshot, query, where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, CheckCircle2, History, Printer, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

export const SettledPlansManager = () => {
  const { user } = useAuth();
  const [plans, setPlans] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // We fetch where status == "settled"
    const q = query(
      collection(db, "installmentPlans"),
      where("status", "==", "settled")
    );
    
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      const enriched = docs.map((plan: any) => {
        // Derive settlement date by looking at the last paidAt in the schedule
        let settledOn = plan.updatedAt?.toDate ? plan.updatedAt.toDate() : null; // fallback
        let numPaid = 0;

        if (Array.isArray(plan.installmentSchedule)) {
          numPaid = plan.installmentSchedule.filter((i: any) => i.paid).length;
          
          const sortedPaid = plan.installmentSchedule
            .filter((i: any) => i.paid && i.paidAt)
            .sort((a: any, b: any) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());
            
          if (sortedPaid.length > 0) {
            settledOn = new Date(sortedPaid[0].paidAt);
          }
        }

        return {
          ...plan,
          clientName: plan.clientName || "Unknown Client",
          vehicleName: plan.vehicleName || "Unknown Vehicle",
          settledOn,
          numPaid
        };
      });

      // Sort most recently settled first
      enriched.sort((a, b) => {
        if (!a.settledOn) return 1;
        if (!b.settledOn) return -1;
        return b.settledOn.getTime() - a.settledOn.getTime();
      });

      setPlans(enriched);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const filteredPlans = plans.filter(p => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      (p.clientName || "").toLowerCase().includes(s) ||
      (p.vehicleName || "").toLowerCase().includes(s)
    );
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-slate-700 rounded-xl text-white shadow-sm">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Settled Plans</h1>
            <p className="text-sm text-muted-foreground">Historical archive of fully paid installment contracts</p>
          </div>
        </div>
      </div>

      <Card className="border-border shadow-sm">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/30">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by client or vehicle..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 pl-9 pr-4 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>
        </div>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading settled plans...</div>
          ) : filteredPlans.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-card border-dashed border-border text-muted-foreground">
              <History size={48} className="mb-4 opacity-20" />
              <p className="font-medium text-base text-foreground mb-1">No settled plans yet</p>
              <p className="text-sm text-center max-w-md">Plans automatically move here once their outstanding balance reaches Rs. 0.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted text-muted-foreground border-b border-border">
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">Client & Vehicle</th>
                    <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wide">Total Amount</th>
                    <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wide">Inst. Paid</th>
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">Settled On</th>
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredPlans.map((plan) => (
                    <tr key={plan.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-foreground">{plan.clientName}</div>
                        <div className="text-xs text-muted-foreground">{plan.vehicleName}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        Rs. {Number(plan.totalAmount || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono bg-muted px-2 py-0.5 rounded text-xs">{plan.numPaid}</span>
                      </td>
                      <td className="px-4 py-3">
                        {plan.settledOn ? (
                          <span className="font-medium text-slate-600 dark:text-slate-400">
                            {plan.settledOn.toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Unknown</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          Settled
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" title="View Details">
                          <Eye size={16} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" title="Download History">
                          <Printer size={16} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
