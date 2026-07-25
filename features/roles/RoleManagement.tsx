"use client";

import { useState, useEffect, FormEvent } from "react";
import {
    collection,
    addDoc,
    serverTimestamp,
    doc,
    onSnapshot,
    query,
    orderBy,
    deleteDoc,
    updateDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Trash2, Pencil, X, CheckCircle2, Shield, Lock } from "lucide-react";

interface RoleData {
    id: string;
    name: string;
    permissions: string[]; // List of permission IDs (paths or keys)
    description?: string;
    createdAt: any;
}

const AVAILABLE_PERMISSIONS = [
    { id: 'dashboard', label: 'Dashboard Overview', path: '/dashboard' },
    { id: 'registry', label: 'New Registration', path: '/dashboard/registry' },
    { id: 'inventory', label: 'Inventory', path: '/dashboard/inventory' },
    { id: 'purchase_invoice', label: 'Purchase Invoice', path: '/dashboard/purchase-invoice' },
    { id: 'sale_invoice', label: 'Sale Invoice', path: '/dashboard/sale-invoice' },
    { id: 'status', label: 'Status Panel', path: '/dashboard/status' },
    { id: 'delivery', label: 'Delivery Management', path: '/dashboard/delivery' },
    { id: 'clients', label: 'Client Management', path: '/dashboard/clients' },
    { id: 'investors', label: 'Investor Management', path: '/dashboard/investors' },
    { id: 'banks', label: 'Bank Management', path: '/dashboard/banks' },
    { id: 'accounts', label: 'Accounts Management', path: '/dashboard/accounts' },
    { id: 'account_types', label: 'Account Types Management', path: '/dashboard/account-types' },
    { id: 'cash_voucher', label: 'Cash Voucher Management', path: '/dashboard/cash-voucher' },
    { id: 'general_voucher', label: 'General Voucher Management', path: '/dashboard/general-voucher' },
    { id: 'general_ledger', label: 'General Ledger Management', path: '/dashboard/general-ledger' },
    { id: 'logs', label: 'Activity Logs', path: '/dashboard/logs' },
    { id: 'reports', label: 'Reports', path: '/dashboard/reports' },
    { id: 'settings', label: 'Settings', path: '/dashboard/settings' },
    { id: 'users', label: 'User Management', path: '/dashboard/users' },
    { id: 'roles', label: 'Role Management', path: '/dashboard/roles' },
    { id: 'edit_delivered_vehicle', label: 'Edit Delivered Vehicles', path: 'Action Permission' },
];

