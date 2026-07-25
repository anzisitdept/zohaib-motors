"use client";
import { useState } from "react";
import {
  collection, addDoc, serverTimestamp, getDocs, query, where
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import { Loader2, CheckCircle2, UserPlus, Phone, User, CreditCard, MapPin } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called with the new account ID after the client is created */
  onCreated: (accountId: string, clientName: string) => void;
}

export function QuickAddClientDialog({ open, onClose, onCreated }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    shopName: "",
    fatherName: "",
    phone: "",
    email: "",
    cnic: "",
    address: ""
  });

  const reset = () => {
    setFormData({ name: "", shopName: "", fatherName: "", phone: "", email: "", cnic: "", address: "" });
    setMessage("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  // CNIC auto-format
  const handleCnicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "");
    if (val.length > 13) val = val.substring(0, 13);
    let formatted = val;
    if (val.length > 5) formatted = val.substring(0, 5) + "-" + val.substring(5);
    if (val.length > 12) formatted = formatted.substring(0, 13) + "-" + val.substring(12);
    setFormData(prev => ({ ...prev, cnic: formatted }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!formData.name.trim()) { setMessage("Error: Client name is required."); return; }
    if (!formData.phone.trim()) { setMessage("Error: Phone number is required."); return; }

    const cnicRegex = /^\d{5}-\d{7}-\d{1}$/;
    if (formData.cnic && !cnicRegex.test(formData.cnic)) {
      setMessage("Error: Invalid CNIC format. Use XXXXX-XXXXXXX-X");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      // Find or create "Client" Account Type
      let clientTypeId = "";
      const qTypes = query(collection(db, "account-types"), where("name", "==", "Client"));
      const snapshotTypes = await getDocs(qTypes);
      if (!snapshotTypes.empty) {
        clientTypeId = snapshotTypes.docs[0].id;
      } else {
        const typeRef = await addDoc(collection(db, "account-types"), {
          name: "Client",
          description: "Accounts for Client transactions and balances",
          createdAt: serverTimestamp(),
          createdBy: user.uid
        });
        clientTypeId = typeRef.id;
      }

      // Generate unique account name
      const cleanPhone = formData.phone.replace(/\D/g, "");
      const lastFour = cleanPhone.slice(-4) || "0000";
      const accountName = `${formData.name.trim()} (${lastFour})`;

      // Check for existing account
      let accountId = "";
      const qAccs = query(collection(db, "accounts"), where("name", "==", accountName));
      const snapshotAccs = await getDocs(qAccs);

      if (!snapshotAccs.empty) {
        accountId = snapshotAccs.docs[0].id;
      } else {
        const accRef = await addDoc(collection(db, "accounts"), {
          name: accountName,
          typeId: clientTypeId,
          typeName: "Client",
          balance: 0,
          description: `Auto-created account for client: ${formData.name.trim()}`,
          createdAt: serverTimestamp(),
          createdBy: user.uid,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid
        });
        accountId = accRef.id;
      }

      await addDoc(collection(db, "clients"), {
        ...formData,
        name: formData.name.trim(),
        accountId,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedBy: user.uid,
        updatedAt: serverTimestamp()
      });

      await addDoc(collection(db, "logs"), {
        action: `Quick-created client: ${formData.name.trim()} from Sale Invoice`,
        performedBy: user.uid,
        timestamp: serverTimestamp(),
        type: "ADMIN_ACTION"
      });

      setMessage(`Success: ${formData.name.trim()} created!`);
      setTimeout(() => {
        onCreated(accountId, formData.name.trim());
        handleClose();
      }, 800);
    } catch (err: any) {
      console.error("QuickAddClient error:", err);
      setMessage(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus size={18} className="text-primary" />
            Add New Client
          </DialogTitle>
          <DialogDescription>
            Create a new client account. They will be automatically selected as the Seller.
          </DialogDescription>
        </DialogHeader>

        {message && (
          <div className={`p-3 rounded-lg text-sm font-medium flex items-center gap-2 ${
            message.startsWith("Error")
              ? "bg-red-50 text-red-700 border border-red-100"
              : "bg-green-50 text-green-700 border border-green-100"
          }`}>
            {!message.startsWith("Error") && <CheckCircle2 size={14} />}
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <User size={12} /> Client Name *
            </label>
            <Input
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Ali Ahmed"
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <User size={12} /> Shop / Business Name
            </label>
            <Input
              value={formData.shopName}
              onChange={e => setFormData(prev => ({ ...prev, shopName: e.target.value }))}
              placeholder="e.g. Zohaib Motors"
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <User size={12} /> Father's Name
            </label>
            <Input
              value={formData.fatherName}
              onChange={e => setFormData(prev => ({ ...prev, fatherName: e.target.value }))}
              placeholder="e.g. Muhammad Irfan"
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Phone size={12} /> Phone *
            </label>
            <Input
              value={formData.phone}
              onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="e.g. 03001234567"
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <CreditCard size={12} /> CNIC
            </label>
            <Input
              value={formData.cnic}
              onChange={handleCnicChange}
              placeholder="XXXXX-XXXXXXX-X"
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <MapPin size={12} /> Address
            </label>
            <Input
              value={formData.address}
              onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
              placeholder="Full address"
              className="h-9"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose} className="flex-1 h-9" disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1 h-9 bg-secondary hover:bg-secondary/90 text-white" disabled={loading}>
              {loading ? <><Loader2 size={14} className="animate-spin mr-1" /> Saving...</> : "Save Client"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
