"use client";
import { useState, useEffect } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import { Loader2, CheckCircle2, AlertTriangle, User, Phone, Mail, MapPin, CreditCard, Store, ContactRound, FileUp, Link2, Pencil, type LucideIcon } from "lucide-react";
import { uploadFileToStorage } from "@/lib/uploadFile";

interface Client {
  id: string;
  name: string;
  fatherName?: string;
  phone: string;
  email?: string;
  cnic?: string;
  address?: string;
  contactPerson?: string;
  showroomName?: string;
  cnicUploadFile?: string;
  accountId?: string;
}

interface Props {
  client: Client | null;
  onClose: () => void;
}

export function ClientDetailsModal({ client, onClose }: Props) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: "",
    fatherName: "",
    phone: "",
    email: "",
    cnic: "",
    address: "",
    contactPerson: "",
    showroomName: ""
  });
  const [existingCnicUrl, setExistingCnicUrl] = useState("");
  const [cnicFile, setCnicFile] = useState<File | null>(null);
  const [uploadingCnic, setUploadingCnic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (client) {
      setFormData({
        name: client.name || "",
        fatherName: client.fatherName || "",
        phone: client.phone || "",
        email: client.email || "",
        cnic: client.cnic || "",
        address: client.address || "",
        contactPerson: client.contactPerson || "",
        showroomName: client.showroomName || ""
      });
      setExistingCnicUrl(client.cnicUploadFile || "");
      setCnicFile(null);
      setMessage("");
    }
  }, [client]);

  const formatCnic = (val: string) => {
    let digits = val.replace(/\D/g, "");
    if (digits.length > 13) digits = digits.substring(0, 13);
    let formatted = digits;
    if (digits.length > 5) formatted = digits.substring(0, 5) + "-" + digits.substring(5);
    if (digits.length > 12) formatted = formatted.substring(0, 13) + "-" + digits.substring(12);
    return formatted;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !client) return;

    if (!formData.name.trim()) { setMessage("Error: Client name is required."); return; }
    if (!formData.phone.trim()) { setMessage("Error: Phone number is required."); return; }

    const cnicRegex = /^\d{5}-\d{7}-\d{1}$/;
    if (formData.cnic && !cnicRegex.test(formData.cnic)) {
      setMessage("Error: Invalid CNIC format. Use XXXXX-XXXXXXX-X");
      return;
    }

    setSaving(true);
    setMessage("");

    // Upload new CNIC file if selected
    let cnicUploadFile = existingCnicUrl;
    if (cnicFile) {
      try {
        setUploadingCnic(true);
        cnicUploadFile = await uploadFileToStorage(cnicFile, "clients/cnic");
      } catch (error) {
        console.error("CNIC upload failed:", error);
        setMessage("Error: CNIC file upload failed.");
        setSaving(false);
        setUploadingCnic(false);
        return;
      } finally {
        setUploadingCnic(false);
      }
    }

    try {
      await updateDoc(doc(db, "clients", client.id), {
        name: formData.name.trim(),
        fatherName: formData.fatherName.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        cnic: formData.cnic.trim(),
        address: formData.address.trim(),
        contactPerson: formData.contactPerson.trim(),
        showroomName: formData.showroomName.trim(),
        ...(cnicUploadFile !== undefined && { cnicUploadFile }),
        updatedBy: user.uid,
        updatedAt: serverTimestamp()
      });

      // Sync linked account name if name/phone changed
      if (client.accountId) {
        const cleanPhone = formData.phone.replace(/\D/g, "");
        const lastFour = cleanPhone.slice(-4) || "0000";
        await updateDoc(doc(db, "accounts", client.accountId), {
          name: `${formData.name.trim()} (${lastFour})`,
          updatedBy: user.uid,
          updatedAt: serverTimestamp()
        });
      }

      setMessage("Success: Client details updated!");
      setTimeout(() => onClose(), 700);
    } catch (err) {
      console.error("Error updating client:", err);
      setMessage(`Error: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const Field = ({ label, value, onChange, placeholder, required, type = "text", icon: Icon }: {
    label: string; value: string; onChange: (v: string) => void; placeholder?: string;
    required?: boolean; type?: string; icon?: LucideIcon;
  }) => (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
        {Icon && <Icon size={12} />} {label} {required && <span className="text-red-500">*</span>}
      </label>
      <Input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9"
      />
    </div>
  );

  return (
    <Dialog open={!!client} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil size={18} className="text-primary" />
            Edit Client Details
          </DialogTitle>
          <DialogDescription>
            Update {client?.name || "client"}&apos;s information. All fields are editable.
          </DialogDescription>
        </DialogHeader>

        {message && (
          <div className={`p-3 rounded-lg text-sm font-medium flex items-center gap-2 ${
            message.startsWith("Error")
              ? "bg-red-50 text-red-700 border border-red-100"
              : "bg-green-50 text-green-700 border border-green-100"
          }`}>
            {!message.startsWith("Error") ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="Full Name" required icon={User} value={formData.name} onChange={v => setFormData(prev => ({ ...prev, name: v }))} placeholder="e.g. Ali Khan" />
          <Field label="Father Name" icon={User} value={formData.fatherName} onChange={v => setFormData(prev => ({ ...prev, fatherName: v }))} placeholder="e.g. Ahmed Khan" />
          <Field label="Contact Person Name" icon={ContactRound} value={formData.contactPerson} onChange={v => setFormData(prev => ({ ...prev, contactPerson: v }))} placeholder="e.g. Sara Khan" />
          <Field label="Phone Number" required icon={Phone} value={formData.phone} onChange={v => setFormData(prev => ({ ...prev, phone: v }))} placeholder="+92 300..." />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Email" icon={Mail} value={formData.email} onChange={v => setFormData(prev => ({ ...prev, email: v }))} placeholder="Optional" type="email" />
            <Field label="CNIC / ID" icon={CreditCard} value={formData.cnic} onChange={v => setFormData(prev => ({ ...prev, cnic: formatCnic(v) }))} placeholder="XXXXX-XXXXXXX-X" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <FileUp size={12} /> Upload CNIC (Image / PDF)
            </label>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={e => setCnicFile(e.target.files?.[0] || null)}
              className="block w-full text-xs text-muted-foreground file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-muted file:text-foreground hover:file:bg-muted/80"
            />
            {uploadingCnic && (
              <p className="text-xs text-primary flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Uploading CNIC...</p>
            )}
            {existingCnicUrl && !cnicFile && (
              <a href={existingCnicUrl} target="_blank" rel="noreferrer" className="text-xs text-primary flex items-center gap-1 hover:underline">
                <Link2 size={12} /> View uploaded CNIC file
              </a>
            )}
            {cnicFile && (
              <p className="text-xs text-muted-foreground">Selected: {cnicFile.name}</p>
            )}
          </div>

          <Field label="Address" icon={MapPin} value={formData.address} onChange={v => setFormData(prev => ({ ...prev, address: v }))} placeholder="City, Area..." />
          <Field label="Showroom Name" icon={Store} value={formData.showroomName} onChange={v => setFormData(prev => ({ ...prev, showroomName: v }))} placeholder="e.g. Zohaib Motors" />

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-9" disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1 h-9 bg-secondary hover:bg-secondary/90 text-white" disabled={saving}>
              {saving ? <><Loader2 size={14} className="animate-spin mr-1" /> Saving...</> : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}