export const RoleManagement = () => {
    const { user, userData } = useAuth();
    const [roles, setRoles] = useState<RoleData[]>([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    // Filters
    const [searchTerm, setSearchTerm] = useState("");

    // Editing State
    const [editingRole, setEditingRole] = useState<RoleData | null>(null);
    const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
    const [roleName, setRoleName] = useState("");
    const [roleDescription, setRoleDescription] = useState("");

    // Fetch Roles
    useEffect(() => {
        const q = query(collection(db, "roles"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setRoles(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as RoleData)));
        });
        return () => unsubscribe();
    }, []);

    // Update form state when editing
    useEffect(() => {
        if (editingRole) {
            setRoleName(editingRole.name);
            setRoleDescription(editingRole.description || "");
            setSelectedPermissions(editingRole.permissions || []);
        } else {
            setRoleName("");
            setRoleDescription("");
            setSelectedPermissions([]);
        }
    }, [editingRole]);

    // --- Actions ---

    const togglePermission = (permId: string) => {
        setSelectedPermissions(prev =>
            prev.includes(permId)
                ? prev.filter(p => p !== permId)
                : [...prev, permId]
        );
    };

    const handleCreateRole = async (e: FormEvent) => {
        e.preventDefault();
        if (!user) return;
        if (!roleName.trim()) {
            setMessage("Error: Role name is required");
            return;
        }

        setLoading(true);
        setMessage("");

        try {
            await addDoc(collection(db, "roles"), {
                name: roleName,
                description: roleDescription,
                permissions: selectedPermissions,
                createdAt: serverTimestamp(),
                createdBy: user.uid
            });

            await addDoc(collection(db, "logs"), {
                action: `Created role: ${roleName}`,
                performedBy: user.uid,
                timestamp: serverTimestamp(),
                type: "ADMIN_ACTION"
            });

            setMessage("Success: Role created successfully!");
            setRoleName("");
            setRoleDescription("");
            setSelectedPermissions([]);
        } catch (error: any) {
            console.error(error);
            setMessage(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateRole = async (e: FormEvent) => {
        e.preventDefault();
        if (!editingRole || !user) return;
        setLoading(true);

        try {
            await updateDoc(doc(db, "roles", editingRole.id), {
                name: roleName,
                description: roleDescription,
                permissions: selectedPermissions,
                updatedAt: serverTimestamp()
            });

            await addDoc(collection(db, "logs"), {
                action: `Updated role: ${roleName}`,
                performedBy: user.uid,
                timestamp: serverTimestamp(),
                type: "ADMIN_ACTION"
            });

            setEditingRole(null);
            setMessage("Role updated successfully.");
        } catch (error) {
            console.error(error);
            alert("Failed to update role.");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteRole = async (roleId: string, name: string) => {
        if (!confirm("Are you sure? This will remove the role. Users assigned to this role might lose access.")) return;

        try {
            await deleteDoc(doc(db, "roles", roleId));
            await addDoc(collection(db, "logs"), {
                action: `Deleted role: ${name}`,
                performedBy: user?.uid,
                timestamp: serverTimestamp(),
                type: "ADMIN_ACTION"
            });
        } catch (error) {
            console.error(error);
            alert("Failed to delete role.");
        }
    };

    // --- Filtering ---
    const filteredRoles = roles.filter(r =>
        (r.name || "").toLowerCase().includes((searchTerm || "").toLowerCase())
    );

    const canManageRoles = userData?.role === 'admin' || userData?.role === 'Super Admin' || userData?.permissions?.includes('roles');

    if (!canManageRoles) {
        return (
            <Card className="p-6 text-center text-muted-foreground">
                You do not have permission to view this page.
            </Card>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* LEFT: Roles List */}
            <Card className="lg:col-span-2 flex flex-col h-auto lg:h-[calc(100vh-200px)]">
                <div className="p-4 border-b border-border bg-muted space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-foreground flex items-center gap-2">
                            <Shield size={18} /> Roles Directory
                        </h3>
                        <span className="text-xs text-muted-foreground font-medium bg-card px-2 py-1 rounded border">
                            {filteredRoles.length} Roles
                        </span>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 text-muted-foreground" size={16} />
                        <Input
                            placeholder="Search roles..."
                            className="pl-9 bg-card"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 text-muted-foreground font-medium border-b border-border sticky top-0">
                            <tr>
                                <th className="px-4 py-3">Role Name</th>
                                <th className="px-4 py-3">Permissions</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredRoles.map((r) => (
                                <tr key={r.id} className="hover:bg-muted/50 transition-colors group">
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-foreground">{r.name}</div>
                                        <div className="text-xs text-muted-foreground">{r.description}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-1">
                                            {r.permissions?.slice(0, 3).map(p => (
                                                <Badge key={p} variant="secondary" className="text-[10px]">
                                                    {AVAILABLE_PERMISSIONS.find(ap => ap.id === p)?.label || p}
                                                </Badge>
                                            ))}
                                            {r.permissions && r.permissions.length > 3 && (
                                                <Badge variant="outline" className="text-[10px]">
                                                    +{r.permissions.length - 3} more
                                                </Badge>
                                            )}
                                            {(!r.permissions || r.permissions.length === 0) && (
                                                <span className="text-muted-foreground italic text-xs">No permissions</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setEditingRole(r)}>
                                                <Pencil size={14} className="text-primary" />
                                            </Button>
                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleDeleteRole(r.id, r.name)}>
                                                <Trash2 size={14} className="text-red-500" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredRoles.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="p-8 text-center text-muted-foreground">
                                        No roles found.
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
                        {editingRole ? "Edit Role" : "Create New Role"}
                    </h3>
                    {editingRole && (
                        <Button variant="ghost" size="sm" onClick={() => setEditingRole(null)}>
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

                <form onSubmit={editingRole ? handleUpdateRole : handleCreateRole} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-muted-foreground uppercase">Role Name</label>
                        <Input
                            value={roleName}
                            onChange={e => setRoleName(e.target.value)}
                            required
                            placeholder="e.g. Sales Manager"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-muted-foreground uppercase">Description (Optional)</label>
                        <Input
                            value={roleDescription}
                            onChange={e => setRoleDescription(e.target.value)}
                            placeholder="e.g. Can manage sales and inventory"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-muted-foreground uppercase block mb-2">Permissions</label>
                        <div className="space-y-2 border rounded-md p-3 max-h-60 overflow-y-auto bg-muted">
                            {AVAILABLE_PERMISSIONS.map((perm) => (
                                <label key={perm.id} className="flex items-start gap-2 cursor-pointer hover:bg-muted p-1 rounded">
                                    <input
                                        type="checkbox"
                                        className="mt-1"
                                        checked={selectedPermissions.includes(perm.id)}
                                        onChange={() => togglePermission(perm.id)}
                                    />
                                    <div>
                                        <div className="text-sm font-medium text-foreground">{perm.label}</div>
                                        <div className="text-[10px] text-muted-foreground font-mono">{perm.path}</div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    <Button type="submit" className="w-full bg-slate-900 mt-2" disabled={loading}>
                        {loading ? "Processing..." : (editingRole ? "Update Role" : "Create Role")}
                    </Button>
                </form>
            </Card>
        </div>
    );
};
