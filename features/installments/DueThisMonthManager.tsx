"use client";
import { useState, useEffect } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, Search, Calendar, Bell, CheckCircle2, AlertTriangle, ListTodo } from "lucide-react";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { cn } from "@/lib/utils";
import { RecordPaymentModal } from "./RecordPaymentModal";

export const DueThisMonthManager = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dueInstallments, setDueInstallments] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  // For the Record Payment modal
  const [paymentPlan, setPaymentPlan] = useState<any | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, "installmentPlans"),
      where("status", "in", ["active", "due_soon", "overdue"])
    );

    const unsub = onSnapshot(q, (snap) => {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

      let items: any[] = [];

      snap.docs.forEach((d) => {
        const plan = { id: d.id, ...d.data() } as any;
        if (Array.isArray(plan.installmentSchedule)) {
          plan.installmentSchedule.forEach((inst: any) => {
            if (!inst.paid && inst.dueDate) {
              const instDate = new Date(inst.dueDate);
              
              // Only include if it's due this month/year, OR if it's already overdue from a previous month
              const isOverdue = instDate.getTime() < today;
              const isThisMonth = instDate.getMonth() === currentMonth && instDate.getFullYear() === currentYear;
              
              if (isThisMonth || isOverdue) {
                const diffTime = instDate.getTime() - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                items.push({
                  ...inst,
                  planId: plan.id,
                  plan,
                  clientName: plan.clientName || "Unknown Client",
                  vehicleName: plan.vehicleName || "Unknown Vehicle",
                  clientEmail: plan.clientEmail || "",
                  diffDays,
                  isOverdue
                });
              }
            }
          });
        }
      });

      // Sort: Overdue items first (most overdue first), then soonest due items
      items.sort((a, b) => {
        if (a.isOverdue && !b.isOverdue) return -1;
        if (!a.isOverdue && b.isOverdue) return 1;
        return a.diffDays - b.diffDays;
      });

      setDueInstallments(items);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const filteredItems = dueInstallments.filter(item => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      (item.clientName || "").toLowerCase().includes(s) ||
      (item.vehicleName || "").toLowerCase().includes(s) ||
      (item.clientEmail || "").toLowerCase().includes(s)
    );
  });

  // Convert a phone number into the international format WhatsApp accepts (digits only, with country code)
  const toWhatsAppNumber = (raw: string) => {
    let digits = String(raw || "").replace(/[^\d]/g, "");
    if (digits.startsWith("00")) digits = digits.slice(2);
    if (digits.startsWith("0")) digits = "92" + digits.slice(1); // local Pakistani number -> +92
    else if (digits.startsWith("3") && digits.length === 10) digits = "92" + digits; // 3XXXXXXXXX -> +92
    return digits;
  };

  const openWhatsAppChat = (item: any) => {
    const number = toWhatsAppNumber(item.plan.clientPhone);
    if (!number || number.length < 8) {
      alert("Invalid phone number for WhatsApp. Please add a valid number to the plan.");
      return;
    }
    const text = encodeURIComponent(`Hello ${item.clientName}, a reminder that your installment of Rs. ${Number(item.amount || 0).toLocaleString()} for ${item.vehicleName} is due on ${new Date(item.dueDate).toLocaleDateString()}.`);
    window.open(`https://wa.me/${number}?text=${text}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500 rounded-xl text-white shadow-sm">
            <ListTodo size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Due This Month</h1>
            <p className="text-sm text-muted-foreground">Operational view of upcoming and overdue collections</p>
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
              className="w-full h-10 pl-9 pr-4 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading due installments...</div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-card border-dashed border-border">
              <CheckCircle2 size={48} className="mb-4 text-emerald-500/20" />
              <p className="font-medium text-base text-emerald-600 mb-1">Nothing due this month</p>
              <p className="text-sm text-muted-foreground text-center max-w-md">All collections for this month are caught up.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted text-muted-foreground border-b border-border">
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">Client & Vehicle</th>
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">Inst. No.</th>
                    <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wide">Amount Due</th>
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">Due Date</th>
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">Days Until</th>
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredItems.map((item, idx) => (
                    <tr key={`${item.planId}-${idx}`} className={cn("transition-colors", item.isOverdue ? "bg-red-50/20 hover:bg-red-50/40" : "hover:bg-muted/50")}>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-foreground">{item.clientName}</div>
                        <div className="text-xs text-muted-foreground">{item.vehicleName}</div>
                        {item.plan.clientPhone && (
                          <div className="text-xs text-muted-foreground mt-0.5">{item.plan.clientPhone}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {item.installmentNo}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-primary">
                        Rs. {Number(item.amount || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 font-medium">
                          <Calendar size={14} className="text-muted-foreground" />
                          {new Date(item.dueDate).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {item.isOverdue ? (
                          <span className="text-red-600 font-bold">{Math.abs(item.diffDays)} days ago</span>
                        ) : item.diffDays === 0 ? (
                          <span className="text-amber-600 font-bold">Today</span>
                        ) : (
                          <span className="text-muted-foreground font-medium">In {item.diffDays} days</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {item.isOverdue ? (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">Overdue</span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">Due Soon</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 px-2 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
                          onClick={() => setPaymentPlan(item.plan)}
                        >
                          Make Payment
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-[#25D366] hover:text-[#1DA851] hover:bg-green-50" 
                          disabled={!item.plan.clientPhone}
                          title={item.plan.clientPhone ? "Send WhatsApp Reminder" : "No phone number available"}
                          onClick={() => openWhatsAppChat(item)}
                        >
                          <WhatsAppIcon size={18} />
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
    </div>
  );
};
