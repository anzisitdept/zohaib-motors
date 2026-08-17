"use client";
import { useState, useEffect, FormEvent } from "react";
import {
  collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot,
  query, orderBy, serverTimestamp, getDocs, where
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
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
  Search, Pencil, Trash2, Wallet, X, CheckCircle2, AlertTriangle,
  Store, UserSquare, Phone, CreditCard, FileImage, Loader2, MapPin
} from "lucide-react";
import Link from "next/link";

interface Account {
  id: string;
  name: string;
  typeId: string;
  typeName: string;
  balance: number;
  description?: string;
  shopName?: string;
  fatherName?: string;
  phoneNumber?: string;
  cnic?: string;
  cnicPicture?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  address?: string;
  createdAt: any;
}

interface AccountType {
  id: string;
  name: string;
  requireNumberInfo?: boolean;
}

export const AccountsManager = () => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [message, setMessage] = useState("");

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    typeId: "",
    balance: "0",
    balanceType: "debit",
    description: "",
    shopName: "",
    fatherName: "",
    phoneNumber: "",
    cnic: "",
    cnicPicture: "",
    attachmentUrl: "",
    attachmentName: "",
    address: ""
  });
  const [cnicFile, setCnicFile] = useState<File | null>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  // Fetch Accounts and Account Types
  useEffect(() => {
    setDataLoading(true);
    let accountsReady = false;
    let typesReady = false;

    const checkReady = () => {
      if (accountsReady && typesReady) setDataLoading(false);
    };

    const qAccounts = query(collection(db, "accounts"), orderBy("name"));
    const unsubAccounts = onSnapshot(qAccounts, (snapshot) => {
      setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)));
      accountsReady = true;
      checkReady();
    });

    const qTypes = query(collection(db, "account-types"), orderBy("name"));
    const unsubTypes = onSnapshot(qTypes, (snapshot) => {
      setAccountTypes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AccountType)));
      typesReady = true;
      checkReady();
    });

    return () => {
      unsubAccounts();
      unsubTypes();
    };
  }, []);

  const resetForm = () => {
    setFormData({
      name: "",
      typeId: "",
      balance: "0",
      balanceType: "debit",
      description: "",
      shopName: "",
      fatherName: "",
      phoneNumber: "",
      cnic: "",
      cnicPicture: "",
      attachmentUrl: "",
      attachmentName: "",
      address: ""
    });
    setCnicFile(null);
    setAttachmentFile(null);
    setIsEditing(null);
    setMessage("");
  };

  const handleEdit = (account: Account) => {
    const isCredit = account.balance < 0;
    setFormData({
      name: account.name,
      typeId: account.typeId,
      balance: Math.abs(account.balance).toString(),
      balanceType: isCredit ? "credit" : "debit",
      description: account.description || "",
      shopName: account.shopName || "",
      fatherName: account.fatherName || "",
      phoneNumber: account.phoneNumber || "",
      cnic: account.cnic || "",
      cnicPicture: account.cnicPicture || "",
      attachmentUrl: account.attachmentUrl || "",
      attachmentName: account.attachmentName || "",
      address: account.address || ""
    });
    setCnicFile(null);
    setAttachmentFile(null);
    setIsEditing(account.id);
    setMessage("");
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete the account "${name}"?`)) {
      try {
        await deleteDoc(doc(db, "accounts", id));

        if (user) {
          await addDoc(collection(db, "logs"), {
            action: `Deleted account: ${name}`,
            performedBy: user.uid,
            timestamp: serverTimestamp(),
            type: "ADMIN_ACTION"
          });
        }

        setMessage("Success: Account deleted successfully.");
      } catch (error: any) {
        console.error("Error deleting account:", error);
        setMessage(`Error: ${error.message}`);
      }
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.name.trim()) {
      setMessage("Error: Account name is required");
      return;
    }

    if (!formData.typeId) {
      setMessage("Error: Please select an account type");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const selectedType = accountTypes.find(t => t.id === formData.typeId);
      const typeName = selectedType ? selectedType.name : "Unknown";
      const requireNumberInfo = selectedType?.requireNumberInfo ?? false;

      if (requireNumberInfo && !formData.phoneNumber.trim()) {
        setMessage("Error: Phone number is required when number information is enabled");
        setLoading(false);
        return;
      }

      let cnicPicUrl = formData.cnicPicture;
      if (cnicFile) {
        const apiKey = process.env.NEXT_PUBLIC_IMGBB_API_KEY;
        if (!apiKey) throw new Error("ImgBB API key is not configured.");

        const form = new FormData();
        form.append("image", cnicFile);

        const res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
          method: "POST",
          body: form
        });
        const data = await res.json();
        if (data.success) {
          cnicPicUrl = data.data.url;
        } else {
          throw new Error(data.error?.message || "Failed to upload image to ImgBB");
        }
      }

      let attachUrl = formData.attachmentUrl;
      let attachName = formData.attachmentName;
      if (attachmentFile) {
        const storageRef = ref(storage, `accounts/${Date.now()}_${attachmentFile.name}`);
        const snapshot = await uploadBytes(storageRef, attachmentFile);
        attachUrl = await getDownloadURL(snapshot.ref);
        attachName = attachmentFile.name;
      }

      const enteredBalance = parseFloat(formData.balance) || 0;
      const finalBalance = formData.balanceType === "credit" ? -Math.abs(enteredBalance) : Math.abs(enteredBalance);

      const payload = {
        name: formData.name.trim(),
        typeId: formData.typeId,
        typeName: typeName,
        balance: finalBalance,
        description: formData.description.trim(),
        shopName: requireNumberInfo ? formData.shopName.trim() : "",
        fatherName: requireNumberInfo ? formData.fatherName.trim() : "",
        phoneNumber: requireNumberInfo ? formData.phoneNumber.trim() : "",
        cnic: requireNumberInfo ? formData.cnic.trim() : "",
        cnicPicture: requireNumberInfo ? cnicPicUrl : "",
        attachmentUrl: attachUrl,
        attachmentName: attachName,
        address: requireNumberInfo ? formData.address.trim() : "",
        updatedBy: user.uid,
        updatedAt: serverTimestamp()
      };

      if (isEditing) {
        await updateDoc(doc(db, "accounts", isEditing), payload);

        await addDoc(collection(db, "logs"), {
          action: `Updated account: ${formData.name}`,
          performedBy: user.uid,
          timestamp: serverTimestamp(),
          type: "ADMIN_ACTION"
        });

        setMessage("Success: Account updated successfully.");
      } else {
        // Check for duplicates
        const duplicate = accounts.find(a => a.name.toLowerCase() === formData.name.trim().toLowerCase());
        if (duplicate) {
          setMessage("Error: An account with this name already exists.");
          setLoading(false);
          return;
        }

        const accountRef = await addDoc(collection(db, "accounts"), {
          ...payload,
          createdBy: user.uid,
          createdAt: serverTimestamp()
        });

        // If an initial balance is set, write an Opening Balance voucher
        // so it shows up as the first entry in the General Ledger
        const initialBal = finalBalance;
        const today = new Date().toISOString().split("T")[0];
        if (initialBal !== 0) {
          await addDoc(collection(db, "vouchers"), {
            voucherNo: `OB-${accountRef.id.slice(-6).toUpperCase()}`,
            date: today,
            description: `Opening Balance — ${formData.name.trim()}`,
            amount: Math.abs(initialBal),
            debit: initialBal > 0 ? Math.abs(initialBal) : 0,
            credit: initialBal < 0 ? Math.abs(initialBal) : 0,
            cashAccountId: accountRef.id,
            cashAccountName: formData.name.trim(),
            cashType: initialBal > 0 ? "debit" : "credit",
            cashPreviousBalance: 0,
            cashNewBalance: initialBal,
            counterAccountId: null,
            counterAccountName: "Opening Balance (Equity)",
            counterType: initialBal > 0 ? "credit" : "debit",
            counterPreviousBalance: null,
            counterNewBalance: null,
            accountId: accountRef.id,
            accountName: formData.name.trim(),
            type: initialBal > 0 ? "debit" : "credit",
            previousBalance: 0,
            newBalance: initialBal,
            isOpeningBalance: true,
            invoiceType: "OPENING_BALANCE",
            createdBy: user.uid,
            createdAt: serverTimestamp()
          });
        }

        await addDoc(collection(db, "logs"), {
          action: `Created account: ${formData.name} (${typeName})${initialBal ? ` with opening balance Rs. ${Math.abs(initialBal).toLocaleString()} (${initialBal > 0 ? 'Dr' : 'Cr'})` : ""}`,
          performedBy: user.uid,
          timestamp: serverTimestamp(),
          type: "ADMIN_ACTION"
        });

        setMessage("Success: Account created successfully.");
      }
      resetForm();
    } catch (error: any) {
      console.error("Error saving account:", error);
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredAccounts = accounts.filter(a => {
    const matchesSearch = a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.description && a.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (a.shopName && a.shopName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (a.phoneNumber && a.phoneNumber.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = typeFilter === "ALL" || a.typeId === typeFilter;
    return matchesSearch && matchesType;
  });

  const selectedAccountType = accountTypes.find(t => t.id === formData.typeId);
  const showExtraFields = selectedAccountType?.requireNumberInfo ?? false;

  // --- Loading skeleton ---
  if (dataLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="animate-pulse space-y-4 p-6 bg-card rounded-xl border border-border">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-9 bg-muted rounded-lg" />
          ))}
        </div>
        <div className="lg:col-span-2 animate-pulse space-y-3 p-6 bg-card rounded-xl border border-border">
          <div className="h-9 bg-muted rounded-lg mb-4" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-muted rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-auto">
      {/* Left: Form */}
      <Card className="p-6 h-fit">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">{isEditing ? "Edit Account" : "Add New Account"}</h3>
          {isEditing && (
            <Button variant="ghost" size="sm" onClick={resetForm} className="h-8 w-8 p-0">
              <X size={16} />
            </Button>
          )}
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded text-xs font-medium flex items-center gap-2 ${message.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {!message.includes('Error') && <CheckCircle2 size={14} />}
            {message}
          </div>
        )}

        {accountTypes.length === 0 ? (
          <div className="p-4 bg-muted rounded-lg text-amber-800 text-xs flex flex-col gap-2">
            <div className="flex items-center gap-1.5 font-semibold">
              <AlertTriangle size={16} /> No Account Types Found
            </div>
            <p>You must define at least one account type before creating accounts.</p>
            <Link href="/dashboard/account-types" className="mt-2">
              <Button size="sm" variant="outline" className="w-full text-xs border-amber-300 hover:bg-amber-100/50">
                Manage Account Types
              </Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                <Wallet size={12} /> Account Name *
              </label>
              <Input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Office Petty Cash, HBL Bank..." />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground block">
                Account Type *
              </label>
              <Select value={formData.typeId} onValueChange={(val) => setFormData(prev => ({ ...prev, typeId: val }))}>
                <SelectTrigger className="w-full bg-card">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {accountTypes.map(type => (
                    <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.typeId && (
                <p className="text-[11px] mt-1.5 flex items-center gap-1">
                  {showExtraFields ? (
                    <span className="text-primary font-medium">ℹ️ This account type requires number information (Phone, CNIC, etc.)</span>
                  ) : (
                    <span className="text-muted-foreground">No extra number info required for this type.</span>
                  )}
                </p>
              )}
            </div>

            {showExtraFields && (
              <div className="space-y-4 p-4 border rounded-xl bg-muted/50 mt-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                    <Store size={12} /> Shop Name
                  </label>
                  <Input value={formData.shopName} onChange={e => setFormData({ ...formData, shopName: e.target.value })} placeholder="Shop / Business Name" />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                    <UserSquare size={12} /> Father Name
                  </label>
                  <Input value={formData.fatherName} onChange={e => setFormData({ ...formData, fatherName: e.target.value })} placeholder="Father's Name" />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                    <Phone size={12} /> Phone Number *
                  </label>
                  <Input required value={formData.phoneNumber} onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })} placeholder="e.g. 03001234567" />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                    <CreditCard size={12} /> CNIC / ID
                  </label>
                  <Input value={formData.cnic} onChange={e => setFormData({ ...formData, cnic: e.target.value })} placeholder="XXXXX-XXXXXXX-X" />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                    <FileImage size={12} /> CNIC Picture / Scan
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={e => {
                        if (e.target.files && e.target.files.length > 0) {
                          setCnicFile(e.target.files[0]);
                        }
                      }}
                      className="file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:bg-muted file:text-primary hover:file:bg-blue-100"
                    />
                  </div>
                  {(formData.cnicPicture || cnicFile) && (
                    <div className="text-[10px] text-green-600 font-medium flex items-center gap-1 mt-1">
                      <CheckCircle2 size={12} /> {cnicFile ? "New image selected" : "Image previously uploaded"}
                    </div>
                  )}
                </div>


                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                    <MapPin size={12} /> Address
                  </label>
                  <Input value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="Full Address" />
                </div>
              </div>
            )}

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

            <div className="space-y-2 mt-4">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                <FileImage size={12} /> General Attachment (PDF / Image)
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={e => {
                    if (e.target.files && e.target.files.length > 0) {
                      setAttachmentFile(e.target.files[0]);
                    }
                  }}
                  className="file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:bg-muted file:text-primary hover:file:bg-blue-100"
                />
              </div>
              {(formData.attachmentUrl || attachmentFile) && (
                <div className="text-[10px] text-green-600 font-medium flex items-center gap-1 mt-1">
                  <CheckCircle2 size={12} /> {attachmentFile ? "New file selected" : "File previously uploaded"}
                </div>
              )}
              {formData.attachmentUrl && !attachmentFile && (
                <a href={formData.attachmentUrl} target="_blank" rel="noreferrer" className="text-[11px] text-blue-600 underline">
                  View current attachment
                </a>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Description / Notes
              </label>
              <Input value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Brief info (optional)" />
            </div>

            <Button type="submit" className="w-full bg-slate-900 mt-2" disabled={loading}>
              {loading ? (
                <><Loader2 size={16} className="mr-2 animate-spin" /> {isEditing ? "Updating..." : "Creating..."}</>
              ) : (
                isEditing ? "Update Account" : "Add Account"
              )}
            </Button>
          </form>
        )}
      </Card>

      {/* Right: List */}
      <Card className="lg:col-span-2 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-border bg-muted flex flex-col md:flex-row gap-4 justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 text-muted-foreground" size={16} />
            <Input
              className="pl-9 bg-card"
              placeholder="Search by name or notes..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px] bg-card">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                {accountTypes.map(type => (
                  <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground font-medium px-2 shrink-0">
              {filteredAccounts.length} Accounts
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px]">
          {filteredAccounts.map(account => (
            <div key={account.id} className="group flex items-center justify-between p-4 bg-card border border-border rounded-xl hover:border-blue-200 hover:shadow-sm transition-all">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-bold">
                  {account.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-foreground">
                      {account.name}
                    </h4>
                    <span className="text-[10px] bg-muted text-muted-foreground font-bold uppercase px-1.5 py-0.5 rounded">
                      {account.typeName}
                    </span>
                  </div>
                  {account.shopName && (
                    <div className="text-xs text-primary mt-1 flex gap-2 font-semibold">
                      Shop: {account.shopName}
                    </div>
                  )}
                  {(account.phoneNumber || account.fatherName || account.cnic || account.attachmentUrl) && (
                    <div className="text-[11px] text-muted-foreground mt-1 space-x-2">
                      {account.phoneNumber && <span>📞 {account.phoneNumber}</span>}
                      {account.fatherName && <span>👤 S/O {account.fatherName}</span>}
                      {account.cnic && <span>🪪 {account.cnic}</span>}
                      {account.attachmentUrl && (
                        <a href={account.attachmentUrl} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">
                          📎 Attachment
                        </a>
                      )}
                    </div>
                  )}
                  {account.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {account.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right shrink-0">
                  <div className={`text-sm font-bold ${account.balance < 0 ? "text-red-600" : "text-foreground"}`}>
                    Rs. {Math.abs(account.balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {account.balance < 0 ? "Cr" : "Dr"}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Balance</div>
                </div>

                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(account)} title="Edit">
                    <Pencil size={16} className="text-primary" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(account.id, account.name)} title="Delete">
                    <Trash2 size={16} className="text-red-500" />
                  </Button>
                </div>
              </div>
            </div>
          ))}

          {filteredAccounts.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p>No accounts found.</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
