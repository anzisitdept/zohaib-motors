"use client";
import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RecordPaymentModal } from "./RecordPaymentModal";
import { User, Phone, Mail, Car, Hash, Calendar, CheckCircle2, CreditCard, DollarSign, Wallet, Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const fmtDate = (value: any) => {
  if (!value) return "N/A";
  try {
    if (typeof value === "object" && value.toDate) return value.toDate().toLocaleDateString();
    return new Date(value).toLocaleDateString();
  } catch {
    return "N/A";
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
    case "cancelled":
      return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">Cancelled</span>;
    default:
      return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-50 text-slate-700 border border-slate-200">{status || "Unknown"}</span>;
  }
};

export const PlanDetailsModal = ({ plan, open, onClose }: { plan: any, open: boolean, onClose: () => void }) => {
  const [livePlan, setLivePlan] = useState<any>(plan || null);
  const [payments, setPayments] = useState<any[]>([]);
  const [accountNames, setAccountNames] = useState<Record<string, string>>({});
  const [loadedForId, setLoadedForId] = useState<string | null>(null);
  const loading = open && !!plan && loadedForId !== plan.id;

  // State for payment modal
  const [paymentOpen, setPaymentOpen] = useState(false);

  useEffect(() => {
    if (!open || !plan) return;

    const planRef = doc(db, "installmentPlans", plan.id);
    const unsubPlan = onSnapshot(planRef, (snap) => {
      if (snap.exists()) {
        setLivePlan({ id: snap.id, ...snap.data() });
        setLoadedForId(plan.id);
      }
    }, (err) => {
      console.error(err);
      setLoadedForId(plan.id);
    });

    const unsubPay = onSnapshot(
      query(collection(db, "installmentPlans", plan.id, "payments"), orderBy("paidAt", "desc")),
      (snap) => setPayments(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.error(err)
    );

    const unsubAcc = onSnapshot(query(collection(db, "accounts"), orderBy("name")), (snap) => {
      const map: Record<string, string> = {};
      snap.docs.forEach((d) => { map[d.id] = d.data().name; });
      setAccountNames(map);
    }, (err) => console.error(err));

    return () => { unsubPlan(); unsubPay(); unsubAcc(); };
  }, [open, plan]);

  if (!open || !plan) return null;

  // Find the current due installment: earliest unpaid installment whose due date hasn't passed
  const currentDueInst = (livePlan?.installmentSchedule || [])
    .filter((inst: any) => !inst.paid)
    .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .at(0);

  const schedule = (livePlan?.installmentSchedule || [])
    .map((inst: any, index: number) => ({ ...inst, index }))
    .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const totalPaid = schedule
    .filter((inst: any) => inst.paid)
    .reduce((sum: number, inst: any) => sum + (Number(inst.amount) || 0), 0);

  const totalAmount = Number(livePlan?.totalAmount || 0);
  const downPayment = Number(livePlan?.advancePaid || livePlan?.downPayment || 0);
  const outstandingBalance = Number(livePlan?.outstandingBalance || 0);
  const monthlyInstallment = Number(livePlan?.monthlyInstallmentAmount || 0);

  const summaryCards = [
    { label: "Total Sale Price", value: totalAmount, icon: DollarSign, color: "text-foreground" },
    { label: "Down Payment", value: downPayment, icon: Wallet, color: "text-emerald-600" },
    { label: "Monthly Inst.", value: monthlyInstallment, icon: Calendar, color: "text-muted-foreground" },
    { label: "Outstanding Balance", value: outstandingBalance, icon: CreditCard, color: "text-primary" },
  ];

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 pr-8">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <User className="text-indigo-600" size={20} />
                {plan?.clientName || livePlan?.clientName || "Client"}
              </DialogTitle>
              <DialogDescription className="flex items-center gap-2 mt-1">
                <Car size={14} />
                {plan?.vehicleName || livePlan?.vehicleName || "Unknown Vehicle"}
                {livePlan?.vehicleFileId && <span className="text-xs text-muted-foreground">(File: {livePlan.vehicleFileId})</span>}
              </DialogDescription>
            </div>
            <div className="shrink-0">{getStatusPill(livePlan?.status || plan?.status)}</div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 size={18} className="animate-spin" /> Loading plan details...
          </div>
        ) : (
          <div className="space-y-6">
            {/* Contact Info */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center gap-2.5 p-3 rounded-lg bg-muted/50 border border-border">
                <Phone size={16} className="text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Client Phone</p>
                  <p className="text-sm font-semibold truncate">{livePlan?.clientPhone || "N/A"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 p-3 rounded-lg bg-muted/50 border border-border">
                <Mail size={16} className="text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Client Email</p>
                  <p className="text-sm font-semibold truncate">{livePlan?.clientEmail || "N/A"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 p-3 rounded-lg bg-muted/50 border border-border">
                <Hash size={16} className="text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Plan ID</p>
                  <p className="text-sm font-semibold font-mono truncate">{(plan.id || "").slice(-8).toUpperCase()}</p>
                </div>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {summaryCards.map((card) => (
                <div key={card.label} className="p-3 rounded-lg border border-border bg-card">
                  <card.icon size={16} className="text-muted-foreground mb-2" />
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">{card.label}</p>
                  <p className={cn("text-base font-bold mt-0.5", card.color)}>
                    Rs. {card.value.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>

            {/* Payment Schedule */}
            <div>
              <h4 className="text-sm font-bold text-foreground mb-2 flex items-center gap-1.5">
                <Calendar size={15} className="text-muted-foreground" /> Installment Schedule
                <span className="text-xs font-medium text-muted-foreground">({schedule.length} installments · {totalPaid.toLocaleString()} paid)</span>
              </h4>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted text-muted-foreground border-b border-border">
                      <th className="px-3 py-2.5 text-left font-semibold text-xs uppercase tracking-wide">#</th>
                      <th className="px-3 py-2.5 text-left font-semibold text-xs uppercase tracking-wide">Due Date</th>
                      <th className="px-3 py-2.5 text-right font-semibold text-xs uppercase tracking-wide">Amount</th>
                      <th className="px-3 py-2.5 text-left font-semibold text-xs uppercase tracking-wide">Status</th>
                      <th className="px-3 py-2.5 text-left font-semibold text-xs uppercase tracking-wide">Paid On</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {schedule.map((inst: any) => {
                      const dueDate = new Date(inst.dueDate);
                      const isOverdue = !inst.paid && dueDate.getTime() < new Date().setHours(0, 0, 0, 0);
                      const isCurrentDue = inst.index === (currentDueInst?.index ?? -1);
                      return (
                        <tr key={inst.id || inst.index} className="hover:bg-muted/40 transition-colors">
                          <td className="px-3 py-2.5 text-muted-foreground font-mono text-xs">{inst.index + 1}</td>
                          <td className="px-3 py-2.5 font-medium">{fmtDate(inst.dueDate)}</td>
                          <td className="px-3 py-2.5 text-right font-medium">Rs. {Number(inst.amount || 0).toLocaleString()}</td>
                          <td className="px-3 py-2.5">
                            {inst.paid ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 size={12} /> Paid
                              </span>
                            ) : isOverdue ? (
                              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">Overdue</span>
                            ) : isCurrentDue ? (
                              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">Current</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-50 text-slate-600 border border-slate-200">Upcoming</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground">
                            {inst.paid ? fmtDate(inst.paidAt) : "—"}
                          </td>
                          {/* Make Payment column - only show on current-due installment */}
                          {isCurrentDue && (
                            <td className="px-3 py-2.5 text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs font-medium text-primary hover:text-emerald-700"
                                onClick={() => setPaymentOpen(true)}
                              >
                                Make Payment
                              </Button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payments History */}
            <div>
              <h4 className="text-sm font-bold text-foreground mb-2 flex items-center gap-1.5">
                <Clock size={15} className="text-muted-foreground" /> Payments History
                {payments.length > 0 && (
                  <span className="text-xs font-medium text-muted-foreground">({payments.length})</span>
                )}
              </h4>
              {payments.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4 rounded-lg bg-muted/40 border border-dashed border-border">
                  No payments recorded yet.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted text-muted-foreground border-b border-border">
                        <th className="px-3 py-2.5 text-left font-semibold text-xs uppercase tracking-wide">Date</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-xs uppercase tracking-wide">Method</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-xs uppercase tracking-wide">Receiving Account</th>
                        <th className="px-3 py-2.5 text-right font-semibold text-xs uppercase tracking-wide">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {payments.map((p: any) => (
                        <tr key={p.id} className="hover:bg-muted/40 transition-colors">
                          <td className="px-3 py-2.5 font-medium">{fmtDate(p.paidAt)}</td>
                          <td className="px-3 py-2.5 capitalize text-muted-foreground">{String(p.method || "—").replace(/_/g, " ")}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{accountNames[p.receivingAccountId] || "N/A"}</td>
                          <td className="px-3 py-2.5 text-right font-bold text-emerald-600">Rs. {Number(p.amount || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          {paymentOpen && (
            <RecordPaymentModal plan={plan} open={paymentOpen} onClose={() => setPaymentOpen(false)} />
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
