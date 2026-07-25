"use client";
import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy, where, doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, Search, Calendar, ChevronRight, Bell, History, Edit2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { RecordPaymentModal } from "./RecordPaymentModal";
import { EditInstallmentPlanModal } from "./EditInstallmentPlanModal";
import Link from "next/link";

export const InstallmentPlansManager = () => {
  const { user } = useAuth();
  const [plans, setPlans] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  // For the Record Payment modal
  const [paymentPlan, setPaymentPlan] = useState<any | null>(null);

  // For the Edit Plan modal
  const [editPlan, setEditPlan] = useState<any | null>(null);

  useEffect(() => {
    // Fetch active/due_soon/overdue plans
    const q = query(
      collection(db, "installmentPlans"),
      where("status", "in", ["active", "due_soon", "overdue"])
    );

    const unsub = onSnapshot(q, async (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));

      // Fetch associated clients and vehicles if not denormalized
      const enriched = await Promise.all(docs.map(async (plan) => {
        let clientName = plan.clientName || "Unknown Client";
        let vehicleName = plan.vehicleName || "Unknown Vehicle";
        let nextDueDate = null;

        if (plan.installmentSchedule && Array.isArray(plan.installmentSchedule)) {
          const unpaid = plan.installmentSchedule.filter((i: any) => !i.paid).sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
          if (unpaid.length > 0) {
            nextDueDate = unpaid[0].dueDate;
          }
        }

        return {
          ...plan,
          clientName,
          vehicleName,
          nextDueDate
        };
      }));

      // Sort by next due date
      enriched.sort((a, b) => {
        if (!a.nextDueDate) return 1;
        if (!b.nextDueDate) return -1;
        return new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime();
      });

      setPlans(enriched);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleCancelPlan = async (plan: any) => {
    if (!confirm(`Are you sure you want to cancel the installment plan for ${plan.clientName}? This will remove it from active lists but keep the history.`)) return;
    try {
      await updateDoc(doc(db, "installmentPlans", plan.id), {
        status: "cancelled",
        updatedAt: serverTimestamp(),
      });
      alert("Plan cancelled successfully.");
    } catch (err: any) {
      console.error(err);
      alert("Failed to cancel plan: " + err.message);
    }
  };

  const getStatusPill = (status: string) => {
    switch (status) {
      case "active":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Current</span>;
      case "due_soon":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">Due Soon</span>;
      case "overdue":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">Overdue</span>;
      case "settled":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">Settled</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-50 text-slate-700 border border-slate-200">{status}</span>;
    }
  };

  const filteredPlans = plans.filter(p => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      (p.clientName || "").toLowerCase().includes(s) ||
      (p.vehicleName || "").toLowerCase().includes(s) ||
      (p.clientEmail || "").toLowerCase().includes(s)
    );
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-600 rounded-xl text-white shadow-sm">
            <CreditCard size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Installment Plans</h1>
            <p className="text-sm text-muted-foreground">Manage active vehicle payment plans</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/installments/new">
            <Button className="bg-primary hover:bg-primary/90 text-white font-semibold shadow-sm">
              New Installment Plan
            </Button>
          </Link>
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
              className="w-full h-10 pl-9 pr-4 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading plans...</div>
          ) : filteredPlans.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-card border-dashed border-border text-muted-foreground">
              <CreditCard size={48} className="mb-4 opacity-20" />
              <p className="font-medium text-sm">No installment plans found</p>
              <p className="text-xs mt-1">Create a new plan through the New Installment Plan flow.</p>
              <Link href="/dashboard/installments/new">
                <Button variant="outline" className="font-medium mt-4">Create New Plan</Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted text-muted-foreground border-b border-border">
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">Client & Vehicle</th>
                    <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wide">Total Amount</th>
                    <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wide">Monthly Inst.</th>
                    <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wide">Balance</th>
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">Next Due Date</th>
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
                      <td className="px-4 py-3 text-right font-medium text-muted-foreground">
                        Rs. {Number(plan.monthlyInstallmentAmount || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-primary">
                        Rs. {Number(plan.outstandingBalance || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        {plan.nextDueDate ? (
                          <span className="flex items-center gap-1.5 font-medium">
                            <Calendar size={14} className="text-muted-foreground" />
                            {new Date(plan.nextDueDate).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">None</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {getStatusPill(plan.status)}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
                          onClick={() => setPaymentPlan(plan)}
                        >
                          Record Payment
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setEditPlan(plan)} className="h-8 w-8 text-muted-foreground hover:text-indigo-600" title="Edit Schedule">
                          <Edit2 size={16} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleCancelPlan(plan)} className="h-8 w-8 text-muted-foreground hover:text-red-600" title="Cancel Plan">
                          <Trash2 size={16} />
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

      {/* Record Payment Modal */}
      {paymentPlan && (
        <RecordPaymentModal
          plan={paymentPlan}
          open={!!paymentPlan}
          onClose={() => setPaymentPlan(null)}
        />
      )}

      {/* Edit Plan Modal */}
      {editPlan && (
        <EditInstallmentPlanModal
          plan={editPlan}
          open={!!editPlan}
          onClose={() => setEditPlan(null)}
        />
      )}
    </div>
  );
};
