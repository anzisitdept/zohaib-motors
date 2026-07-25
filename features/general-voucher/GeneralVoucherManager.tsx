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
import { Search, Plus, Trash2, Printer, X, CheckCircle2, AlertTriangle, FileText, Calendar, ArrowRightLeft } from "lucide-react";

interface GeneralVoucher {
  id: string;
  voucherNo: number;
  date: string;
  fromAccountId: string;
  fromAccountName: string;
  toAccountId: string;
  toAccountName: string;
  description: string;
  amount: number;
  fromPrevBalance: number;
  fromNewBalance: number;
  toPrevBalance: number;
  toNewBalance: number;
  createdAt: any;
}

interface Account {
  id: string;
  name: string;
  typeName: string;
  balance: number;
}

export const GeneralVoucherManager = () => {
  const { user } = useAuth();
  
  // Data State
  const [vouchers, setVouchers] = useState<GeneralVoucher[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  
  // UI State
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedPrintVoucher, setSelectedPrintVoucher] = useState<GeneralVoucher | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [nextVoucherNo, setNextVoucherNo] = useState<number>(1);

  // Form State
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    fromAccountId: "",
    toAccountId: "",
    description: "",
    amount: ""
  });

  // Fetch Vouchers & Accounts
  useEffect(() => {
    const qVouchers = query(collection(db, "general-vouchers"), orderBy("voucherNo", "desc"));
    const unsubVouchers = onSnapshot(qVouchers, (snapshot) => {
      setVouchers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GeneralVoucher)));
    });

    const qAccounts = query(collection(db, "accounts"), orderBy("name"));
    const unsubAccounts = onSnapshot(qAccounts, (snapshot) => {
      setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)));
    });

    return () => {
      unsubVouchers();
      unsubAccounts();
    };
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
          const q = query(collection(db, "general-vouchers"), orderBy("voucherNo", "desc"), limit(1));
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
          console.error("Error fetching last general voucher number:", e);
        }
      };
      fetchNextVoucherNo();
    }
  }, [isCreateOpen]);

  const fromAccountObj = accounts.find(a => a.id === formData.fromAccountId);
  const toAccountObj = accounts.find(a => a.id === formData.toAccountId);

  const fromPrevBal = fromAccountObj ? fromAccountObj.balance : 0;
  const toPrevBal = toAccountObj ? toAccountObj.balance : 0;

  const enteredAmount = parseFloat(formData.amount) || 0;
  const fromNewBal = fromPrevBal - enteredAmount;
  const toNewBal = toPrevBal + enteredAmount;

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      fromAccountId: "",
      toAccountId: "",
      description: "",
      amount: ""
    });
    setMessage("");
  };

  const handleCreateVoucher = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.fromAccountId || !formData.toAccountId) {
      setMessage("Error: Please select both From and To accounts.");
      return;
    }

    if (formData.fromAccountId === formData.toAccountId) {
      setMessage("Error: From Account and To Account cannot be the same.");
      return;
    }

    if (enteredAmount <= 0) {
      setMessage("Error: Amount must be greater than zero.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      await runTransaction(db, async (transaction) => {
        const fromRef = doc(db, "accounts", formData.fromAccountId);
        const toRef = doc(db, "accounts", formData.toAccountId);

        const fromSnap = await transaction.get(fromRef);
        const toSnap = await transaction.get(toRef);

        if (!fromSnap.exists() || !toSnap.exists()) {
          throw new Error("One or both selected accounts do not exist.");
        }

        const fromData = fromSnap.data();
        const toData = toSnap.data();

        const currentFromBal = fromData.balance || 0;
        const currentToBal = toData.balance || 0;

        const finalFromBal = currentFromBal - enteredAmount;
        const finalToBal = currentToBal + enteredAmount;

        // Save general voucher doc
        const voucherRef = doc(collection(db, "general-vouchers"));
        transaction.set(voucherRef, {
          voucherNo: nextVoucherNo,
          date: formData.date,
          fromAccountId: formData.fromAccountId,
          fromAccountName: fromData.name,
          toAccountId: formData.toAccountId,
          toAccountName: toData.name,
          description: formData.description.trim(),
          amount: enteredAmount,
          fromPrevBalance: currentFromBal,
          fromNewBalance: finalFromBal,
          toPrevBalance: currentToBal,
          toNewBalance: finalToBal,
          createdBy: user.uid,
          createdAt: serverTimestamp()
        });

        // Update from account
        transaction.update(fromRef, {
          balance: finalFromBal,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid
        });

        // Update to account
        transaction.update(toRef, {
          balance: finalToBal,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid
        });

        // Log entry
        const logRef = doc(collection(db, "logs"));
        transaction.set(logRef, {
          action: `Generated General Voucher No: ${nextVoucherNo}`,
          details: `Transferred Rs. ${enteredAmount.toLocaleString()} from ${fromData.name} to ${toData.name}`,
          performedBy: user.uid,
          timestamp: serverTimestamp(),
          type: "ACCOUNTING_ACTION"
        });
      });

      setIsCreateOpen(false);
      resetForm();
      alert(`General Voucher No. ${nextVoucherNo} generated successfully.`);
    } catch (error: any) {
      console.error("General transaction failed:", error);
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVoucher = async (voucher: GeneralVoucher) => {
    if (!confirm(`Are you sure you want to delete General Voucher No: ${voucher.voucherNo}? This will revert the transaction and update the account balances.`)) return;

    try {
      await runTransaction(db, async (transaction) => {
        // Fetch voucher doc
        const voucherRef = doc(db, "general-vouchers", voucher.id);
        const voucherSnap = await transaction.get(voucherRef);
        if (!voucherSnap.exists()) return;

        // Fetch accounts
        const fromRef = doc(db, "accounts", voucher.fromAccountId);
        const toRef = doc(db, "accounts", voucher.toAccountId);

        const fromSnap = await transaction.get(fromRef);
        const toSnap = await transaction.get(toRef);

        if (fromSnap.exists()) {
          const currentFromBal = fromSnap.data().balance || 0;
          // Revert: since it was cut/subtracted, add it back.
          transaction.update(fromRef, {
            balance: currentFromBal + voucher.amount,
            updatedAt: serverTimestamp()
          });
        }

        if (toSnap.exists()) {
          const currentToBal = toSnap.data().balance || 0;
          // Revert: since it was added, subtract it.
          transaction.update(toRef, {
            balance: currentToBal - voucher.amount,
            updatedAt: serverTimestamp()
          });
        }

        // Delete general voucher doc
        transaction.delete(voucherRef);

        // Add log entry
        if (user) {
          const logRef = doc(collection(db, "logs"));
          transaction.set(logRef, {
            action: `Deleted General Voucher No: ${voucher.voucherNo}`,
            details: `Reverted transfer of Rs. ${voucher.amount.toLocaleString()} from ${voucher.fromAccountName} to ${voucher.toAccountName}`,
            performedBy: user.uid,
            timestamp: serverTimestamp(),
            type: "ACCOUNTING_ACTION"
          });
        }
      });
      
      alert(`General Voucher No. ${voucher.voucherNo} deleted and balances reverted successfully.`);
    } catch (error: any) {
      console.error("General reversion failed:", error);
      alert(`Reversion failed: ${error.message}`);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredVouchers = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return vouchers.filter(v => {
      return v.fromAccountName.toLowerCase().includes(term) ||
        v.toAccountName.toLowerCase().includes(term) ||
        v.description.toLowerCase().includes(term) ||
        v.voucherNo.toString().includes(term);
    });
  }, [vouchers, searchTerm]);

  const PrintableVoucherDoc = ({ voucher }: { voucher: GeneralVoucher }) => (
    <div id="print-content" className="bg-card p-8 md:p-12 max-w-4xl mx-auto text-foreground font-sans relative border border-slate-300 rounded-lg">
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-8">
        <div className="flex flex-col">
          <div className="mb-3 -ml-1"><h2 className="text-3xl font-black tracking-tighter bg-gradient-to-r from-[#E5484D] to-[#8a1c20] bg-clip-text text-transparent uppercase drop-shadow-sm leading-none">ZOHAIB MOTORS</h2><div className="h-1 w-12 bg-[#1C1F26] mt-1 rounded-full opacity-80"></div></div>
          <h1 className="text-2xl font-bold uppercase tracking-tight text-foreground">General Journal Voucher</h1>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">Official Accounts Copy</p>
        </div>
        <div className="text-right space-y-1">
          <div className="bg-slate-900 text-white px-3 py-1 text-xs font-bold tracking-widest inline-block mb-1.5 uppercase">
            Journal Voucher
          </div>
          <p className="text-[10px] text-muted-foreground uppercase font-bold">Voucher No.</p>
          <p className="text-sm font-bold font-mono">JV-{voucher.voucherNo.toString().padStart(4, '0')}</p>
          <p className="text-[10px] text-muted-foreground uppercase font-bold mt-1">Date</p>
          <p className="text-xs font-mono">{voucher.date}</p>
        </div>
      </div>

      {/* Account Info Tables */}
      <div className="space-y-6 mb-8">
        <div className="grid grid-cols-2 gap-8">
          {/* Source Account (Debit/Credit from) */}
          <div className="border rounded-lg p-4 bg-muted/50">
            <span className="text-[10px] text-muted-foreground font-bold uppercase block mb-1">Debited / From Account (Source)</span>
            <span className="text-base font-bold text-slate-950 block">{voucher.fromAccountName}</span>
            <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-border/60 text-xs">
              <div>
                <span className="text-muted-foreground block">Previous Bal</span>
                <span className="font-semibold text-foreground">Rs. {voucher.fromPrevBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Closing Bal</span>
                <span className="font-bold text-foreground">Rs. {voucher.fromNewBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Destination Account */}
          <div className="border rounded-lg p-4 bg-muted/50">
            <span className="text-[10px] text-muted-foreground font-bold uppercase block mb-1">Credited / To Account (Destination)</span>
            <span className="text-base font-bold text-slate-950 block">{voucher.toAccountName}</span>
            <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-border/60 text-xs">
              <div>
                <span className="text-muted-foreground block">Previous Bal</span>
                <span className="font-semibold text-foreground">Rs. {voucher.toPrevBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Closing Bal</span>
                <span className="font-bold text-foreground">Rs. {voucher.toNewBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <div className="flex justify-between items-center pb-2 border-b">
            <span className="text-xs text-muted-foreground font-bold uppercase">Transaction Particulars</span>
            <span className="text-xs text-muted-foreground font-bold uppercase">Transferred Amount</span>
          </div>
          <div className="flex justify-between items-start pt-3">
            <span className="text-sm text-foreground whitespace-pre-wrap max-w-lg">{voucher.description}</span>
            <span className="text-base font-extrabold text-foreground">Rs. {voucher.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

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
          <span className="text-[10px] uppercase font-bold text-muted-foreground mt-2 block">Authorized Signatory</span>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-12 text-[10px] text-muted-foreground flex justify-between border-t border-border pt-4 uppercase">
        <span>Zohaib Motors accounts System</span>
        <span>Generated on {new Date().toLocaleDateString()}</span>
      </div>
    </div>
  );

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
          <div className="relative flex-1 w-full">
            <Search className="absolute left-2.5 top-2.5 text-muted-foreground" size={16} />
            <Input
              className="pl-9 bg-card"
              placeholder="Search by Voucher No, Account, Description..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <Button onClick={() => setIsCreateOpen(true)} className="bg-secondary hover:bg-secondary/90 text-white text-white shrink-0 gap-1.5 h-10 w-full sm:w-auto">
            <Plus size={18} /> Create Voucher
          </Button>
        </div>

        {/* List of Vouchers */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-muted-foreground font-medium border-b">
                <tr>
                  <th className="px-6 py-4">Voucher No</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">From Account</th>
                  <th className="px-6 py-4">To Account</th>
                  <th className="px-6 py-4 text-right">Transfer Amount</th>
                  <th className="px-6 py-4">Description</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredVouchers.map(voucher => (
                  <tr key={voucher.id} className="hover:bg-muted transition-colors group">
                    <td className="px-6 py-4 font-mono font-bold text-foreground">
                      JV-{voucher.voucherNo.toString().padStart(4, '0')}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground font-mono text-xs">
                      {voucher.date}
                    </td>
                    <td className="px-6 py-4 font-semibold text-red-600">
                      {voucher.fromAccountName}
                      <span className="block text-[10px] text-muted-foreground font-mono font-medium">New Bal: Rs. {voucher.fromNewBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-green-600">
                      {voucher.toAccountName}
                      <span className="block text-[10px] text-muted-foreground font-mono font-medium">New Bal: Rs. {voucher.toNewBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </td>
                    <td className="px-6 py-4 text-right font-extrabold text-foreground">
                      Rs. {voucher.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground max-w-[200px] truncate" title={voucher.description}>
                      {voucher.description}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8 p-0 text-primary" onClick={() => setSelectedPrintVoucher(voucher)} title="Print Preview">
                          <Printer size={16} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 p-0 text-red-500" onClick={() => handleDeleteVoucher(voucher)} title="Delete Voucher">
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredVouchers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      No general journal vouchers found.
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
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="text-foreground" size={20} />
              Generate Journal Voucher
            </DialogTitle>
            <DialogDescription>
              Transfer balances between any two accounts in the ledger.
            </DialogDescription>
          </DialogHeader>

          {message && (
            <div className={`p-3 rounded text-xs font-medium flex items-center gap-2 ${message.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              {!message.includes('Error') && <CheckCircle2 size={14} />}
              {message}
            </div>
          )}

          {accounts.length === 0 ? (
            <div className="p-4 bg-muted rounded-lg text-amber-800 text-xs flex flex-col gap-2">
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle size={16} /> No Accounts Configured
              </div>
              <p>You must create accounts in the Accounts Manager before creating journal transfers.</p>
            </div>
          ) : (
            <form onSubmit={handleCreateVoucher} className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground block">Voucher No (Auto)</label>
                  <Input value={`JV-${nextVoucherNo.toString().padStart(4, '0')}`} disabled className="bg-muted font-mono font-bold cursor-not-allowed" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><Calendar size={12} /> Date *</label>
                  <Input type="date" required value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                </div>
              </div>

              {/* Accounts Selection Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground block">From Account (Source) *</label>
                  <SearchSelector
                    items={accounts}
                    value={formData.fromAccountId}
                    onChange={(val) => setFormData(prev => ({ ...prev, fromAccountId: val }))}
                    placeholder="Choose account"
                    searchPlaceholder="Search account..."
                    getSearchFields={(acc) => [acc.name, acc.typeName]}
                    itemKey={(acc) => acc.id}
                    renderTrigger={(selected) =>
                      selected ? (
                        <span>{selected.name} <span className="text-muted-foreground text-xs ml-1">(Rs. {selected.balance.toLocaleString()})</span></span>
                      ) : (
                        <span className="text-muted-foreground">Choose account</span>
                      )
                    }
                    renderItem={(acc) => (
                      <div className="flex justify-between items-center w-full text-left">
                        <span className="font-medium text-foreground">{acc.name}</span>
                        <span className="text-xs text-muted-foreground font-mono">Rs. {acc.balance.toLocaleString()}</span>
                      </div>
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground block">To Account (Destination) *</label>
                  <SearchSelector
                    items={accounts}
                    value={formData.toAccountId}
                    onChange={(val) => setFormData(prev => ({ ...prev, toAccountId: val }))}
                    placeholder="Choose account"
                    searchPlaceholder="Search account..."
                    getSearchFields={(acc) => [acc.name, acc.typeName]}
                    itemKey={(acc) => acc.id}
                    renderTrigger={(selected) =>
                      selected ? (
                        <span>{selected.name} <span className="text-muted-foreground text-xs ml-1">(Rs. {selected.balance.toLocaleString()})</span></span>
                      ) : (
                        <span className="text-muted-foreground">Choose account</span>
                      )
                    }
                    renderItem={(acc) => (
                      <div className="flex justify-between items-center w-full text-left">
                        <span className="font-medium text-foreground">{acc.name}</span>
                        <span className="text-xs text-muted-foreground font-mono">Rs. {acc.balance.toLocaleString()}</span>
                      </div>
                    )}
                  />
                </div>
              </div>

              {/* Balances Display Card */}
              {(formData.fromAccountId || formData.toAccountId) && (
                <div className="border rounded-lg overflow-hidden bg-muted">
                  <div className="grid grid-cols-2 divide-x border-b p-3 text-xs">
                    {/* From Account Balances */}
                    <div className="pr-3 space-y-1">
                      <span className="text-[10px] text-muted-foreground font-bold uppercase block">From Account (Change)</span>
                      {fromAccountObj ? (
                        <>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Current Balance:</span>
                            <span className="font-medium text-foreground">Rs. {fromPrevBal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                          {enteredAmount > 0 && (
                            <div className="flex justify-between border-t pt-1 mt-1 font-bold">
                              <span className="text-muted-foreground">New Balance:</span>
                              <span className="text-red-600">Rs. {fromNewBal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground italic">No account selected</span>
                      )}
                    </div>

                    {/* To Account Balances */}
                    <div className="pl-3 space-y-1">
                      <span className="text-[10px] text-muted-foreground font-bold uppercase block">To Account (Change)</span>
                      {toAccountObj ? (
                        <>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Current Balance:</span>
                            <span className="font-medium text-foreground">Rs. {toPrevBal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                          {enteredAmount > 0 && (
                            <div className="flex justify-between border-t pt-1 mt-1 font-bold">
                              <span className="text-muted-foreground">New Balance:</span>
                              <span className="text-green-600">Rs. {toNewBal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground italic">No account selected</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground block">Transfer Amount (Rs.) *</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={e => setFormData({ ...formData, amount: e.target.value.replace("-", "") })}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground block">Description / Notes *</label>
                <Input required value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="e.g. Transferred cash to bank account, initial setup" />
              </div>

              <DialogFooter className="pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} disabled={loading}>Cancel</Button>
                <Button type="submit" disabled={loading} className="bg-secondary hover:bg-secondary/90 text-white text-white">
                  {loading ? "Processing..." : "Generate Voucher"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Print Preview */}
      {selectedPrintVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200 print-hide">
          <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col shadow-xl bg-card overflow-hidden">
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
            
            <div className="flex flex-1 overflow-hidden bg-muted p-4 md:p-8">
              <div className="flex-1 overflow-y-auto">
                <div className="shadow-2xl shadow-slate-200 rounded-xl overflow-hidden ring-1 ring-slate-200 bg-card">
                  <PrintableVoucherDoc voucher={selectedPrintVoucher} />
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Hidden print-only layer rendered when printing */}
      {selectedPrintVoucher && (
        <div className="hidden print:block">
          <PrintableVoucherDoc voucher={selectedPrintVoucher} />
        </div>
      )}
    </>
  );
};
