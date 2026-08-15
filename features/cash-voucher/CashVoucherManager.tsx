"use client";
import { useState, useEffect, FormEvent, useMemo } from "react";
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp, limit, getDocs, runTransaction } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { SearchSelector } from "@/components/ui/SearchSelector";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Search, Plus, Trash2, Printer, X, CheckCircle2, AlertTriangle, FileText, Calendar, DollarSign, Eye, Edit } from "lucide-react";

interface Voucher {
  id: string;
  voucherNo: number;
  date: string;
  // Cash leg
  cashAccountId: string;
  cashAccountName: string;
  cashType: 'debit' | 'credit';
  cashPreviousBalance: number;
  cashNewBalance: number;
  // Counter leg
  counterAccountId: string;
  counterAccountName: string;
  counterType: 'debit' | 'credit';
  counterPreviousBalance: number;
  counterNewBalance: number;
  // Shared
  description: string;
  amount: number;
  debit: number;
  credit: number;
  // Backward compat (old single-entry vouchers)
  accountId: string;
  accountName: string;
  type: 'debit' | 'credit';
  previousBalance: number;
  newBalance: number;
  createdAt: any;
}

interface Account {
  id: string;
  name: string;
  typeName: string;
  balance: number;
}

export const CashVoucherManager = () => {
  const { user } = useAuth();
  
  // Data State
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [filteredAccounts, setFilteredAccounts] = useState<Account[]>([]);
  
  // UI State
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedPrintVoucher, setSelectedPrintVoucher] = useState<Voucher | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [nextVoucherNo, setNextVoucherNo] = useState<number>(1);

  // Form State
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    cashAccountId: "",
    counterAccountId: "",
    description: "",
    debit: "",
    credit: "",
    planId: "",
    installmentIdx: ""
  });

  // Grouped date and Edit state
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedEditVoucher, setSelectedEditVoucher] = useState<Voucher | null>(null);
  const [editMessage, setEditMessage] = useState("");
  const [editFormData, setEditFormData] = useState({
    date: "",
    cashAccountId: "",
    counterAccountId: "",
    description: "",
    debit: "",
    credit: ""
  });

  // Fetch Vouchers & Accounts
  useEffect(() => {
    const qVouchers = query(collection(db, "vouchers"), orderBy("voucherNo", "desc"));
    const unsubVouchers = onSnapshot(qVouchers, (snapshot) => {
      setVouchers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Voucher)));
    });

    const qAccounts = query(collection(db, "accounts"), orderBy("name"));
    const unsubAccounts = onSnapshot(qAccounts, (snapshot) => {
      const allAccounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
      setAccounts(allAccounts);
      
      // Filter only "cash" type accounts (whose type name or account name contains 'cash')
      const cashAccounts = allAccounts.filter(acc => 
        acc.typeName.toLowerCase().includes("cash") || 
        acc.name.toLowerCase().includes("cash")
      );
      setFilteredAccounts(cashAccounts);
    });

    return () => {
      unsubVouchers();
      unsubAccounts();
    };
  }, []);

  // Prefill from URL parameters
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const prefillAmount = searchParams.get("amount");
    const prefillDesc = searchParams.get("desc");
    const prefillCounter = searchParams.get("counterId");
    const planId = searchParams.get("planId");
    const installmentIdx = searchParams.get("installmentIdx");

    if (prefillAmount || prefillDesc) {
      setFormData(prev => ({
        ...prev,
        debit: prefillAmount || "",
        description: prefillDesc || "",
        counterAccountId: prefillCounter || "",
        planId: planId || "",
        installmentIdx: installmentIdx || ""
      }));
      setIsCreateOpen(true);
    }
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      // Press 'n' or 'N' to open Create Voucher modal
      if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        if (!isCreateOpen) setIsCreateOpen(true);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCreateOpen]);

  // Fetch Next Voucher Number when dialog opens
  useEffect(() => {
    if (isCreateOpen) {
      const fetchNextVoucherNo = async () => {
        try {
          const q = query(collection(db, "vouchers"), orderBy("voucherNo", "desc"), limit(1));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const lastVoucher = snap.docs[0].data();
            if (lastVoucher.voucherNo && typeof lastVoucher.voucherNo === 'number') {
              setNextVoucherNo(lastVoucher.voucherNo + 1);
              return;
            }
          }
          setNextVoucherNo(1);
        } catch (e) {
          console.error("Error fetching last voucher number:", e);
        }
      };
      fetchNextVoucherNo();
    }
  }, [isCreateOpen]);

  // Auto-select cash account when dialog opens (prefer "Cash in Hand", else first cash account)
  useEffect(() => {
    if (isCreateOpen && filteredAccounts.length > 0) {
      const cashInHand = filteredAccounts.find(a =>
        a.name.toLowerCase().includes('cash in hand')
      ) || filteredAccounts[0];
      setFormData(prev => ({ ...prev, cashAccountId: cashInHand.id }));
    }
  }, [isCreateOpen, filteredAccounts]);

  const handleDebitChange = (val: string) => {
    // Prevent entering negative values
    const cleanVal = val.replace("-", "");
    setFormData(prev => ({
      ...prev,
      debit: cleanVal,
      credit: cleanVal ? "" : prev.credit
    }));
  };

  const handleCreditChange = (val: string) => {
    const cleanVal = val.replace("-", "");
    setFormData(prev => ({
      ...prev,
      credit: cleanVal,
      debit: cleanVal ? "" : prev.debit
    }));
  };

  const cashAccountObj = accounts.find(a => a.id === formData.cashAccountId);
  const counterAccountObj = accounts.find(a => a.id === formData.counterAccountId);
  const cashBalance = cashAccountObj?.balance ?? 0;
  const counterBalance = counterAccountObj?.balance ?? 0;

  const calcCashNewBal = (() => {
    if (formData.debit) return cashBalance + (parseFloat(formData.debit) || 0);
    if (formData.credit) return cashBalance - (parseFloat(formData.credit) || 0);
    return cashBalance;
  })();
  const calcCounterNewBal = (() => {
    if (formData.debit) return counterBalance - (parseFloat(formData.debit) || 0);
    if (formData.credit) return counterBalance + (parseFloat(formData.credit) || 0);
    return counterBalance;
  })();

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      cashAccountId: "",
      counterAccountId: "",
      description: "",
      debit: "",
      credit: "",
      planId: "",
      installmentIdx: ""
    });
    setMessage("");
  };

  const startEditVoucher = (voucher: Voucher) => {
    setSelectedEditVoucher(voucher);
    const cashType = voucher.cashType || voucher.type;
    setEditFormData({
      date: voucher.date,
      cashAccountId: voucher.cashAccountId || voucher.accountId,
      counterAccountId: voucher.counterAccountId || "",
      description: voucher.description,
      debit: cashType === 'debit' ? voucher.amount.toString() : "",
      credit: cashType === 'credit' ? voucher.amount.toString() : ""
    });
    setEditMessage("");
    setIsEditOpen(true);
  };

  const handleEditDebitChange = (val: string) => {
    const cleanVal = val.replace("-", "");
    setEditFormData(prev => ({
      ...prev,
      debit: cleanVal,
      credit: cleanVal ? "" : prev.credit
    }));
  };

  const handleEditCreditChange = (val: string) => {
    const cleanVal = val.replace("-", "");
    setEditFormData(prev => ({
      ...prev,
      credit: cleanVal,
      debit: cleanVal ? "" : prev.debit
    }));
  };

  const editCashAccountObj = accounts.find(a => a.id === editFormData.cashAccountId);
  const editCounterAccountObj = accounts.find(a => a.id === editFormData.counterAccountId);
  const editCashBalance = editCashAccountObj?.balance ?? 0;
  const editCounterBalance = editCounterAccountObj?.balance ?? 0;

  const editCalcCashNewBal = (() => {
    if (!selectedEditVoucher) return editCashBalance;
    let base = editCashBalance;
    const oldCashType = selectedEditVoucher.cashType || selectedEditVoucher.type;
    if (editFormData.cashAccountId === (selectedEditVoucher.cashAccountId || selectedEditVoucher.accountId)) {
      if (oldCashType === 'debit') base -= selectedEditVoucher.amount;
      else base += selectedEditVoucher.amount;
    }
    if (editFormData.debit) return base + (parseFloat(editFormData.debit) || 0);
    if (editFormData.credit) return base - (parseFloat(editFormData.credit) || 0);
    return base;
  })();

  const editCalcCounterNewBal = (() => {
    if (!selectedEditVoucher) return editCounterBalance;
    let base = editCounterBalance;
    const oldCounterType = selectedEditVoucher.counterType;
    if (editFormData.counterAccountId === selectedEditVoucher.counterAccountId && oldCounterType) {
      if (oldCounterType === 'debit') base -= selectedEditVoucher.amount;
      else base += selectedEditVoucher.amount;
    }
    if (editFormData.debit) return base - (parseFloat(editFormData.debit) || 0);
    if (editFormData.credit) return base + (parseFloat(editFormData.credit) || 0);
    return base;
  })();

  const handleUpdateVoucher = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !selectedEditVoucher) return;

    if (!editFormData.cashAccountId) { setEditMessage("Error: Please select a cash account."); return; }
    if (!editFormData.counterAccountId) { setEditMessage("Error: Please select a counter account."); return; }
    if (editFormData.cashAccountId === editFormData.counterAccountId) { setEditMessage("Error: Cash account and counter account cannot be the same."); return; }
    if (!editFormData.debit && !editFormData.credit) { setEditMessage("Error: Please enter either a Debit or Credit amount."); return; }

    const debitAmt = parseFloat(editFormData.debit) || 0;
    const creditAmt = parseFloat(editFormData.credit) || 0;
    if (debitAmt <= 0 && creditAmt <= 0) { setEditMessage("Error: Amount must be greater than zero."); return; }

    setLoading(true);
    setEditMessage("");

    try {
      const newCashType: 'debit' | 'credit' = debitAmt > 0 ? 'debit' : 'credit';
      const newCounterType: 'debit' | 'credit' = debitAmt > 0 ? 'credit' : 'debit';
      const newAmount = debitAmt > 0 ? debitAmt : creditAmt;

      await runTransaction(db, async (transaction) => {
        const voucherRef = doc(db, "vouchers", selectedEditVoucher.id);
        const voucherSnap = await transaction.get(voucherRef);
        if (!voucherSnap.exists()) throw new Error("Voucher does not exist.");

        const oldData = voucherSnap.data() as Voucher;
        const oldCashId = oldData.cashAccountId || oldData.accountId;
        const oldCounterId = oldData.counterAccountId;
        const oldCashType = oldData.cashType || oldData.type;
        const oldCounterType = oldData.counterType;
        const oldAmount = oldData.amount;
        const newCashId = editFormData.cashAccountId;
        const newCounterId = editFormData.counterAccountId;

        const allIds = [...new Set([oldCashId, oldCounterId, newCashId, newCounterId].filter(Boolean) as string[])];
        const allRefs = allIds.map(id => doc(db, "accounts", id));
        const allSnaps = await Promise.all(allRefs.map(r => transaction.get(r)));
        const dataMap: Record<string, any> = {};
        const balMap: Record<string, number> = {};
        allIds.forEach((id, i) => { dataMap[id] = allSnaps[i].data(); balMap[id] = dataMap[id]?.balance || 0; });

        // Revert old legs
        if (oldCashId && oldCashType) { balMap[oldCashId] += oldCashType === 'debit' ? -oldAmount : oldAmount; }
        if (oldCounterId && oldCounterType) { balMap[oldCounterId] += oldCounterType === 'debit' ? -oldAmount : oldAmount; }

        // Apply new legs
        const cashPrev = balMap[newCashId];
        balMap[newCashId] += newCashType === 'debit' ? newAmount : -newAmount;
        const cashNew = balMap[newCashId];
        const counterPrev = balMap[newCounterId];
        balMap[newCounterId] += newCounterType === 'debit' ? newAmount : -newAmount;
        const counterNew = balMap[newCounterId];

        // Write account updates
        allIds.forEach((id, i) => { transaction.update(allRefs[i], { balance: balMap[id], updatedAt: serverTimestamp(), updatedBy: user.uid }); });

        // Update voucher
        transaction.update(voucherRef, {
          date: editFormData.date, description: editFormData.description.trim(),
          amount: newAmount, debit: debitAmt, credit: creditAmt,
          cashAccountId: newCashId, cashAccountName: dataMap[newCashId]?.name || "",
          cashType: newCashType, cashPreviousBalance: cashPrev, cashNewBalance: cashNew,
          counterAccountId: newCounterId, counterAccountName: dataMap[newCounterId]?.name || "",
          counterType: newCounterType, counterPreviousBalance: counterPrev, counterNewBalance: counterNew,
          accountId: newCashId, accountName: dataMap[newCashId]?.name || "",
          type: newCashType, previousBalance: cashPrev, newBalance: cashNew,
          updatedAt: serverTimestamp(), updatedBy: user.uid
        });

        const logRef = doc(collection(db, "logs"));
        transaction.set(logRef, {
          action: `Updated Cash Voucher No: ${oldData.voucherNo}`,
          details: `${newCashType.toUpperCase()} Rs. ${newAmount.toLocaleString()} — ${dataMap[newCashId]?.name} ↔ ${dataMap[newCounterId]?.name}`,
          performedBy: user.uid, timestamp: serverTimestamp(), type: "ACCOUNTING_ACTION"
        });
      });

      setIsEditOpen(false);
      setSelectedEditVoucher(null);
      alert(`Voucher No. ${selectedEditVoucher.voucherNo} updated successfully.`);
    } catch (error: any) {
      console.error("Transaction failed:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVoucher = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.cashAccountId) { setMessage("Error: Please select a cash account."); return; }
    if (!formData.counterAccountId) { setMessage("Error: Please select a counter account."); return; }
    if (formData.cashAccountId === formData.counterAccountId) { setMessage("Error: Cash and counter accounts cannot be the same."); return; }
    if (!formData.debit && !formData.credit) { setMessage("Error: Please enter either a Debit or Credit amount."); return; }

    const debitAmt = parseFloat(formData.debit) || 0;
    const creditAmt = parseFloat(formData.credit) || 0;
    if (debitAmt <= 0 && creditAmt <= 0) { setMessage("Error: Amount must be greater than zero."); return; }

    setLoading(true);
    setMessage("");

    try {
      const cashType: 'debit' | 'credit' = debitAmt > 0 ? 'debit' : 'credit';
      const counterType: 'debit' | 'credit' = debitAmt > 0 ? 'credit' : 'debit';
      const amount = debitAmt > 0 ? debitAmt : creditAmt;

      await runTransaction(db, async (transaction) => {
        const cashRef = doc(db, "accounts", formData.cashAccountId);
        const counterRef = doc(db, "accounts", formData.counterAccountId);
        
        let planSnap: any = null;
        let planRef: any = null;
        if (formData.planId && formData.installmentIdx !== "") {
          planRef = doc(db, "installmentPlans", formData.planId);
          planSnap = await transaction.get(planRef);
        }

        const cashSnap = await transaction.get(cashRef);
        const counterSnap = await transaction.get(counterRef);

        if (!cashSnap.exists()) throw new Error("Cash account does not exist.");
        if (!counterSnap.exists()) throw new Error("Counter account does not exist.");

        const cashPrevBal = cashSnap.data().balance || 0;
        const counterPrevBal = counterSnap.data().balance || 0;
        const cashNewBal = cashType === 'debit' ? cashPrevBal + amount : cashPrevBal - amount;
        const counterNewBal = counterType === 'debit' ? counterPrevBal + amount : counterPrevBal - amount;

        const voucherRef = doc(collection(db, "vouchers"));
        transaction.set(voucherRef, {
          voucherNo: nextVoucherNo,
          date: formData.date,
          description: formData.description.trim(),
          amount, debit: debitAmt, credit: creditAmt,
          cashAccountId: formData.cashAccountId, cashAccountName: cashSnap.data().name,
          cashType, cashPreviousBalance: cashPrevBal, cashNewBalance: cashNewBal,
          counterAccountId: formData.counterAccountId, counterAccountName: counterSnap.data().name,
          counterType, counterPreviousBalance: counterPrevBal, counterNewBalance: counterNewBal,
          // Backward compat
          accountId: formData.cashAccountId, accountName: cashSnap.data().name,
          type: cashType, previousBalance: cashPrevBal, newBalance: cashNewBal,
          createdBy: user.uid, createdAt: serverTimestamp()
        });

        transaction.update(cashRef, { balance: cashNewBal, updatedAt: serverTimestamp(), updatedBy: user.uid });
        transaction.update(counterRef, { balance: counterNewBal, updatedAt: serverTimestamp(), updatedBy: user.uid });

        // If this voucher was generated from an installment plan, mark it as paid
        if (planSnap && planSnap.exists() && planRef) {
          const planData = planSnap.data();
          const idx = parseInt(formData.installmentIdx);
          const schedule = [...(planData.installmentSchedule || [])];
            
            if (schedule[idx] && !schedule[idx].paid) {
              schedule[idx].paid = true;
              schedule[idx].paidAt = formData.date;
              
              const newOutstandingBalance = Math.max(0, (planData.outstandingBalance || 0) - amount);
              const isSettled = newOutstandingBalance === 0;
              
              transaction.update(planRef, {
                installmentSchedule: schedule,
                outstandingBalance: newOutstandingBalance,
                status: isSettled ? "settled" : planData.status,
                updatedAt: serverTimestamp()
              });
              
              // Add to subcollection payments
              const paymentRef = doc(collection(db, "installmentPlans", formData.planId, "payments"));
              transaction.set(paymentRef, {
                amount: amount,
                paidAt: formData.date,
                method: "cash",
                receivingAccountId: formData.cashAccountId,
                recordedBy: user.uid,
                createdAt: serverTimestamp(),
                voucherNo: nextVoucherNo
              });
            }
        }

        const logRef = doc(collection(db, "logs"));
        transaction.set(logRef, {
          action: `Generated Cash Voucher No: ${nextVoucherNo}`,
          details: `${cashType.toUpperCase()} Rs. ${amount.toLocaleString()} — ${cashSnap.data().name} ↔ ${counterSnap.data().name}`,
          performedBy: user.uid, timestamp: serverTimestamp(), type: "ACCOUNTING_ACTION"
        });
      });

      setIsCreateOpen(false);
      resetForm();
      alert(`Voucher No. ${nextVoucherNo} generated successfully.`);
    } catch (error: any) {
      console.error("Transaction failed:", error);
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVoucher = async (voucher: Voucher) => {
    if (!confirm(`Are you sure you want to delete Voucher No: ${voucher.voucherNo}? This will revert BOTH account balances.`)) return;

    try {
      await runTransaction(db, async (transaction) => {
        const voucherRef = doc(db, "vouchers", voucher.id);
        const voucherSnap = await transaction.get(voucherRef);
        if (!voucherSnap.exists()) return;

        const cashId = voucher.cashAccountId || voucher.accountId;
        const cashType = voucher.cashType || voucher.type;
        const cashRef = doc(db, "accounts", cashId);
        const cashSnap = await transaction.get(cashRef);
        if (cashSnap.exists()) {
          const rev = cashType === 'debit' ? (cashSnap.data().balance || 0) - voucher.amount : (cashSnap.data().balance || 0) + voucher.amount;
          transaction.update(cashRef, { balance: rev, updatedAt: serverTimestamp() });
        }

        if (voucher.counterAccountId && voucher.counterType) {
          const counterRef = doc(db, "accounts", voucher.counterAccountId);
          const counterSnap = await transaction.get(counterRef);
          if (counterSnap.exists()) {
            const rev = voucher.counterType === 'debit' ? (counterSnap.data().balance || 0) - voucher.amount : (counterSnap.data().balance || 0) + voucher.amount;
            transaction.update(counterRef, { balance: rev, updatedAt: serverTimestamp() });
          }
        }

        transaction.delete(voucherRef);

        if (user) {
          const logRef = doc(collection(db, "logs"));
          transaction.set(logRef, {
            action: `Deleted Cash Voucher No: ${voucher.voucherNo}`,
            details: `Reverted ${cashType.toUpperCase()} Rs. ${voucher.amount.toLocaleString()} — ${voucher.cashAccountName || voucher.accountName}`,
            performedBy: user.uid, timestamp: serverTimestamp(), type: "ACCOUNTING_ACTION"
          });
        }
      });

      alert(`Voucher No. ${voucher.voucherNo} deleted and both balances reverted.`);
    } catch (error: any) {
      console.error("Reversion failed:", error);
      alert(`Reversion failed: ${error.message}`);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredVouchers = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return vouchers.filter(v => {
      const cashName = (v.cashAccountName || v.accountName || "").toLowerCase();
      const counterName = (v.counterAccountName || "").toLowerCase();
      const matchesSearch = cashName.includes(term) || counterName.includes(term) ||
        v.description.toLowerCase().includes(term) ||
        v.voucherNo.toString().includes(searchTerm);
      const cashType = v.cashType || v.type;
      const matchesType = typeFilter === "ALL" || cashType === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [vouchers, searchTerm, typeFilter]);

  // Group filtered vouchers by date
  const groupedDatesList = useMemo(() => {
    const groupedByDate = filteredVouchers.reduce((acc, voucher) => {
      const date = voucher.date;
      if (!acc[date]) {
        acc[date] = {
          date,
          vouchersCount: 0,
          accounts: new Set<string>(),
          totalDebit: 0,
          totalCredit: 0
        };
      }
      acc[date].vouchersCount += 1;
      const displayName = voucher.cashAccountName
        ? `${voucher.cashAccountName} ↔ ${voucher.counterAccountName || ""}`
        : voucher.accountName;
      acc[date].accounts.add(displayName);
      const cashType = voucher.cashType || voucher.type;
      if (cashType === "debit") {
        acc[date].totalDebit += voucher.amount;
      } else if (cashType === "credit") {
        acc[date].totalCredit += voucher.amount;
      }
      return acc;
    }, {} as Record<string, { date: string; vouchersCount: number; accounts: Set<string>; totalDebit: number; totalCredit: number }>);
    
    return Object.values(groupedByDate).sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredVouchers]);

  const dateVouchers = useMemo(() => {
    return filteredVouchers.filter(v => v.date === selectedDate);
  }, [filteredVouchers, selectedDate]);

  const PrintableVoucherDoc = ({ voucher }: { voucher: Voucher }) => {
    const cashType = voucher.cashType || voucher.type;
    const cashName = voucher.cashAccountName || voucher.accountName;
    const counterName = voucher.counterAccountName || "—";
    const cashPrev = voucher.cashPreviousBalance ?? voucher.previousBalance;
    const cashNew = voucher.cashNewBalance ?? voucher.newBalance;
    const counterPrev = voucher.counterPreviousBalance;
    const counterNew = voucher.counterNewBalance;
    return (
    <div id="print-content" className="bg-card p-8 md:p-12 max-w-4xl mx-auto text-foreground font-sans relative border border-slate-300 rounded-lg">
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-8">
        <div className="flex flex-col">
          <div className="mb-3 -ml-1"><h2 className="text-3xl font-black tracking-tighter bg-gradient-to-r from-[#E5484D] to-[#8a1c20] bg-clip-text text-transparent uppercase drop-shadow-sm leading-none">ZOHAIB MOTORS</h2><div className="h-1 w-12 bg-[#1C1F26] mt-1 rounded-full opacity-80"></div></div>
          <h1 className="text-2xl font-bold uppercase tracking-tight text-foreground">Cash Transaction Voucher</h1>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">Official Accounts Copy</p>
        </div>
        <div className="text-right space-y-1">
          <div className="bg-slate-900 text-white px-3 py-1 text-xs font-bold tracking-widest inline-block mb-1.5 uppercase">
            {cashType} Voucher
          </div>
          <p className="text-[10px] text-muted-foreground uppercase font-bold">Voucher No.</p>
          <p className="text-sm font-bold font-mono">CV-{voucher.voucherNo.toString().padStart(4, '0')}</p>
          <p className="text-[10px] text-muted-foreground uppercase font-bold mt-1">Transaction Date</p>
          <p className="text-xs font-mono">{voucher.date}</p>
        </div>
      </div>

      {/* Description */}
      <div className="mb-6">
        <span className="text-[10px] text-muted-foreground uppercase font-bold block">Description / Particulars</span>
        <span className="text-sm text-foreground whitespace-pre-wrap">{voucher.description}</span>
      </div>

      {/* Double-Entry Ledger Table */}
      <table className="w-full text-xs border-collapse mb-8">
        <thead>
          <tr className="border-b-2 border-slate-800">
            <th className="py-2 text-left font-bold uppercase text-muted-foreground">Account</th>
            <th className="py-2 text-right font-bold uppercase text-muted-foreground">Debit (+)</th>
            <th className="py-2 text-right font-bold uppercase text-muted-foreground">Credit (-)</th>
            <th className="py-2 text-right font-bold uppercase text-muted-foreground">Prev. Balance</th>
            <th className="py-2 text-right font-bold uppercase text-muted-foreground">New Balance</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          <tr>
            <td className="py-2.5 font-bold text-foreground">{cashName}</td>
            <td className="py-2.5 text-right font-semibold text-green-600">
              {cashType === 'debit' ? `Rs. ${voucher.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
            </td>
            <td className="py-2.5 text-right font-semibold text-red-600">
              {cashType === 'credit' ? `Rs. ${voucher.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
            </td>
            <td className="py-2.5 text-right text-muted-foreground">
              {cashPrev != null ? `Rs. ${cashPrev.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
            </td>
            <td className="py-2.5 text-right font-bold text-foreground">
              {cashNew != null ? `Rs. ${cashNew.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
            </td>
          </tr>
          {voucher.counterAccountId && (
            <tr>
              <td className="py-2.5 font-bold text-foreground">{counterName}</td>
              <td className="py-2.5 text-right font-semibold text-green-600">
                {voucher.counterType === 'debit' ? `Rs. ${voucher.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
              </td>
              <td className="py-2.5 text-right font-semibold text-red-600">
                {voucher.counterType === 'credit' ? `Rs. ${voucher.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
              </td>
              <td className="py-2.5 text-right text-muted-foreground">
                {counterPrev != null ? `Rs. ${counterPrev.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
              </td>
              <td className="py-2.5 text-right font-bold text-foreground">
                {counterNew != null ? `Rs. ${counterNew.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Signature Lines */}
      <div className="grid grid-cols-3 gap-8 mt-16 pt-8 border-t border-border text-center">
        <div>
          <div className="h-12 border-b border-dashed border-slate-300"></div>
          <span className="text-[10px] uppercase font-bold text-muted-foreground mt-2 block">Prepared By</span>
        </div>
        <div>
          <div className="h-12 border-b border-dashed border-slate-300"></div>
          <span className="text-[10px] uppercase font-bold text-muted-foreground mt-2 block">Verified By</span>
        </div>
        <div>
          <div className="h-12 border-b border-dashed border-slate-300"></div>
          <span className="text-[10px] uppercase font-bold text-muted-foreground mt-2 block">Receiver's Signature</span>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-12 text-[10px] text-muted-foreground flex justify-between border-t border-border pt-4 uppercase">
        <span>Zohaib Motors accounts System</span>
        <span>Generated on {new Date().toLocaleDateString()}</span>
      </div>
    </div>
  );
  };

  return (
    <>
      {/* Dynamic Printing Style Layer */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-content, #print-content * {
            visibility: visible;
          }
          #print-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .print-hide {
            display: none !important;
          }
        }
      `}</style>

      <div className="space-y-6">
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-muted p-4 border rounded-xl">
          <div className="flex flex-col md:flex-row gap-3 flex-1 w-full">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 text-muted-foreground" size={16} />
              <Input
                className="pl-9 bg-card"
                placeholder="Search by Voucher No, Account, Description..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full md:w-[150px] bg-card">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Vouchers</SelectItem>
                <SelectItem value="debit">Debit (+)</SelectItem>
                <SelectItem value="credit">Credit (-)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={() => setIsCreateOpen(true)} className="bg-secondary hover:bg-secondary/90 text-white text-white shrink-0 gap-1.5 h-10 w-full sm:w-auto">
            <Plus size={18} /> Create Voucher
          </Button>
        </div>

        {/* List of Vouchers Grouped by Date */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-muted-foreground font-medium border-b">
                <tr>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Vouchers Count</th>
                  <th className="px-6 py-4">Accounts Involved</th>
                  <th className="px-6 py-4 text-right">Total Debit (+)</th>
                  <th className="px-6 py-4 text-right">Total Credit (-)</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {groupedDatesList.map(group => (
                  <tr key={group.date} className="hover:bg-muted transition-colors group">
                    <td className="px-6 py-4 font-mono font-bold text-foreground flex items-center gap-2">
                      <Calendar size={16} className="text-muted-foreground" />
                      {group.date}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-foreground">
                        {group.vouchersCount} {group.vouchersCount === 1 ? 'Voucher' : 'Vouchers'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-foreground max-w-[250px] truncate" title={Array.from(group.accounts).join(", ")}>
                      {Array.from(group.accounts).join(", ")}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-green-600">
                      {group.totalDebit > 0 ? `Rs. ${group.totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "-"}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-red-600">
                      {group.totalCredit > 0 ? `Rs. ${group.totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "-"}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 bg-card text-foreground border-border hover:bg-muted hover:text-foreground"
                        onClick={() => setSelectedDate(group.date)}
                      >
                        <Eye size={14} /> View
                      </Button>
                    </td>
                  </tr>
                ))}

                {groupedDatesList.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No cash vouchers found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Modal: Create Voucher */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if(!open) resetForm(); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] p-0 flex flex-col">
          <DialogHeader className="p-6 pb-2 shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="text-foreground" size={20} />
              Generate Cash Voucher
            </DialogTitle>
            <DialogDescription>
              Create a debit (cash in) or credit (cash out) transaction on your cash-type accounts.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 shrink-0">
            {message && (
              <div className={`p-3 rounded text-xs font-medium flex items-center gap-2 mb-2 ${message.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {!message.includes('Error') && <CheckCircle2 size={14} />}
                {message}
              </div>
            )}
          </div>

          {filteredAccounts.length === 0 ? (
            <div className="p-6 pt-0 flex-1 overflow-y-auto">
              <div className="p-4 bg-muted rounded-lg text-amber-800 text-xs flex flex-col gap-2">
                <div className="flex items-center gap-1.5 font-semibold">
                  <AlertTriangle size={16} /> No Cash Accounts Configured
                </div>
                <p>You must create an account associated with a "Cash" type (e.g. Cash in Hand) in the Accounts Manager before creating vouchers.</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreateVoucher} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 pt-0 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground block">Voucher No (Auto)</label>
                  <Input value={`CV-${nextVoucherNo.toString().padStart(4, '0')}`} disabled className="bg-muted font-mono font-bold cursor-not-allowed" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><Calendar size={12} /> Date *</label>
                  <Input type="date" required value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground block flex items-center gap-1">
                  Cash Account * <span className="text-muted-foreground font-normal">(e.g. Cash in Hand)</span>
                </label>
                <SearchSelector
                  items={filteredAccounts}
                  value={formData.cashAccountId}
                  onChange={(val) => setFormData(prev => ({ ...prev, cashAccountId: val }))}
                  placeholder="Choose cash account"
                  searchPlaceholder="Search cash account..."
                  getSearchFields={(acc) => [acc.name, acc.typeName]}
                  itemKey={(acc) => acc.id}
                  renderTrigger={(selected) =>
                    selected ? (
                      <span>{selected.name} <span className="text-muted-foreground text-xs ml-1">({selected.typeName})</span></span>
                    ) : (
                      <span className="text-muted-foreground">Choose cash account</span>
                    )
                  }
                  renderItem={(acc) => (
                    <div className="flex justify-between items-center w-full text-left">
                      <span className="font-medium text-foreground">{acc.name}</span>
                      <span className="text-xs text-muted-foreground font-mono">({acc.typeName})</span>
                    </div>
                  )}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground block">Counter Account * <span className="text-muted-foreground font-normal">(source / destination)</span></label>
                <SearchSelector
                  items={accounts.filter(a => a.id !== formData.cashAccountId)}
                  value={formData.counterAccountId}
                  onChange={(val) => setFormData(prev => ({ ...prev, counterAccountId: val }))}
                  placeholder="Choose counter account"
                  searchPlaceholder="Search account..."
                  getSearchFields={(acc) => [acc.name, acc.typeName]}
                  itemKey={(acc) => acc.id}
                  renderTrigger={(selected) =>
                    selected ? (
                      <span>{selected.name} <span className="text-muted-foreground text-xs ml-1">({selected.typeName})</span></span>
                    ) : (
                      <span className="text-muted-foreground">Choose counter account</span>
                    )
                  }
                  renderItem={(acc) => (
                    <div className="flex justify-between items-center w-full text-left">
                      <span className="font-medium text-foreground">{acc.name}</span>
                      <span className="text-xs text-muted-foreground font-mono">({acc.typeName})</span>
                    </div>
                  )}
                />
              </div>

              {(formData.cashAccountId || formData.counterAccountId) && (
                <div className="bg-muted p-3 rounded-lg border space-y-2">
                  {formData.cashAccountId && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[10px] text-muted-foreground font-bold uppercase block">Cash Acct — Previous</span>
                        <span className="text-xs font-semibold text-foreground">Rs. {cashBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground font-bold uppercase block">Cash Acct — After</span>
                        <span className={`text-xs font-bold ${calcCashNewBal >= cashBalance ? 'text-green-600' : 'text-red-600'}`}>
                          Rs. {calcCashNewBal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  )}
                  {formData.counterAccountId && (
                    <div className="grid grid-cols-2 gap-4 border-t pt-2">
                      <div>
                        <span className="text-[10px] text-muted-foreground font-bold uppercase block">Counter Acct — Previous</span>
                        <span className="text-xs font-semibold text-foreground">Rs. {counterBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground font-bold uppercase block">Counter Acct — After</span>
                        <span className={`text-xs font-bold ${calcCounterNewBal >= counterBalance ? 'text-green-600' : 'text-red-600'}`}>
                          Rs. {calcCounterNewBal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><DollarSign size={12} /> Credit Amount (-)</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Cash Outflow"
                    value={formData.credit}
                    onChange={e => handleCreditChange(e.target.value)}
                    disabled={!!formData.debit}
                    className={formData.debit ? "bg-muted cursor-not-allowed opacity-50" : ""}
                  />
                  <p className="text-[9px] text-muted-foreground">Subtracts money from account</p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><DollarSign size={12} /> Debit Amount (+)</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Cash Inflow"
                    value={formData.debit}
                    onChange={e => handleDebitChange(e.target.value)}
                    disabled={!!formData.credit}
                    className={formData.credit ? "bg-muted cursor-not-allowed opacity-50" : ""}
                  />
                  <p className="text-[9px] text-muted-foreground">Adds money to account</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground block">Description / Notes *</label>
                <Input required value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="e.g. Paid office utility bills, received from investor" />
              </div>

              </div>

              <DialogFooter className="p-6 pt-4 border-t shrink-0 bg-background">
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} disabled={loading}>Cancel</Button>
                <Button type="submit" disabled={loading} className="bg-secondary hover:bg-secondary/90 text-white">
                  {loading ? "Saving Voucher..." : "Generate Voucher"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: View Vouchers for Date */}
      <Dialog open={!!selectedDate} onOpenChange={(open) => { if(!open) setSelectedDate(null); }}>
        <DialogContent className="print-hide w-screen max-w-none sm:max-w-none h-screen max-h-none top-0 left-0 translate-x-0 translate-y-0 rounded-none m-0 p-6 flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="text-foreground" size={20} />
              Vouchers for {selectedDate}
            </DialogTitle>
            <DialogDescription>
              Detailed view of all cash vouchers generated on this date.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto my-4 border rounded-lg">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-muted text-muted-foreground font-medium border-b sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3">Voucher No</th>
                  <th className="px-4 py-3">Account Affected</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3 text-right">Debit (+)</th>
                  <th className="px-4 py-3 text-right">Credit (-)</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y bg-card">
                {dateVouchers.map(voucher => (
                  <tr key={voucher.id} className="hover:bg-muted transition-colors group">
                    <td className="px-4 py-3 font-mono font-bold text-foreground">
                      CV-{voucher.voucherNo.toString().padStart(4, '0')}
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground text-xs">
                      <span className="block">{voucher.cashAccountName || voucher.accountName}</span>
                      {voucher.counterAccountName && <span className="text-muted-foreground">↔ {voucher.counterAccountName}</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[180px] truncate" title={voucher.description}>
                      {voucher.description}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-green-600">
                      {((voucher.debit > 0) || (voucher.type === 'debit' && voucher.amount > 0))
                        ? `Rs. ${(voucher.debit || voucher.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                        : "-"
                      }
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-red-600">
                      {((voucher.credit > 0) || (voucher.type === 'credit' && voucher.amount > 0))
                        ? `Rs. ${(voucher.credit || voucher.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                        : "-"
                      }
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground font-medium">
                      {voucher.newBalance !== undefined && voucher.newBalance !== null
                        ? `Rs. ${voucher.newBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                        : "-"
                      }
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8 p-0 text-primary" onClick={() => setSelectedPrintVoucher(voucher)} title="Print Preview">
                          <Printer size={16} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 p-0 text-foreground" onClick={() => startEditVoucher(voucher)} title="Edit Voucher">
                          <Edit size={16} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 p-0 text-red-500" onClick={() => handleDeleteVoucher(voucher)} title="Delete Voucher">
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}

                {dateVouchers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      No cash vouchers found for this date.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <DialogFooter className="pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => setSelectedDate(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Edit Voucher */}
      <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if(!open) { setSelectedEditVoucher(null); setEditMessage(""); } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] p-0 flex flex-col">
          <DialogHeader className="p-6 pb-2 shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Edit className="text-foreground" size={20} />
              Edit Cash Voucher
            </DialogTitle>
            <DialogDescription>
              Modify the details of Voucher No. {selectedEditVoucher && `CV-${selectedEditVoucher.voucherNo.toString().padStart(4, '0')}`}.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 shrink-0">
            {editMessage && (
              <div className={`p-3 rounded text-xs font-medium flex items-center gap-2 mb-2 ${editMessage.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {!editMessage.includes('Error') && <CheckCircle2 size={14} />}
                {editMessage}
              </div>
            )}
          </div>

          {selectedEditVoucher && (
            <form onSubmit={handleUpdateVoucher} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 pt-0 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground block">Voucher No</label>
                  <Input value={`CV-${selectedEditVoucher.voucherNo.toString().padStart(4, '0')}`} disabled className="bg-muted font-mono font-bold cursor-not-allowed" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><Calendar size={12} /> Date *</label>
                  <Input type="date" required value={editFormData.date} onChange={e => setEditFormData({ ...editFormData, date: e.target.value })} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground block">Cash Account * <span className="text-muted-foreground font-normal">(e.g. Cash in Hand)</span></label>
                <SearchSelector
                  items={filteredAccounts}
                  value={editFormData.cashAccountId}
                  onChange={(val) => setEditFormData(prev => ({ ...prev, cashAccountId: val }))}
                  placeholder="Choose cash account"
                  searchPlaceholder="Search account..."
                  getSearchFields={(acc) => [acc.name, acc.typeName]}
                  itemKey={(acc) => acc.id}
                  renderTrigger={(selected) =>
                    selected ? (
                      <span>{selected.name} <span className="text-muted-foreground text-xs ml-1">({selected.typeName})</span></span>
                    ) : (
                      <span className="text-muted-foreground">Choose cash account</span>
                    )
                  }
                  renderItem={(acc) => (
                    <div className="flex justify-between items-center w-full text-left">
                      <span className="font-medium text-foreground">{acc.name}</span>
                      <span className="text-xs text-muted-foreground font-mono">({acc.typeName})</span>
                    </div>
                  )}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground block">Counter Account * <span className="text-muted-foreground font-normal">(source / destination)</span></label>
                <SearchSelector
                  items={accounts.filter(a => a.id !== editFormData.cashAccountId)}
                  value={editFormData.counterAccountId}
                  onChange={(val) => setEditFormData(prev => ({ ...prev, counterAccountId: val }))}
                  placeholder="Choose counter account"
                  searchPlaceholder="Search account..."
                  getSearchFields={(acc) => [acc.name, acc.typeName]}
                  itemKey={(acc) => acc.id}
                  renderTrigger={(selected) =>
                    selected ? (
                      <span>{selected.name} <span className="text-muted-foreground text-xs ml-1">({selected.typeName})</span></span>
                    ) : (
                      <span className="text-muted-foreground">Choose counter account</span>
                    )
                  }
                  renderItem={(acc) => (
                    <div className="flex justify-between items-center w-full text-left">
                      <span className="font-medium text-foreground">{acc.name}</span>
                      <span className="text-xs text-muted-foreground font-mono">({acc.typeName})</span>
                    </div>
                  )}
                />
              </div>

              {(editFormData.cashAccountId || editFormData.counterAccountId) && (
                <div className="bg-muted p-3 rounded-lg border space-y-2">
                  {editFormData.cashAccountId && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[10px] text-muted-foreground font-bold uppercase block">Cash Acct — Previous</span>
                        <span className="text-xs font-semibold text-foreground">Rs. {editCashBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground font-bold uppercase block">Cash Acct — After Edit</span>
                        <span className={`text-xs font-bold ${editCalcCashNewBal >= editCashBalance ? 'text-green-600' : 'text-red-600'}`}>
                          Rs. {editCalcCashNewBal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  )}
                  {editFormData.counterAccountId && (
                    <div className="grid grid-cols-2 gap-4 border-t pt-2">
                      <div>
                        <span className="text-[10px] text-muted-foreground font-bold uppercase block">Counter Acct — Previous</span>
                        <span className="text-xs font-semibold text-foreground">Rs. {editCounterBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground font-bold uppercase block">Counter Acct — After Edit</span>
                        <span className={`text-xs font-bold ${editCalcCounterNewBal >= editCounterBalance ? 'text-green-600' : 'text-red-600'}`}>
                          Rs. {editCalcCounterNewBal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><DollarSign size={12} /> Credit Amount (-)</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Cash Outflow"
                    value={editFormData.credit}
                    onChange={e => handleEditCreditChange(e.target.value)}
                    disabled={!!editFormData.debit}
                    className={editFormData.debit ? "bg-muted cursor-not-allowed opacity-50" : ""}
                  />
                  <p className="text-[9px] text-muted-foreground">Subtracts money from account</p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><DollarSign size={12} /> Debit Amount (+)</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Cash Inflow"
                    value={editFormData.debit}
                    onChange={e => handleEditDebitChange(e.target.value)}
                    disabled={!!editFormData.credit}
                    className={editFormData.credit ? "bg-muted cursor-not-allowed opacity-50" : ""}
                  />
                  <p className="text-[9px] text-muted-foreground">Adds money to account</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground block">Description / Notes *</label>
                <Input required value={editFormData.description} onChange={e => setEditFormData({ ...editFormData, description: e.target.value })} placeholder="e.g. Paid office utility bills" />
              </div>

              </div>

              <DialogFooter className="p-6 pt-4 border-t shrink-0 bg-background">
                <Button type="button" variant="outline" onClick={() => { setIsEditOpen(false); setSelectedEditVoucher(null); setEditMessage(""); }} disabled={loading}>Cancel</Button>
                <Button type="submit" disabled={loading} className="bg-secondary hover:bg-secondary/90 text-white">
                  {loading ? "Updating Voucher..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Print Preview */}
      <Dialog open={!!selectedPrintVoucher} onOpenChange={(open) => { if(!open) setSelectedPrintVoucher(null); }}>
        <DialogContent className="print-hide max-w-4xl sm:max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden" showCloseButton={false}>
          <div className="flex items-center justify-between p-4 border-b border-border bg-muted">
            <div className="flex items-center gap-2">
              <Printer className="text-muted-foreground" size={20} />
              <h3 className="font-semibold text-foreground">Voucher Print Preview</h3>
            </div>
            <div className="flex gap-2">
              <Button onClick={handlePrint} className="gap-2 bg-secondary hover:bg-secondary/90 text-white text-white">
                <Printer size={16} /> Print Voucher
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setSelectedPrintVoucher(null)}>
                <X size={18} />
              </Button>
            </div>
          </div>
          
          <div className="flex-1 overflow-hidden bg-muted p-4 md:p-8">
            <div className="h-full overflow-y-auto">
              <div className="shadow-2xl shadow-slate-200 rounded-xl overflow-hidden ring-1 ring-slate-200 bg-card">
                {selectedPrintVoucher && <PrintableVoucherDoc voucher={selectedPrintVoucher} />}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden print-only layer rendered when printing */}
      {selectedPrintVoucher && (
        <div className="hidden print:block">
          <PrintableVoucherDoc voucher={selectedPrintVoucher} />
        </div>
      )}
    </>
  );
};
