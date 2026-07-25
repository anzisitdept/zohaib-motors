"use client";
import { useState, useEffect } from "react";
import { doc, updateDoc, collection, query, orderBy, onSnapshot, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pencil, X, Save, Car, Settings2, User, FileText, CreditCard, LayoutGrid } from "lucide-react";
import { addToHistory } from "@/utils/vehicleHistory";
import { useAuth } from "@/context/AuthContext";
import { ClientSelector } from "@/features/registry/ClientSelector";

interface EditVehicleModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicle: any;
}

// Helper for fetching collections
const useCollection = (collectionName: string) => {
  const [data, setData] = useState<any[]>([]);
  useEffect(() => {
    const q = query(collection(db, collectionName), orderBy("name"));
    const unsub = onSnapshot(q, (snap) => {
      setData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [collectionName]);
  return data;
};

export const EditVehicleModal = ({ isOpen, onClose, vehicle }: EditVehicleModalProps) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("identity");

  // --- Fetch Config Data ---
  const brands = useCollection("brands");
  const colors = useCollection("settings_colors");
  const fuelTypes = useCollection("settings_fuel");
  const transmissions = useCollection("settings_transmission");
  const bodyTypes = useCollection("settings_body");
  const driveTypes = useCollection("settings_drive");
  const vehicleCCs = useCollection("settings_cc");

  // Clients & Models
  const [clients, setClients] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [availableVariants, setAvailableVariants] = useState<string[]>([]);

  // Init Data
  useEffect(() => {
    if (!isOpen || !vehicle) return;

    // Derive initial platesAvailable state for legacy records if missing
    let initialPlatesAvailable = vehicle.platesAvailable;
    let initialUnavailableReason = vehicle.plateUnavailableReason || "Not Issued from Excise";

    if (initialPlatesAvailable === undefined) {
      // Legacy logic: if plateStatus is "Showroom", then available.
      // If "Not Issued..." or "At Party...", then unavailable.
      if (vehicle.plateStatus === "Showroom") {
        initialPlatesAvailable = true;
      } else if (vehicle.plateStatus === "Not Issued from Excise" || vehicle.plateStatus === "At Party's Hand") {
        initialPlatesAvailable = false;
        initialUnavailableReason = vehicle.plateStatus;
      } else {
        // Default fallbacks for other statuses (e.g. Delivered) - preserve existing or default to true?
        // Let's assume true unless explicitly one of the unavailable ones?
        // Or if it was "Not Applied" (old logic), maybe map to something?
        // Let's stick to simple derivation:
        initialPlatesAvailable = vehicle.plateStatus === "Showroom";
      }
    }

    setFormData({
      ...vehicle,
      platesAvailable: initialPlatesAvailable,
      plateUnavailableReason: initialUnavailableReason
    });
  }, [isOpen, vehicle]);

  // Fetch Clients
  useEffect(() => {
    if (!isOpen) return;
    const unsub = onSnapshot(query(collection(db, "clients"), orderBy("name")), (snap) => {
      setClients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [isOpen]);

  // Fetch Models based on selected Brand
  useEffect(() => {
    if (!formData.brandId) {
      setModels([]);
      return;
    }
    const q = query(collection(db, "models"), where("brandId", "==", formData.brandId));
    const unsub = onSnapshot(q, (snap) => {
      setModels(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [formData.brandId]);

  // Update Variants when Model changes
  useEffect(() => {
    const selectedModel = models.find(m => m.name === formData.model);
    setAvailableVariants(selectedModel?.variants || []);
  }, [formData.model, models]);

  if (!isOpen) return null;

  // --- Handlers ---

  const handleChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleBrandChange = (brandId: string) => {
    const brand = brands.find(b => b.id === brandId);
    setFormData((prev: any) => ({
      ...prev,
      brandId,
      brandName: brand?.name || "",
      model: "", // Reset model
      variant: "" // Reset variant
    }));
  };

  const handleClientChange = (type: 'POSSESSION' | 'DOCS', clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    if (type === 'POSSESSION') {
      setFormData((prev: any) => ({
        ...prev,
        ownerId: client.id,
        ownerName: client.name,
        ownerContact: client.phone
      }));
    } else {
      setFormData((prev: any) => ({
        ...prev,
        registeredOwnerId: client.id,
        registeredOwnerName: client.name,
        registeredOwnerContact: client.phone
      }));
    }
  };

  const handleClearOwner = (type: 'POSSESSION' | 'DOCS') => {
    if (type === 'POSSESSION') {
      setFormData((prev: any) => ({
        ...prev,
        ownerId: null,
        ownerName: "",
        ownerContact: ""
      }));
    } else {
      setFormData((prev: any) => ({
        ...prev,
        registeredOwnerId: null,
        registeredOwnerName: "",
        registeredOwnerContact: ""
      }));
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Check if plates are already delivered - if so, preserve the status
      const isPlateDelivered = vehicle.plateStatus?.toLowerCase().includes("delivered");

      // Determine plate status based on switch (only if not already delivered)
      const finalPlateStatus = isPlateDelivered
        ? vehicle.plateStatus // Preserve original delivered status
        : (formData.platesAvailable
          ? "Showroom"
          : formData.plateUnavailableReason);

      const finalPlatesAvailable = isPlateDelivered
        ? vehicle.platesAvailable // Preserve original value
        : formData.platesAvailable;

      await updateDoc(doc(db, "cars", vehicle.id), {
        ...formData,
        // Ensure numeric fields are numbers
        year: Number(formData.year),
        modelYear: Number(formData.modelYear) || Number(formData.year),
        registrationYear: Number(formData.registrationYear) || null,
        mileage: Number(formData.mileage) || 0,

        // Apply plate status logic (preserve if delivered)
        platesAvailable: finalPlatesAvailable,
        plateStatus: finalPlateStatus,

        // Registered Owner (Text Fields always, no ID linking)
        registeredOwnerId: null,
        registeredOwnerName: formData.registeredOwnerName || "",
        registeredOwnerCnic: formData.registeredOwnerCnic || "",
      });

      // Add to History
      if (user) {
        await addToHistory(
          vehicle.id,
          "Edited Vehicle",
          "Updated vehicle details and specifications",
          user.uid
        );
      }

      onClose();
    } catch (error) {
      console.error(error);
      alert("Failed to update vehicle record");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-4xl bg-card max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center bg-muted shrink-0">
          <div className="flex items-center gap-2">
            <Pencil size={18} className="text-primary" />
            <h3 className="font-bold text-lg text-foreground">Edit Vehicle Record</h3>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X size={18} /></Button>
        </div>

        {/* Content Wrapper */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-6 grid w-full grid-cols-4 bg-muted p-1">
              <TabsTrigger value="identity" className="gap-2"><Car size={14} /> Identity</TabsTrigger>
              <TabsTrigger value="specs" className="gap-2"><Settings2 size={14} /> Specs</TabsTrigger>
              <TabsTrigger value="ownership" className="gap-2"><User size={14} /> Ownership</TabsTrigger>
              <TabsTrigger value="settings" className="gap-2"><LayoutGrid size={14} /> Settings</TabsTrigger>
            </TabsList>

            {/* 1. Identity TAB */}
            <TabsContent value="identity" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Brand</label>
                  <Select value={formData.brandId} onValueChange={handleBrandChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{brands.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Model</label>
                  <Select value={formData.model} onValueChange={(val) => handleChange("model", val)} disabled={!formData.brandId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{models.map(m => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Variant</label>
                  {availableVariants.length > 0 ? (
                    <Select value={formData.variant} onValueChange={(val) => handleChange("variant", val)}>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>{availableVariants.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : (
                    <Input value={formData.variant || ""} onChange={e => handleChange("variant", e.target.value)} />
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Vehicle Source</label>
                  <Select value={formData.vehicleSource || "Local"} onValueChange={(v) => handleChange("vehicleSource", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Local">Local</SelectItem>
                      <SelectItem value="Imported">Imported</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Chassis No.</label>
                  <Input value={formData.chassisNumber || ""} onChange={e => handleChange("chassisNumber", e.target.value)} className="font-mono uppercase" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Engine No.</label>
                  <Input value={formData.engineNumber || ""} onChange={e => handleChange("engineNumber", e.target.value)} className="font-mono uppercase" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Registration No.</label>
                  <Input value={formData.registrationNumber || ""} onChange={e => handleChange("registrationNumber", e.target.value)} className="font-mono uppercase" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Old Registration No.</label>
                  <Input value={formData.oldRegistrationNumber || ""} onChange={e => handleChange("oldRegistrationNumber", e.target.value)} className="font-mono uppercase" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">CPLC Counter</label>
                  <Input value={formData.cplcCounter || ""} onChange={e => handleChange("cplcCounter", e.target.value)} className="font-mono uppercase" />
                </div>
              </div>
            </TabsContent>

            {/* 2. Specs TAB */}
            <TabsContent value="specs" className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Fuel Type</label>
                  <Select value={formData.fuelType} onValueChange={(v) => handleChange("fuelType", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{fuelTypes.map(f => <SelectItem key={f.id} value={f.name}>{f.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Transmission</label>
                  <Select value={formData.transmission} onValueChange={(v) => handleChange("transmission", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{transmissions.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Drive Type</label>
                  <Select value={formData.driveType} onValueChange={(v) => handleChange("driveType", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{driveTypes.map(d => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Body Type</label>
                  <Select value={formData.bodyType} onValueChange={(v) => handleChange("bodyType", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{bodyTypes.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Color</label>
                  <Select value={formData.color} onValueChange={(v) => handleChange("color", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{colors.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-border">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Mfg Year</label>
                  <Input type="number" value={formData.year || ""} onChange={e => handleChange("year", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Model Year</label>
                  <Input type="number" value={formData.modelYear || ""} onChange={e => handleChange("modelYear", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Reg. Year</label>
                  <Input type="number" value={formData.registrationYear || ""} onChange={e => handleChange("registrationYear", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Vehicle CC</label>
                  <Select value={formData.vehicleCC} onValueChange={(v) => handleChange("vehicleCC", v)}>
                    <SelectTrigger><SelectValue placeholder="Select CC..." /></SelectTrigger>
                    <SelectContent>{vehicleCCs.map(cc => <SelectItem key={cc.id} value={cc.name}>{cc.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            {/* 3. Ownership TAB */}
            <TabsContent value="ownership" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Possession */}
                <div className="space-y-3 p-4 bg-muted rounded-lg border border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-foreground font-semibold text-sm"><User size={16} /> Current Owner</div>
                    {formData.ownerId && (
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground" onClick={() => handleClearOwner('POSSESSION')}><X size={14} /></Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Search Client</label>
                    <ClientSelector
                      clients={clients}
                      value={formData.ownerId || ""}
                      onChange={(cid) => handleClientChange('POSSESSION', cid)}
                      placeholder="Search owner..."
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Name Override</label>
                    <Input value={formData.ownerName || ""} onChange={e => handleChange("ownerName", e.target.value)} className="bg-card h-9 text-sm" />
                  </div>
                </div>

                {/* Registered Owner */}
                <div className="space-y-3 p-4 bg-muted rounded-lg border border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-foreground font-semibold text-sm"><FileText size={16} /> Registered Owner</div>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Owner Name</label>
                      <Input
                        value={formData.registeredOwnerName || ""}
                        onChange={e => handleChange("registeredOwnerName", e.target.value)}
                        className="bg-card h-9 text-sm"
                        placeholder="Enter Name..."
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Owner CNIC</label>
                      <Input
                        value={formData.registeredOwnerCnic || ""}
                        onChange={e => handleChange("registeredOwnerCnic", e.target.value)}
                        className="bg-card h-9 text-sm font-mono"
                        placeholder="Enter CNIC..."
                        maxLength={15}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t border-border">
                <label className="text-sm font-medium text-foreground">Registration Reason</label>
                <Select value={formData.registrationReason} onValueChange={(v) => handleChange("registrationReason", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="For Purchase">For Purchase</SelectItem>
                    <SelectItem value="For Transfer">For Transfer</SelectItem>
                    <SelectItem value="For Registration">For Registration</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            {/* 4. Settings TAB */}
            <TabsContent value="settings" className="space-y-6">
              <div className="p-4 bg-muted rounded-lg border border-border">
                <h4 className="font-bold text-sm text-foreground mb-4">Application Status</h4>

                {/* Check if plates are already delivered */}
                {vehicle.plateStatus?.toLowerCase().includes("delivered") ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-muted rounded-full">
                        <CreditCard size={20} className="text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-emerald-900 mb-1">Plates Already Delivered</p>
                        <p className="text-xs text-primary mb-2">
                          The number plates for this vehicle have been delivered to the customer.
                          Plate status cannot be modified.
                        </p>
                        <div className="bg-card/50 p-2 rounded border border-emerald-200">
                          <p className="text-xs text-muted-foreground"><span className="font-medium">Current Status:</span> {vehicle.plateStatus}</p>
                          {vehicle.plateDeliveredToName && (
                            <p className="text-xs text-muted-foreground mt-1"><span className="font-medium">Delivered To:</span> {vehicle.plateDeliveredToName}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Plate Status Switch */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm text-foreground">Plates Available?</p>
                        <p className="text-xs text-muted-foreground">Enable if plates are physically present in showroom.</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={formData.platesAvailable === true}
                          onChange={(e) => handleChange("platesAvailable", e.target.checked)}
                        />
                        <div className="w-11 h-6 border-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-900"></div>
                      </label>
                    </div>

                    {/* Unavailable Reason (Conditional) */}
                    {!formData.platesAvailable && (
                      <div className="space-y-1 animate-in slide-in-from-top-2 fade-in">
                        <label className="text-xs font-medium text-muted-foreground">Unavailable Reason</label>
                        <Select
                          value={formData.plateUnavailableReason}
                          onValueChange={(v) => handleChange("plateUnavailableReason", v)}
                        >
                          <SelectTrigger className="bg-card"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Not Issued from Excise">Not Issued from Excise</SelectItem>
                            <SelectItem value="At Party's Hand">At Party's Hand</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

          </Tabs>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-muted flex justify-end gap-3 shrink-0">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading} className="bg-secondary hover:bg-secondary/90 text-white">
            {loading ? "Saving..." : <><Save size={16} className="mr-2" /> Save Changes</>}
          </Button>
        </div>
      </Card>
    </div>
  );
};