"use client";
import { useState, useEffect, FormEvent } from "react";
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { PlusCircle, Loader2, CheckCircle2, Car, Settings2, FileText, User, CreditCard, X, Receipt, ArrowRight } from "lucide-react";
import Link from "next/link";
import { ClientSelector } from "./ClientSelector";

// Helper hook to fetch simple lists from Firestore
const useSettings = (collectionName: string) => {
  const [data, setData] = useState<any[]>([]);
  useEffect(() => {
    const q = query(collection(db, collectionName), orderBy("name"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [collectionName]);
  return data;
};

export const RegistryForm = () => {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [formKey, setFormKey] = useState(0);

  // Post-save Purchase modal
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [savedVehicleId, setSavedVehicleId] = useState("");
  const [savedVehicleName, setSavedVehicleName] = useState("");

  // 1. Fetch All Configuration Data
  const brands = useSettings("brands");
  const colors = useSettings("settings_colors");
  const fuelTypes = useSettings("settings_fuel");
  const transmissions = useSettings("settings_transmission");
  const bodyTypes = useSettings("settings_body");
  const driveTypes = useSettings("settings_drive");
  const vehicleCCs = useSettings("settings_cc");

  // 2. Local State for Dependents
  const [clients, setClients] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);

  // 3. Selection State
  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [selectedModelName, setSelectedModelName] = useState("");

  // Ownership State
  const [currentOwnerId, setCurrentOwnerId] = useState("");

  // Registered Owner - Text Fields
  const [registeredOwnerName, setRegisteredOwnerName] = useState("");
  const [registeredOwnerCnic, setRegisteredOwnerCnic] = useState("");

  // New Toggles & Fields
  const [platesAvailable, setPlatesAvailable] = useState(true);
  const [plateUnavailableReason, setPlateUnavailableReason] = useState<"Not Issued from Excise" | "At Party's Hand">("Not Issued from Excise");
  const [vehicleSource, setVehicleSource] = useState<"Local" | "Imported">("Local");
  const [registrationReason, setRegistrationReason] = useState<"For Purchase" | "For Transfer" | "For Registration">("For Purchase");

  const [bookAvailable, setBookAvailable] = useState(true);
  const [fileAvailable, setFileAvailable] = useState(true);
  const [keysCount, setKeysCount] = useState("1");



  // Derived State
  const availableVariants = models.find(m => m.name === selectedModelName)?.variants || [];

  // Fetch Clients
  useEffect(() => {
    const q = query(collection(db, "clients"), orderBy("name"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);



  // Fetch Models when Brand changes
  useEffect(() => {
    if (!selectedBrandId) {
      setModels([]);
      setSelectedModelName("");
      return;
    }
    const q = query(collection(db, "models"), where("brandId", "==", selectedBrandId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setModels(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [selectedBrandId]);

  // 4. Submission Logic
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setMessage("");

    const form = e.currentTarget;
    const formData = new FormData(form);

    // Resolve Names
    const brandName = brands.find(b => b.id === selectedBrandId)?.name || "Unknown";

    // Resolve Client Details
    const currentOwner = clients.find(c => c.id === currentOwnerId);

    // Generate Unique Barcode (CZ + 9 random digits)
    const barcode = "CZ" + Math.floor(100000000 + Math.random() * 900000000).toString();

    // Construct Vehicle Object
    const vehicleData = {
      // Identity
      barcode: barcode,
      chassisNumber: formData.get("chassisNumber"),
      engineNumber: formData.get("engineNumber"),
      registrationNumber: formData.get("registrationNumber") || "Unregistered",
      cplcCounter: formData.get("cplcCounter") || null,

      // Specs
      brandId: selectedBrandId,
      brandName: brandName,
      model: selectedModelName,
      variant: formData.get("variant") || "",
      year: Number(formData.get("year")), // Mfg Year
      modelYear: Number(formData.get("modelYear")) || Number(formData.get("year")), // Default to Mfg if empty
      registrationYear: Number(formData.get("registrationYear")) || null,
      mileage: 0,

      // Attributes
      color: formData.get("color"),
      fuelType: formData.get("fuelType"),
      transmission: formData.get("transmission"),
      bodyType: formData.get("bodyType"),
      driveType: formData.get("driveType"),
      vehicleCC: formData.get("vehicleCC"),

      // Current Owner (Possession)
      ownerId: currentOwnerId || null,
      ownerName: currentOwner?.name || "",
      ownerContact: currentOwner?.phone || "",

      // Registered Owner (Documents) - Text Fields
      registeredOwnerId: null, // No longer linking to client
      registeredOwnerName: registeredOwnerName || "",
      registeredOwnerCnic: registeredOwnerCnic || "",

      // Application Status Logic
      platesAvailable: platesAvailable,
      plateStatus: platesAvailable ? "Showroom" : plateUnavailableReason,

      docsApplied: true,
      fileStatus: "Showroom",

      // Registration Information
      registrationReason: registrationReason,
      vehicleSource: vehicleSource,
      
      // Physical assets
      bookAvailable,
      fileAvailable,
      keysCount,

      // System Metadata
      currentStatus: "SHOWROOM",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      registeredBy: user.uid,
      history: [{
        action: "Initial Registration",
        details: `Registered ${brandName} ${selectedModelName} - Chassis: ${formData.get("chassisNumber")}`,
        timestamp: new Date().toISOString(),
        performedBy: user.uid,
        type: "REGISTRATION",
        registrationData: {
          // Vehicle Identity
          brand: brandName,
          model: selectedModelName,
          variant: formData.get("variant") || "",

          // Years
          mfgYear: Number(formData.get("year")),
          modelYear: Number(formData.get("modelYear")) || Number(formData.get("year")),
          registrationYear: Number(formData.get("registrationYear")) || null,

          // Identification Numbers
          registrationNumber: formData.get("registrationNumber") || "Unregistered",
          chassisNumber: formData.get("chassisNumber"),
          engineNumber: formData.get("engineNumber"),
          cplcCounter: formData.get("cplcCounter") || "N/A",

          // Registration Info
          registrationReason: registrationReason,
          vehicleSource: vehicleSource,

          // Plate Availability
          platesAvailable: platesAvailable,
          plateStatus: platesAvailable ? "Showroom" : plateUnavailableReason,
          plateUnavailableReason: !platesAvailable ? plateUnavailableReason : null,

          // Ownership
          currentOwner: {
            id: currentOwnerId || null,
            name: currentOwner?.name || "Not Assigned",
            contact: currentOwner?.phone || "N/A"
          },
          registeredOwner: {
            name: registeredOwnerName || "Not Specified",
            cnic: registeredOwnerCnic || "N/A"
          },

          // Additional Specs
          color: formData.get("color"),
          fuelType: formData.get("fuelType"),
          transmission: formData.get("transmission"),
          bodyType: formData.get("bodyType") || "N/A",
          driveType: formData.get("driveType") || "N/A",
          vehicleCC: formData.get("vehicleCC") || "N/A"
        }
      }]
    };

    try {
      // 1. Get or create "Vehicle Asset" account type
      let vehicleAssetTypeId = "";
      const typeQuery = query(collection(db, "account-types"), where("name", "==", "Vehicle Asset"));
      const typeSnapshot = await getDocs(typeQuery);
      if (!typeSnapshot.empty) {
        vehicleAssetTypeId = typeSnapshot.docs[0].id;
      } else {
        const typeRef = await addDoc(collection(db, "account-types"), {
          name: "Vehicle Asset",
          description: "Accounts to track vehicle assets and capitalize costs",
          createdAt: serverTimestamp(),
          createdBy: user.uid
        });
        vehicleAssetTypeId = typeRef.id;
      }

      // 2. Auto-create vehicle ledger account (balance 0 — Purchase Invoice sets the price)
      const chassisNo = formData.get("chassisNumber") as string;
      const lastFourChassis = chassisNo.slice(-4) || "0000";
      const vehicleAccountName = `Vehicle: ${brandName} ${selectedModelName} (${lastFourChassis})`;

      const vehicleAccountRef = await addDoc(collection(db, "accounts"), {
        name: vehicleAccountName,
        typeId: vehicleAssetTypeId,
        typeName: "Vehicle Asset",
        balance: 0,
        description: `Auto-created ledger account for vehicle: ${brandName} ${selectedModelName} - Chassis: ${chassisNo}`,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid
      });

      // 3. Save vehicle with account reference — financial details handled via Purchase Invoice
      const carRef = await addDoc(collection(db, "cars"), {
        ...vehicleData,
        vehicleAccountId: vehicleAccountRef.id,
        vehicleAccountName,
        totalExpenses: 0,
        capitalizedCost: 0,
        publishedToWeb: false
      });

      await addDoc(collection(db, "logs"), {
        action: `Registered: ${brandName} ${selectedModelName}`,
        details: `Barcode: ${barcode}`,
        performedBy: user.uid,
        timestamp: serverTimestamp(),
        type: "REGISTRY"
      });

      setMessage(`Success: Vehicle registered (Barcode: ${barcode})`);

      // Reset Form Logic
      setFormKey(prev => prev + 1);
      setSelectedBrandId("");
      setSelectedModelName("");
      setCurrentOwnerId("");
      setRegisteredOwnerName("");
      setRegisteredOwnerCnic("");
      setPlatesAvailable(true);
      setPlateUnavailableReason("Not Issued from Excise");
      setVehicleSource("Local");
      setBookAvailable(true);
      setFileAvailable(true);
      setKeysCount("1");

      // If registered for purchase, show CTA modal
      if (registrationReason === "For Purchase") {
        setSavedVehicleId(carRef.id);
        setSavedVehicleName(`${brandName} ${selectedModelName}`);
        setShowPurchaseModal(true);
      }

      setRegistrationReason("For Purchase");



    } catch (error) {
      console.error("Registration Error:", error);
      setMessage("Error: Could not register vehicle. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Helper to render client card
  const ClientPreview = ({ client, title, onClear }: { client: any, title: string, onClear: () => void }) => (
    <div className={`p-4 bg-card border rounded-lg text-sm space-y-2 transition-all duration-300 ${client ? 'border-blue-200 shadow-sm opacity-100' : 'border-dashed border-border opacity-60'}`}>
      <div className="flex justify-between items-center border-b border-slate-50 pb-2 mb-2">
        <span className="text-xs font-bold text-muted-foreground uppercase">{title}</span>
        {client && (
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-muted text-green-700 text-[10px] font-bold">LINKED</span>
            <button type="button" onClick={onClear} className="text-muted-foreground hover:text-red-500 transition-colors">
              <X size={14} />
            </button>
          </div>
        )}
      </div>
      {client ? (
        <div className="grid grid-cols-2 gap-y-1">
          <span className="text-muted-foreground text-xs">Name:</span>
          <span className="font-medium text-foreground text-right">{client.name}</span>
          <span className="text-muted-foreground text-xs">Contact:</span>
          <span className="font-medium text-foreground text-right">{client.phone}</span>
        </div>
      ) : (
        <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-2">
          <User size={20} className="mb-1 opacity-20" />
          <p className="text-xs">No client selected</p>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* ── Post-Save Purchase Modal ───────────────────────────────────────────── */}
      {showPurchaseModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowPurchaseModal(false)}
          />

          {/* Panel */}
          <div className="relative z-10 w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Green success header */}
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 px-6 py-8 text-white text-center">
              <div className="w-16 h-16 rounded-full bg-card/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={36} className="text-white" />
              </div>
              <h2 className="text-xl font-bold">Vehicle Registered!</h2>
              <p className="text-emerald-100 text-sm mt-1">{savedVehicleName}</p>
            </div>

            {/* Body */}
            <div className="px-6 py-6 space-y-4">
              <p className="text-muted-foreground text-sm text-center leading-relaxed">
                This vehicle was registered for <span className="font-semibold text-foreground">Purchase</span>.
                Would you like to create a Purchase Invoice now?
              </p>

              {/* Primary CTA */}
              <Button
                className="w-full bg-secondary hover:bg-secondary/90 text-white text-white gap-2 h-11 text-sm font-semibold"
                onClick={() => {
                  setShowPurchaseModal(false);
                  router.push(`/dashboard/purchase-invoice?vehicleId=${savedVehicleId}`);
                }}
              >
                <Receipt size={16} />
                Create Purchase Invoice
                <ArrowRight size={15} className="ml-auto" />
              </Button>

              {/* Skip */}
              <Button
                variant="ghost"
                className="w-full text-muted-foreground hover:text-foreground text-sm"
                onClick={() => setShowPurchaseModal(false)}
              >
                Skip for now
              </Button>
            </div>
          </div>
        </div>
      )}

      <Card className="max-w-5xl mx-auto shadow-lg border-border">
        <CardHeader className="border-b border-border bg-muted/50 pb-6">
          <CardTitle className="text-xl text-foreground">New Vehicle Entry</CardTitle>
          <CardDescription>Add a new vehicle to the showroom inventory system.</CardDescription>
        </CardHeader>

        <CardContent className="p-8">
          {message && (
            <div className={`mb-8 p-4 rounded-lg flex items-center gap-3 text-sm font-medium animate-in fade-in slide-in-from-top-2 ${message.includes("Error") ? "bg-red-50 text-red-700 border border-red-100" : "bg-green-50 text-green-700 border border-green-100"}`}>
              {message.includes("Success") && <CheckCircle2 size={18} />}
              {message}
            </div>
          )}


        {/* Key forces re-render on reset */}
        <form key={formKey} onSubmit={handleSubmit} className="space-y-10">

          {/* 1. Vehicle Identity */}
          <div className="space-y-5">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <div className="p-1.5 bg-blue-100 rounded-md text-primary">
                <Car size={16} />
              </div>
              <h4 className="text-sm font-bold text-foreground uppercase tracking-wider">Vehicle Identity</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Brand *</label>
                <Select
                  name="brandId"
                  value={selectedBrandId}
                  onValueChange={setSelectedBrandId}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Brand..." />
                  </SelectTrigger>
                  <SelectContent>
                    {brands.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Model *</label>
                <Select
                  name="model"
                  value={selectedModelName}
                  onValueChange={setSelectedModelName}
                  disabled={!selectedBrandId}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder={selectedBrandId ? "Select Model..." : "Choose Brand First"} />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map(m => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Variant / Trim</label>
                {availableVariants.length > 0 ? (
                  <Select name="variant">
                    <SelectTrigger>
                      <SelectValue placeholder="Select Variant..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableVariants.map((v: string) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input name="variant" placeholder="e.g. GLi (Manual Entry)" disabled={!selectedModelName} />
                )}
              </div>
            </div>
          </div>

          {/* 2. Technical Specs */}
          <div className="space-y-5">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <div className="p-1.5 bg-orange-100 rounded-md text-secondary">
                <Settings2 size={16} />
              </div>
              <h4 className="text-sm font-bold text-foreground uppercase tracking-wider">Specifications</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Fuel Type *</label>
                <Select name="fuelType" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from(new Map(fuelTypes.map(f => [f.name, f])).values()).map(f => <SelectItem key={f.id} value={f.name}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Transmission *</label>
                <Select name="transmission" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from(new Map(transmissions.map(t => [t.name, t])).values()).map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Body Type</label>
                <Select name="bodyType">
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from(new Map(bodyTypes.map(b => [b.name, b])).values()).map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Drive Type</label>
                <Select name="driveType">
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from(new Map(driveTypes.map(d => [d.name, d])).values()).map(d => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Exterior Color *</label>
                <Select name="color" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Color..." />
                  </SelectTrigger>
                  <SelectContent>
                    {colors.map(c => (
                      <SelectItem key={c.id} value={c.name}>
                        <div className="flex items-center gap-2">
                          {c.value && <div className="w-3 h-3 rounded-full border border-border" style={{ backgroundColor: c.value }} />}
                          {c.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Vehicle CC</label>
                <Select name="vehicleCC">
                  <SelectTrigger>
                    <SelectValue placeholder="Select CC..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from(new Map(vehicleCCs.map(cc => [cc.name, cc])).values()).map(cc => <SelectItem key={cc.id} value={cc.name}>{cc.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Mfg. Year *</label>
                <Input name="year" type="number" min="1900" required placeholder="YYYY" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Model Year</label>
                <Input name="modelYear" type="number" min="1900" placeholder="YYYY" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Reg. Year</label>
                <Input name="registrationYear" type="number" min="1900" placeholder="YYYY" />
              </div>
            </div>
          </div>

          {/* 3. Documentation & Plates */}
          <div className="space-y-5">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <div className="p-1.5 bg-muted rounded-md text-primary">
                <FileText size={16} />
              </div>
              <h4 className="text-sm font-bold text-foreground uppercase tracking-wider">Documentation</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Reg. Number</label>
                <Input name="registrationNumber" placeholder="Unregistered" className="uppercase" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Chassis Number *</label>
                <Input name="chassisNumber" required placeholder="Frame No." className="font-mono uppercase" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Engine Number *</label>
                <Input name="engineNumber" required placeholder="Engine No." className="font-mono uppercase" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">CPLC Counter No.</label>
                <Input name="cplcCounter" placeholder="Optional" className="uppercase" />
              </div>
            </div>

            {/* Registration Reason */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Registration Reason *</label>
                <Select
                  value={registrationReason}
                  onValueChange={(val) => setRegistrationReason(val as "For Purchase" | "For Transfer" | "For Registration")}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Reason..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="For Purchase">For Purchase</SelectItem>
                    <SelectItem value="For Transfer">For Transfer</SelectItem>
                    <SelectItem value="For Registration">For Registration</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Vehicle Source *</label>
                <Select
                  value={vehicleSource}
                  onValueChange={(val) => setVehicleSource(val as "Local" | "Imported")}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Source..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Local">Local</SelectItem>
                    <SelectItem value="Imported">Imported</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Application Switches */}
            <div className="space-y-4 mt-2">
              <div className="flex flex-wrap items-center gap-4 p-3 bg-muted rounded-lg border border-border w-fit">
                {/* Plates Switch */}
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={platesAvailable}
                    onChange={(e) => setPlatesAvailable(e.target.checked)}
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-secondary"></div>
                  <span className="ml-3 text-sm font-medium text-foreground">
                    Plates
                  </span>
                </label>

                {/* Book Switch */}
                <label className="relative inline-flex items-center cursor-pointer ml-4">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={bookAvailable}
                    onChange={(e) => setBookAvailable(e.target.checked)}
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-secondary"></div>
                  <span className="ml-3 text-sm font-medium text-foreground">
                    Reg. Book
                  </span>
                </label>

                {/* File Switch */}
                <label className="relative inline-flex items-center cursor-pointer ml-4">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={fileAvailable}
                    onChange={(e) => setFileAvailable(e.target.checked)}
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-secondary"></div>
                  <span className="ml-3 text-sm font-medium text-foreground">
                    Return File
                  </span>
                </label>

                {/* Keys Input */}
                <div className="flex items-center gap-2 ml-4">
                  <span className="text-sm font-medium text-foreground">Keys Qty:</span>
                  <Input 
                    value={keysCount} 
                    onChange={e => setKeysCount(e.target.value)} 
                    className="w-16 h-8 text-center" 
                    placeholder="1"
                  />
                </div>
              </div>

              {/* Plate Unavailable Reason - Only show when plates are NOT available */}
              {!platesAvailable && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Plate Unavailable Reason *</label>
                  <Select
                    value={plateUnavailableReason}
                    onValueChange={(val) => setPlateUnavailableReason(val as "Not Issued from Excise" | "At Party's Hand")}
                    required={!platesAvailable}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Reason..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Not Issued from Excise">Not Issued from Excise</SelectItem>
                      <SelectItem value="At Party's Hand">At Party's Hand</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>





          {/* 4. Ownership (Client Link) - Updated for Dual Ownership */}
          <div className="space-y-5 bg-muted p-6 rounded-xl border border-border">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-purple-100 rounded-md text-primary">
                  <User size={16} />
                </div>
                <h4 className="text-sm font-bold text-foreground uppercase tracking-wider">Ownership Details</h4>
              </div>
              <Link href="/dashboard/clients" target="_blank" className="text-xs text-primary hover:text-primary font-medium hover:underline flex items-center gap-1">
                <PlusCircle size={12} /> Add New Client
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Column: Current Owner */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <User size={14} className="text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">Current Owner (Possession)</span>
                  <span className="text-[10px] text-muted-foreground italic ml-auto">(Optional)</span>
                </div>
                <ClientSelector
                  clients={clients}
                  value={currentOwnerId}
                  onChange={setCurrentOwnerId}
                  placeholder="Select Current Owner..."
                />
                <ClientPreview
                  client={clients.find(c => c.id === currentOwnerId)}
                  title="Current Owner Info"
                  onClear={() => setCurrentOwnerId("")}
                />
              </div>

              {/* Right Column: Registered Owner */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard size={14} className="text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">Registered Owner (Documents)</span>
                  <span className="text-[10px] text-muted-foreground italic ml-auto">(Optional)</span>
                </div>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Owner Name</label>
                    <Input
                      value={registeredOwnerName}
                      onChange={(e) => setRegisteredOwnerName(e.target.value)}
                      placeholder="Enter owner name..."
                      className="bg-card"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Owner CNIC</label>
                    <Input
                      value={registeredOwnerCnic}
                      onChange={(e) => setRegisteredOwnerCnic(e.target.value)}
                      placeholder="Enter CNIC number..."
                      className="bg-card font-mono"
                      maxLength={15}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-border flex justify-end gap-4">
            <Button type="button" variant="ghost" onClick={() => window.history.back()}>Cancel</Button>
            <Button type="submit" disabled={loading} className="bg-secondary hover:bg-secondary/90 text-white min-w-[180px]">
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</> : "Register Vehicle"}
            </Button>
          </div>
        </form>
        </CardContent>
      </Card>
    </>
  );
};