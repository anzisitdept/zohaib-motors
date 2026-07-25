"use client";

import { useState, useEffect, FormEvent, useRef } from "react";
import {
  collection,
  addDoc,
  serverTimestamp,
  setDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  deleteDoc,
  updateDoc,
  getDocs
} from "firebase/firestore";
import { initializeApp, getApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Search, Trash2, Pencil, X, CheckCircle2, UserCog, Filter } from "lucide-react";
import { SignatureCapture, SignatureCaptureRef } from "@/components/SignatureCapture";
import { uploadToImgBB } from "@/lib/imgbbUpload";

// Re-use config for secondary app (creation only)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

interface UserData {
  id: string;
  email: string;
  name: string;
  role: string;
  roleId?: string; // Link to roles collection
  signatureUrl?: string; // Signature image URL
  createdAt: any;
}

interface RoleData {
  id: string;
  name: string;
}

export const UserManagement = () => {
  const { user, userData } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [availableRoles, setAvailableRoles] = useState<RoleData[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");

  // Editing State
  const [editingUser, setEditingUser] = useState<UserData | null>(null);

  // Signature State
  const signatureRef = useRef<SignatureCaptureRef | null>(null);
  const [uploadingSignature, setUploadingSignature] = useState(false);

  // Fetch Users and Roles
  useEffect(() => {
    const qUsers = query(collection(db, "users"), orderBy("createdAt", "desc"));
    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      setUsers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as UserData)));
    });

    const qRoles = query(collection(db, "roles"), orderBy("name", "asc"));
    const unsubRoles = onSnapshot(qRoles, (snapshot) => {
      setAvailableRoles(snapshot.docs.map(d => ({ id: d.id, name: d.data().name } as RoleData)));
    });

    return () => {
      unsubUsers();
      unsubRoles();
    };
  }, []);

  // --- Actions ---

  const handleCreateUser = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setMessage("");

    const form = e.currentTarget;
    const formData = new FormData(form);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const roleId = formData.get("role") as string; // This is the ID now
    const name = formData.get("name") as string;

    // Find role name from ID
    const selectedRole = availableRoles.find(r => r.id === roleId);
    const roleName = selectedRole ? selectedRole.name : "Manager"; // Fallback

    // Handle signature upload
    let signatureUrl: string | undefined;
    if (signatureRef.current && !signatureRef.current.isEmpty()) {
      try {
        setUploadingSignature(true);
        const signatureData = signatureRef.current.getSignatureDataURL();
        if (signatureData) {
          signatureUrl = await uploadToImgBB(signatureData);
        }
      } catch (error) {
        console.error("Signature upload failed:", error);
        setMessage("Warning: User created but signature upload failed.");
      } finally {
        setUploadingSignature(false);
      }
    }

    // 1. Setup Secondary App to avoid logging out the Admin
    const secondaryAppName = "secondaryApp";
    let secondaryApp;
    try {
      secondaryApp = getApp(secondaryAppName);
    } catch (e) {
      secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
    }
    const secondaryAuth = getAuth(secondaryApp);

    try {
      // 2. Create User in Auth
      const userCred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const newUserUid = userCred.user.uid;

      // 3. Create User Document in Firestore
      await setDoc(doc(db, "users", newUserUid), {
        email,
        role: roleName,
        roleId: roleId,
        name,
        ...(signatureUrl ? { signatureUrl } : {}),
        createdAt: serverTimestamp(),
        createdBy: user.uid
      });

      // 4. Log Action
      await addDoc(collection(db, "logs"), {
        action: `Created user: ${email}`,
        details: `Role: ${roleName}`,
        performedBy: user.uid, // Fixed: removed optional chaining as user is checked at start
        timestamp: serverTimestamp(),
        type: "ADMIN_ACTION"
      });

      await signOut(secondaryAuth);
      setMessage("Success: User created successfully!");
      form.reset();
      signatureRef.current?.clear();
    } catch (error: any) {
      console.error(error);
      setMessage(`Error: ${error.message}`);
    } finally {
      if (secondaryApp) deleteApp(secondaryApp).catch(console.error);
      setLoading(false);
    }
  };

  const handleUpdateUser = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingUser || !user) return;
    setLoading(true);

    try {
      const form = e.currentTarget;
      const formData = new FormData(form);
      const roleId = formData.get("role") as string;
      const selectedRole = availableRoles.find(r => r.id === roleId);
      const roleName = selectedRole ? selectedRole.name : editingUser.role;

      // Handle signature upload if changed
      let signatureUrl = editingUser.signatureUrl;
      if (signatureRef.current && !signatureRef.current.isEmpty()) {
        try {
          setUploadingSignature(true);
          const signatureData = signatureRef.current.getSignatureDataURL();
          if (signatureData) {
            signatureUrl = await uploadToImgBB(signatureData);
          }
        } catch (error) {
          console.error("Signature upload failed:", error);
        } finally {
          setUploadingSignature(false);
        }
      }

      await updateDoc(doc(db, "users", editingUser.id), {
        name: formData.get("name"),
        role: roleName,
        roleId: roleId,
        ...(signatureUrl ? { signatureUrl } : {}),
        updatedAt: serverTimestamp()
      });

      await addDoc(collection(db, "logs"), {
        action: `Updated user: ${editingUser.email}`,
        performedBy: user.uid,
        timestamp: serverTimestamp(),
        type: "ADMIN_ACTION"
      });

      setEditingUser(null);
      setMessage("User updated successfully.");
    } catch (error) {
      console.error(error);
      alert("Failed to update user.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (targetUserId: string, targetEmail: string) => {
    if (!confirm("Are you sure? This removes their database record and access, but the account technically remains in Auth until manually removed.")) return;

    try {
      await deleteDoc(doc(db, "users", targetUserId));
      await addDoc(collection(db, "logs"), {
        action: `Deleted user record: ${targetEmail}`,
        performedBy: user?.uid,
        timestamp: serverTimestamp(),
        type: "ADMIN_ACTION"
      });
    } catch (error) {
      console.error(error);
      alert("Failed to delete user.");
    }
  };

  // --- Filtering ---
  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "ALL" || u.role === roleFilter || u.roleId === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Check if current user has permission to manage users
  const canManageUsers = userData?.role === 'admin' || userData?.role === 'Super Admin' || (userData?.permissions && userData.permissions.includes('users'));

  if (!canManageUsers) {
    return (
      <Card className="p-6 text-center text-muted-foreground">
        You do not have permission to view this page.
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

      {/* LEFT: User List */}
      <Card className="lg:col-span-2 flex flex-col h-[calc(100vh-200px)]">
        <div className="p-4 border-b border-border bg-muted space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <UserCog size={18} /> Staff Directory
            </h3>
            <span className="text-xs text-muted-foreground font-medium bg-card px-2 py-1 rounded border">
              {filteredUsers.length} Users
            </span>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 text-muted-foreground" size={16} />
              <Input
                placeholder="Search by name or email..."
                className="pl-9 bg-card"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[130px] bg-card">
                <div className="flex items-center gap-2">
                  <Filter size={14} className="text-muted-foreground" />
                  <SelectValue placeholder="Role" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Roles</SelectItem>
                {availableRoles.map(r => (
                  <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground font-medium border-b border-border sticky top-0">
              <tr>
                <th className="px-4 py-3">User Details</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-muted/50 transition-colors group">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{u.name || "Unnamed"}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={u.role === 'admin' ? 'default' : 'secondary'} className="uppercase text-[10px]">
                      {u.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {u.createdAt?.seconds ? new Date(u.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setEditingUser(u)}>
                        <Pencil size={14} className="text-primary" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleDeleteUser(u.id, u.email)}>
                        <Trash2 size={14} className="text-red-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-muted-foreground">
                    No users found matching filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* RIGHT: Create / Edit Form */}
      <Card className="p-6 h-fit sticky top-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-lg">
            {editingUser ? "Edit User" : "Add New User"}
          </h3>
          {editingUser && (
            <Button variant="ghost" size="sm" onClick={() => setEditingUser(null)}>
              <X size={16} /> Cancel
            </Button>
          )}
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded text-xs font-medium flex items-center gap-2 ${message.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {!message.includes('Error') && <CheckCircle2 size={14} />}
            {message}
          </div>
        )}

        <form onSubmit={editingUser ? handleUpdateUser : handleCreateUser} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase">Full Name</label>
            <Input
              name="name"
              required
              placeholder="e.g. Nadeem AHmed.."
              defaultValue={editingUser?.name || ""}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase">Email Address</label>
            <Input
              name="email"
              type="email"
              required
              placeholder="user@caruzen.com"
              defaultValue={editingUser?.email || ""}
              disabled={!!editingUser} // Email cannot be changed here easily
              className={editingUser ? "bg-muted text-muted-foreground cursor-not-allowed" : ""}
            />
          </div>

          {!editingUser && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase">Password</label>
              <Input name="password" type="password" required minLength={6} placeholder="******" />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase">Access Role</label>
            <Select name="role" defaultValue={editingUser?.roleId || (availableRoles.find(r => r.name === editingUser?.role)?.id) || ""}>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.length === 0 && <SelectItem value="disabled" disabled>No roles created</SelectItem>}
                {availableRoles.map(role => (
                  <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              Create more roles in Role Management
            </p>
          </div>

          <div className="pt-4 border-t border-border">
            <SignatureCapture
              ref={signatureRef}
              existingSignature={editingUser?.signatureUrl}
              label="User Signature (Optional)"
            />
            {uploadingSignature && (
              <p className="text-xs text-primary mt-2">Uploading signature...</p>
            )}
          </div>

          <Button type="submit" className="w-full bg-slate-900 mt-2" disabled={loading || uploadingSignature}>
            {loading ? "Processing..." : (editingUser ? "Update User" : "Create Account")}
          </Button>
        </form>
      </Card>
    </div>
  );
};