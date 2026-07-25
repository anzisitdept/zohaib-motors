"use client";
import { useState, useEffect, FormEvent } from "react";
import {
  collection, updateDoc, doc, onSnapshot,
  query, orderBy, serverTimestamp, addDoc, getDocs, where
} from "firebase/firestore";
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
import {
  Search, Pencil, Landmark, X, CheckCircle2, Building, CreditCard, Hash, Loader2, Info
} from "lucide-react";

interface BankAccount {
  id: string;
  name: string;
  typeId: string;
  typeName: string;
  balance: number;
  description?: string;
  accountNumber?: string;
  iban?: string;
  bankName?: string;
  createdAt: any;
}

export const BanksManager = () => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [bankTypeId, setBankTypeId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [message, setMessage] = useState("");

  // Form state — edit only: bank-specific details
  const [formData, setFormData] = useState({
    name: "",
    typeId: "bank",
    balance: "0",
    balanceType: "debit",
    description: "",
    accountNumber: "",
    iban: "",
    bankName: "",
  });

  // 1) Find the real "Bank" account-type ID from Firestore
  useEffect(() => {
    const fetchBankTypeId = async () => {
      try {
        const q = query(collection(db, "account-types"), where("name", "==", "Bank"));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setBankTypeId(snap.docs[0].id);
        } else {
          // Try case-insensitive fallback
          const allQ = query(collection(db, "account-types"));
          const allSnap = await getDocs(allQ);
          const found = allSnap.docs.find(d => d.data().name?.toLowerCase() === "bank");
          if (found) setBankTypeId(found.id);
        }
      } catch (err) {
        console.error("Error fetching bank type:", err);
      }
    };
    fetchBankTypeId();
  }, []);

  // 2) Once bankTypeId is known, subscribe to bank accounts
  useEffect(() => {
    if (bankTypeId === null) return;

    const q = query(
      collection(db, "accounts"),
      where("typeId", "==", bankTypeId),
      orderBy("name")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BankAccount));
      setAccounts(data);
      setDataLoading(false);
    }, (err) => {
      console.error("Error loading bank accounts:", err);
      // Fallback: load all and filter by typeName
      const fallbackQ = query(collection(db, "accounts"), orderBy("name"));
      onSnapshot(fallbackQ, (snap) => {
        const filtered = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as BankAccount))
          .filter(a => a.typeName?.toLowerCase() === "bank");
        setAccounts(filtered);
        setDataLoading(false);
      });
    });

    return () => unsub();
  }, [bankTypeId]);

  const resetForm = () => {
    setFormData({
      name: "",
      typeId: "bank",
      balance: "0",
      balanceType: "debit",
      description: "",
      accountNumber: "",
      iban: "",
      bankName: "",
    });
    setIsEditing(null);
    setMessage("");
  };

  const handleEdit = (account: BankAccount) => {
    const isCredit = account.balance < 0;
    setFormData({
      name: account.name,
      typeId: account.typeId,
      balance: Math.abs(account.balance).toString(),
      balanceType: isCredit ? "credit" : "debit",
      description: account.description || "",
      accountNumber: account.accountNumber || "",
      iban: account.iban || "",
      bankName: account.bankName || "",
    });
    setIsEditing(account.id);
    setMessage("");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !isEditing) return;

    setLoading(true);
    setMessage("");

    try {
      const enteredBalance = parseFloat(formData.balance) || 0;
      const finalBalance = formData.balanceType === "credit" ? -Math.abs(enteredBalance) : Math.abs(enteredBalance);

      const payload = {
        name: formData.name.trim(),
        typeId: formData.typeId,
        balance: finalBalance,
        description: formData.description.trim(),
        accountNumber: formData.accountNumber.trim(),
        iban: formData.iban.trim(),
        bankName: formData.bankName.trim(),
        updatedBy: user.uid,
        updatedAt: serverTimestamp()
      };

      await updateDoc(doc(db, "accounts", isEditing), payload);

      await addDoc(collection(db, "logs"), {
        action: `Updated bank account: ${formData.name}`,
        performedBy: user.uid,
        timestamp: serverTimestamp(),
        type: "ADMIN_ACTION"
      });

      setMessage("Success: Bank details updated successfully.");
      resetForm();
    } catch (error: any) {
      console.error("Error updating bank:", error);
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredAccounts = accounts.filter(a =>
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (a.bankName && a.bankName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (a.accountNumber && a.accountNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (a.iban && a.iban.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (a.description && a.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // --- Loading skeleton ---
  if (dataLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="animate-pulse space-y-4 p-6 bg-card rounded-xl border border-border">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-9 bg-muted rounded-lg" />
          ))}
        </div>
        <div className="lg:col-span-2 animate-pulse space-y-3 p-6 bg-card rounded-xl border border-border">
          <div className="h-9 bg-muted rounded-lg mb-4" />
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 bg-muted rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-auto">
      {/* Left: Edit Form */}
      <Card className="p-6 h-fit">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">
            {isEditing ? "Edit Bank Details" : "Select a Bank to Edit"}
          </h3>
          {isEditing && (
            <Button variant="ghost" size="sm" onClick={resetForm} className="h-8 w-8 p-0">
              <X size={16} />
            </Button>
          )}
        </div>

        {!isEditing && (
          <div className="flex items-start gap-2 p-3 bg-muted rounded-lg text-primary text-xs mb-4">
            <Info size={14} className="shrink-0 mt-0.5" />
            <p>Click the <strong>edit</strong> button on a bank account to update its Bank Name, Account Number, and IBAN. To create or delete bank accounts, use the <strong>Accounts Manager</strong>.</p>
          </div>
        )}

        {message && (
          <div className={`mb-4 p-3 rounded text-xs font-medium flex items-center gap-2 ${message.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {!message.includes('Error') && <CheckCircle2 size={14} />}
            {message}
          </div>
        )}

        {isEditing ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                <Building size={12} /> Bank Name
              </label>
              <Input
                value={formData.bankName}
                onChange={e => setFormData({ ...formData, bankName: e.target.value })}
                placeholder="e.g. HBL, Meezan Bank, UBL"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                <Hash size={12} /> Account Number
              </label>
              <Input
                value={formData.accountNumber}
                onChange={e => setFormData({ ...formData, accountNumber: e.target.value })}
                placeholder="Account Number"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                <CreditCard size={12} /> IBAN Number
              </label>
              <Input value={formData.iban} onChange={e => setFormData({ ...formData, iban: e.target.value })} placeholder="PK00XXXX000000000000" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground block">
                Initial Balance / Current Balance
              </label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.balance}
                  onChange={e => setFormData({ ...formData, balance: e.target.value })}
                  placeholder="0.00"
                  className="flex-1"
                />
                <Select
                  value={formData.balanceType}
                  onValueChange={(val) => setFormData(prev => ({ ...prev, balanceType: val }))}
                >
                  <SelectTrigger className="w-[120px] bg-card">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debit">Debit (Dr)</SelectItem>
                    <SelectItem value="credit">Credit (Cr)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Description / Notes
              </label>
              <Input
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="Branch, purpose, etc."
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit" className="flex-1 bg-slate-900" disabled={loading}>
                {loading ? (
                  <><Loader2 size={16} className="mr-2 animate-spin" /> Saving...</>
                ) : (
                  "Save Bank Details"
                )}
              </Button>
              <Button type="button" variant="outline" onClick={resetForm} disabled={loading}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Landmark size={40} className="mx-auto mb-3 text-slate-200" />
            <p className="text-sm">Select a bank from the list to edit its details</p>
          </div>
        )}
      </Card>

      {/* Right: Bank List */}
      <Card className="lg:col-span-2 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-border bg-muted flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 text-muted-foreground" size={16} />
            <Input
              className="pl-9 bg-card"
              placeholder="Search by name, bank, IBAN..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="text-xs text-muted-foreground font-medium px-2 shrink-0">
            {filteredAccounts.length} Bank{filteredAccounts.length !== 1 ? "s" : ""}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px]">
          {filteredAccounts.map(account => (
            <div
              key={account.id}
              className={`group flex items-center justify-between p-4 bg-card border rounded-xl hover:shadow-sm transition-all ${
                isEditing === account.id
                  ? "border-blue-300 bg-muted/30 shadow-sm"
                  : "border-border hover:border-blue-200"
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-bold shrink-0">
                  <Landmark size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-foreground">{account.name}</h4>
                    {isEditing === account.id && (
                      <span className="text-[10px] bg-blue-100 text-primary font-bold uppercase px-1.5 py-0.5 rounded">Editing</span>
                    )}
                  </div>
                  {account.bankName && (
                    <div className="text-xs text-foreground mt-0.5 font-medium flex items-center gap-1">
                      <Building size={10} /> {account.bankName}
                    </div>
                  )}
                  {(account.accountNumber || account.iban) && (
                    <div className="text-xs text-muted-foreground mt-0.5 flex gap-3">
                      {account.accountNumber && <span>A/C: {account.accountNumber}</span>}
                      {account.iban && <span>IBAN: {account.iban}</span>}
                    </div>
                  )}
                  {account.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 italic">{account.description}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right shrink-0">
                  <div className={`text-sm font-bold ${account.balance < 0 ? "text-red-600" : "text-foreground"}`}>
                    Rs. {Math.abs(account.balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {account.balance < 0 ? "Cr" : "Dr"}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{account.balance >= 0 ? "Balance (Dr)" : "Balance (Cr)"}</div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant={isEditing === account.id ? "default" : "ghost"}
                    size="sm"
                    onClick={() => isEditing === account.id ? resetForm() : handleEdit(account)}
                    title={isEditing === account.id ? "Cancel editing" : "Edit bank details"}
                    className={isEditing === account.id ? "bg-secondary hover:bg-secondary/90 text-white" : "opacity-0 group-hover:opacity-100 transition-opacity"}
                  >
                    {isEditing === account.id ? <X size={16} /> : <Pencil size={16} className="text-primary" />}
                  </Button>
                </div>
              </div>
            </div>
          ))}

          {filteredAccounts.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Landmark size={48} className="mx-auto mb-3 text-slate-200" />
              <p className="font-medium">No bank accounts found</p>
              <p className="text-xs mt-1">Create bank accounts in the Accounts Manager with type "Bank"</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
