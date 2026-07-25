"use client";
import { useState, useEffect, FormEvent, useRef } from "react";
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp, getDocs, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search, Pencil, Trash2, User, Phone, Mail, MapPin, CreditCard, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { InvestorAssetsModal } from "./InvestorAssetsModal";
import { SignatureCapture, SignatureCaptureRef } from "@/components/SignatureCapture";
import { uploadToImgBB } from "@/lib/imgbbUpload";

interface Investor {
  id: string;
  name: string;
  fatherName?: string;
  phone: string;
  email?: string;
  cnic?: string; // National ID
  address?: string;
  assets?: string[];
  signatureUrl?: string; // Signature image URL
  accountId?: string; // Associated auto-created cash account ID
}

export const InvestorManager = () => {
  const { user } = useAuth();
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [assetsInvestor, setAssetsInvestor] = useState<Investor | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    fatherName: "",
    phone: "",
    email: "",
    cnic: "",
    address: ""
  });

  // Signature State
  const signatureRef = useRef<SignatureCaptureRef | null>(null);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const [editingInvestorSignature, setEditingInvestorSignature] = useState<string | undefined>();

  // Fetch Investors
  useEffect(() => {
    const q = query(collection(db, "investors"), orderBy("name"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setInvestors(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Investor)));
      setDataLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const resetForm = () => {
    setFormData({ name: "", fatherName: "", phone: "", email: "", cnic: "", address: "" });
    setIsEditing(null);
    setEditingInvestorSignature(undefined);
    signatureRef.current?.clear();
  };

  const handleEdit = (investor: Investor) => {
    setFormData({
      name: investor.name,
      fatherName: investor.fatherName || "",
      phone: investor.phone,
      email: investor.email || "",
      cnic: investor.cnic || "",
      address: investor.address || ""
    });
    setIsEditing(investor.id);
    setEditingInvestorSignature(investor.signatureUrl);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure? This will remove the investor from the database.")) {
      await deleteDoc(doc(db, "investors", id));
    }
  };

  // CNIC Auto-Formatting
  const handleCnicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, ''); // Remove non-digits
    if (val.length > 13) val = val.substring(0, 13); // Limit to 13 digits

    let formatted = val;
    if (val.length > 5) {
      formatted = val.substring(0, 5) + "-" + val.substring(5);
    }
    if (val.length > 12) {
      formatted = formatted.substring(0, 13) + "-" + val.substring(12);
    }

    setFormData({ ...formData, cnic: formatted });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);

    // CNIC Validation
    const cnicRegex = /^\d{5}-\d{7}-\d{1}$/;
    if (formData.cnic && !cnicRegex.test(formData.cnic)) {
      alert("Invalid CNIC format. Please use XXXXX-XXXXXXX-X");
      return;
    }

    // Handle signature upload
    let signatureUrl = editingInvestorSignature;
    if (signatureRef.current && !signatureRef.current.isEmpty()) {
      try {
        setUploadingSignature(true);
        const signatureData = signatureRef.current.getSignatureDataURL();
        if (signatureData) {
          signatureUrl = await uploadToImgBB(signatureData);
        }
      } catch (error) {
        console.error("Signature upload failed:", error);
        alert("Warning: Investor saved but signature upload failed.");
      } finally {
        setUploadingSignature(false);
      }
    }

    const payload = {
      ...formData,
      ...(signatureUrl !== undefined && { signatureUrl }),
      updatedBy: user.uid,
      updatedAt: serverTimestamp()
    };

    try {
      if (isEditing) {
        await updateDoc(doc(db, "investors", isEditing), payload);

        // Sync account name if they update the investor
        const currentInvestor = investors.find(i => i.id === isEditing);
        if (currentInvestor?.accountId) {
          const cleanPhone = formData.phone.replace(/\D/g, '');
          const lastFour = cleanPhone.slice(-4) || '0000';
          const newAccountName = `${formData.name.trim()} (${lastFour})`;

          await updateDoc(doc(db, "accounts", currentInvestor.accountId), {
            name: newAccountName,
            updatedBy: user.uid,
            updatedAt: serverTimestamp()
          });
        }
      } else {
        // Find or create "Investor" Account Type
        let investorTypeId = "";
        const qTypes = query(collection(db, "account-types"), where("name", "==", "Investor"));
        const snapshotTypes = await getDocs(qTypes);
        if (!snapshotTypes.empty) {
          investorTypeId = snapshotTypes.docs[0].id;
        } else {
          // Create "Investor" Account Type dynamically if it doesn't exist
          const typeRef = await addDoc(collection(db, "account-types"), {
            name: "Investor",
            description: "Accounts for Investor deposits and distributions",
            createdAt: serverTimestamp(),
            createdBy: user.uid
          });
          investorTypeId = typeRef.id;
        }

        // Generate unique account name using last 4 digits of phone
        const cleanPhone = formData.phone.replace(/\D/g, '');
        const lastFour = cleanPhone.slice(-4) || '0000';
        const accountName = `${formData.name.trim()} (${lastFour})`;

        // Check if an account with this name already exists
        let accountId = "";
        const qAccs = query(collection(db, "accounts"), where("name", "==", accountName));
        const snapshotAccs = await getDocs(qAccs);

        if (!snapshotAccs.empty) {
          accountId = snapshotAccs.docs[0].id;
        } else {
          // Create new account under "Investor" Account Type
          const accRef = await addDoc(collection(db, "accounts"), {
            name: accountName,
            typeId: investorTypeId,
            typeName: "Investor",
            balance: 0,
            description: `Auto-created account for investor: ${formData.name}`,
            createdAt: serverTimestamp(),
            createdBy: user.uid,
            updatedAt: serverTimestamp(),
            updatedBy: user.uid
          });
          accountId = accRef.id;

          // Add creation logs
          await addDoc(collection(db, "logs"), {
            action: `Created account: ${accountName} (Investor) - Auto-created from Investor profile`,
            performedBy: user.uid,
            timestamp: serverTimestamp(),
            type: "ADMIN_ACTION"
          });
        }

        await addDoc(collection(db, "investors"), {
          ...payload,
          accountId,
          createdBy: user.uid,
          createdAt: serverTimestamp()
        });
      }
      resetForm();
    } catch (error) {
      console.error("Error saving investor:", error);
      alert("Failed to save investor.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredInvestors = investors.filter(i =>
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.phone.includes(searchTerm)
  );

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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-auto lg:h-[calc(100vh-200px)]">
      {/* Left: Form */}
      <Card className="p-6 h-fit">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">{isEditing ? "Edit Investor" : "Add New Investor"}</h3>
          {isEditing && (
            <Button variant="ghost" size="sm" onClick={resetForm} className="h-8 w-8 p-0">
              <X size={16} />
            </Button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <User size={12} /> Full Name *
            </label>
            <Input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Ali Khan" />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <User size={12} /> Father Name
            </label>
            <Input value={formData.fatherName} onChange={e => setFormData({ ...formData, fatherName: e.target.value })} placeholder="e.g. Ahmed Khan" />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <Phone size={12} /> Phone Number *
            </label>
            <Input required value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="+92 300..." />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                <Mail size={12} /> Email
              </label>
              <Input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="Optional" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                <CreditCard size={12} /> CNIC / ID
              </label>
              <Input value={formData.cnic} onChange={handleCnicChange} placeholder="43304-9667654-9" maxLength={15} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <MapPin size={12} /> Address
            </label>
            <Input value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="City, Area..." />
          </div>

          <div className="pt-4 border-t border-border">
            <SignatureCapture
              ref={signatureRef}
              existingSignature={editingInvestorSignature}
              label="Investor Signature (Optional)"
            />
            {uploadingSignature && (
              <p className="text-xs text-primary mt-2">Uploading signature...</p>
            )}
          </div>

          <Button type="submit" className="w-full bg-slate-900" disabled={uploadingSignature || isSubmitting}>
            {(uploadingSignature || isSubmitting) ? (
              <><Loader2 size={16} className="mr-2 animate-spin" /> {isEditing ? "Updating..." : "Adding..."}</>
            ) : (
              isEditing ? "Update Investor" : "Add Investor"
            )}
          </Button>
        </form>
      </Card>

      {/* Right: List */}
      <Card className="lg:col-span-2 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-border bg-muted flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 text-muted-foreground" size={16} />
            <Input
              className="pl-9 bg-card"
              placeholder="Search by name or phone..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="text-xs text-muted-foreground font-medium px-2">
            {filteredInvestors.length} Investors
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredInvestors.map(investor => (
            <div key={investor.id} className="group flex items-center justify-between p-4 bg-card border border-border rounded-xl hover:border-blue-200 hover:shadow-sm transition-all">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-bold">
                  {investor.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">
                    {investor.name}
                    {investor.fatherName && <span className="text-xs font-normal text-muted-foreground ml-1">s/o {investor.fatherName}</span>}
                  </h4>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1"><Phone size={10} /> {investor.phone}</span>
                    {investor.address && <span className="flex items-center gap-1 border-l pl-3 border-border"><MapPin size={10} /> {investor.address}</span>}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="sm" onClick={() => setAssetsInvestor(investor)} title="Assets">
                  <ImageIcon size={16} className="text-primary" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleEdit(investor)} title="Edit">
                  <Pencil size={16} className="text-primary" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(investor.id)} title="Delete">
                  <Trash2 size={16} className="text-red-500" />
                </Button>
              </div>
            </div>
          ))}

          {filteredInvestors.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p>No investors found matching &quot;{searchTerm}&quot;</p>
            </div>
          )}
        </div>
      </Card>

      {/* Assets Modal */}
      <InvestorAssetsModal
        isOpen={!!assetsInvestor}
        onClose={() => setAssetsInvestor(null)}
        investor={assetsInvestor}
      />
    </div>
  );
};
