"use client";
import { useState, useEffect, FormEvent } from "react";
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp, getDocs, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search, Plus, Pencil, Trash2, Layers, X, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

interface AccountType {
  id: string;
  name: string;
  requireNumberInfo: boolean;
  createdAt: any;
}
export const AccountTypesManager = () => {
  const { user } = useAuth();
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [typeToDelete, setTypeToDelete] = useState<{id: string, name: string} | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    requireNumberInfo: false
  });

  // Fetch Account Types
  useEffect(() => {
    const q = query(collection(db, "account-types"), orderBy("name"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAccountTypes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AccountType)));
    });
    return () => unsubscribe();
  }, []);

  const resetForm = () => {
    setFormData({ name: "", requireNumberInfo: false });
    setIsEditing(null);
    setMessage("");
  };

  const handleEdit = (type: AccountType) => {
    setFormData({
      name: type.name,
      requireNumberInfo: type.requireNumberInfo ?? false
    });
    setIsEditing(type.id);
    setMessage("");
  };

  const confirmDelete = (id: string, name: string) => {
    setTypeToDelete({ id, name });
    setDeleteDialogOpen(true);
  };

  const executeDelete = async () => {
    if (!typeToDelete) return;
    
    try {
      await deleteDoc(doc(db, "account-types", typeToDelete.id));
      
      // Log activity
      if (user) {
        await addDoc(collection(db, "logs"), {
          action: `Deleted account type: ${typeToDelete.name}`,
          performedBy: user.uid,
          timestamp: serverTimestamp(),
          type: "ADMIN_ACTION"
        });
      }
      
      setMessage("Success: Account type deleted successfully.");
    } catch (error: any) {
      console.error("Error deleting account type:", error);
      setMessage(`Error: ${error.message}`);
    } finally {
      setDeleteDialogOpen(false);
      setTypeToDelete(null);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.name.trim()) {
      setMessage("Error: Name is required");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const payload = {
        name: formData.name.trim(),
        requireNumberInfo: formData.requireNumberInfo,
        updatedBy: user.uid,
        updatedAt: serverTimestamp()
      };

      if (isEditing) {
        await updateDoc(doc(db, "account-types", isEditing), payload);
        
        await addDoc(collection(db, "logs"), {
          action: `Updated account type: ${formData.name}`,
          performedBy: user.uid,
          timestamp: serverTimestamp(),
          type: "ADMIN_ACTION"
        });

        setMessage("Success: Account type updated successfully.");
      } else {
        // Check for duplicate names
        const duplicate = accountTypes.find(t => t.name.toLowerCase() === formData.name.trim().toLowerCase());
        if (duplicate) {
          setMessage("Error: An account type with this name already exists.");
          setLoading(false);
          return;
        }

        await addDoc(collection(db, "account-types"), {
          ...payload,
          createdBy: user.uid,
          createdAt: serverTimestamp()
        });

        await addDoc(collection(db, "logs"), {
          action: `Created account type: ${formData.name}`,
          performedBy: user.uid,
          timestamp: serverTimestamp(),
          type: "ADMIN_ACTION"
        });

        setMessage("Success: Account type created successfully.");
      }
      resetForm();
    } catch (error: any) {
      console.error("Error saving account type:", error);
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredTypes = accountTypes.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-auto">
      {/* Left: Form */}
      <Card className="p-6 h-fit">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">{isEditing ? "Edit Account Type" : "Add New Account Type"}</h3>
          {isEditing && (
            <Button variant="ghost" size="sm" onClick={resetForm} className="h-8 w-8 p-0">
              <X size={16} />
            </Button>
          )}
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded text-xs font-medium flex items-center gap-2 ${message.includes('Error') ? 'bg-red-50 text-red-700' : message.includes('Note') ? 'bg-muted text-amber-700' : 'bg-green-50 text-green-700'}`}>
            {(!message.includes('Error') && !message.includes('Note')) && <CheckCircle2 size={14} />}
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <Layers size={12} /> Account Type Name *
            </label>
            <Input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Cash in hand, Bank, Investor" />
          </div>

          <div
            className="flex items-center gap-3 bg-muted border border-border p-3 rounded-lg cursor-pointer hover:bg-muted transition-colors"
            onClick={() => setFormData(prev => ({ ...prev, requireNumberInfo: !prev.requireNumberInfo }))}
          >
            <div className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out ${formData.requireNumberInfo ? 'bg-secondary' : 'bg-slate-300'}`}>
              <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-card shadow ring-0 transition duration-200 ease-in-out ${formData.requireNumberInfo ? 'translate-x-4' : 'translate-x-1'}`} />
            </div>
            <label className="text-sm font-medium text-foreground cursor-pointer select-none">
              Require Number Information
            </label>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1 bg-slate-900" disabled={loading}>
              {isEditing ? "Update Type" : "Add Type"}
            </Button>
          </div>
        </form>
      </Card>

      {/* Right: List */}
      <Card className="lg:col-span-2 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-border bg-muted flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 text-muted-foreground" size={16} />
            <Input
              className="pl-9 bg-card"
              placeholder="Search by name or description..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="text-xs text-muted-foreground font-medium px-2 shrink-0">
            {filteredTypes.length} Types
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px]">
          {filteredTypes.map(type => (
            <div key={type.id} className="group flex items-center justify-between p-4 bg-card border border-border rounded-xl hover:border-blue-200 hover:shadow-sm transition-all">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-bold">
                  {type.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">
                    {type.name}
                  </h4>
                  {type.requireNumberInfo && (
                    <span className="text-[10px] bg-muted text-primary font-semibold px-1.5 py-0.5 rounded mt-0.5 inline-block">
                      Requires Number Info
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="sm" onClick={() => handleEdit(type)} title="Edit">
                  <Pencil size={16} className="text-primary" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => confirmDelete(type.id, type.name)} title="Delete">
                  <Trash2 size={16} className="text-red-500" />
                </Button>
              </div>
            </div>
          ))}

          {filteredTypes.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p>No account types found.</p>
            </div>
          )}
        </div>
      </Card>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Account Type</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the account type "{typeToDelete?.name}"? Accounts currently using this type may experience issues. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={executeDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
