"use client";
import { useState, useEffect, useMemo } from "react";
import {
  collection, onSnapshot, query, orderBy, addDoc, updateDoc,
  doc, serverTimestamp, getDocs, where
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import {
  Search, CarFront, X, Sparkles, SlidersHorizontal, Globe, LayoutGrid,
  PlusCircle, Send, CheckCircle2, Loader2, Inbox, Car
} from "lucide-react";
import { WebsiteVehicleCard } from "./WebsiteVehicleCard";
import { WebsiteVehicleDetailModal } from "./WebsiteVehicleDetailModal";

type Tab = "published" | "drafts" | "add";

export const WebsiteInventoryManager = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("published");

  // Published (website-inventory collection)
  const [publishedVehicles, setPublishedVehicles] = useState<any[]>([]);

  // Draft suggestions (cars collection, For Purchase, not yet published)
  const [draftVehicles, setDraftVehicles] = useState<any[]>([]);

  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  // Publish dialog state
  const [publishingVehicle, setPublishingVehicle] = useState<any | null>(null);
  const [publishAskingPrice, setPublishAskingPrice] = useState("");
  const [publishDescription, setPublishDescription] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState("");

  // Add direct listing state
  const [newListing, setNewListing] = useState({
    make: "", model: "", variant: "", year: "", color: "",
    fuelType: "", transmission: "",
    engineNo: "", chassisNo: "", registrationNo: "",
    askingPrice: "", description: ""
  });
  const [isAddingListing, setIsAddingListing] = useState(false);
  const [addMessage, setAddMessage] = useState("");

  // System Configuration attributes for dynamic selectors
  const [brands, setBrands] = useState<any[]>([]);
  const [colors, setColors] = useState<any[]>([]);
  const [fuelTypes, setFuelTypes] = useState<any[]>([]);
  const [transmissions, setTransmissions] = useState<any[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [models, setModels] = useState<any[]>([]);

  // Filters (for published tab)
  const [searchTerm, setSearchTerm] = useState("");
  const [brandFilter, setBrandFilter] = useState("ALL");

  // ------- Real-time listeners -------

  // 1. Published website inventory collection
  useEffect(() => {
    const q = query(collection(db, "website-inventory"), orderBy("publishedAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setPublishedVehicles(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // 2. Registry drafts: cars where registrationReason = "For Purchase" and publishedToWeb != true
  useEffect(() => {
    const q = query(collection(db, "cars"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const allCars: any[] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setDraftVehicles(
        allCars.filter(v =>
          v.registrationReason === "For Purchase" && !v.publishedToWeb
        )
      );
    });
    return () => unsub();
  }, []);

  // 3. Fetch Settings Brands, Colors, Fuel Types, and Transmissions
  useEffect(() => {
    const unsubBrands = onSnapshot(query(collection(db, "brands"), orderBy("name")), (snap) => {
      setBrands(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubColors = onSnapshot(query(collection(db, "settings_colors"), orderBy("name")), (snap) => {
      setColors(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubFuel = onSnapshot(query(collection(db, "settings_fuel"), orderBy("name")), (snap) => {
      setFuelTypes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubTrans = onSnapshot(query(collection(db, "settings_transmission"), orderBy("name")), (snap) => {
      setTransmissions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubBrands();
      unsubColors();
      unsubFuel();
      unsubTrans();
    };
  }, []);

  // 4. Fetch Models matching selected brand id
  useEffect(() => {
    if (!selectedBrandId) {
      setModels([]);
      setNewListing(prev => ({ ...prev, model: "", variant: "" }));
      return;
    }
    const q = query(collection(db, "models"), where("brandId", "==", selectedBrandId));
    const unsub = onSnapshot(q, (snap) => {
      setModels(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [selectedBrandId]);

  // ------- Filtered & Derived -------

  const viewingVehicle = useMemo(() => {
    if (!selectedVehicleId) return null;
    return publishedVehicles.find(v => v.id === selectedVehicleId) || null;
  }, [selectedVehicleId, publishedVehicles]);

  const uniqueBrands = useMemo(() => {
    const brands = new Set(publishedVehicles.map(v => v.make || v.brandName).filter(Boolean));
    return Array.from(brands).sort() as string[];
  }, [publishedVehicles]);

  const filteredPublished = useMemo(() => {
    const lower = searchTerm.toLowerCase();
    return publishedVehicles.filter(v => {
      const matchesSearch = !searchTerm ||
        v.make?.toLowerCase().includes(lower) ||
        v.model?.toLowerCase().includes(lower) ||
        v.registrationNo?.toLowerCase().includes(lower) ||
        v.chassisNo?.toLowerCase().includes(lower) ||
        v.color?.toLowerCase().includes(lower);
      const matchesBrand = brandFilter === "ALL" || (v.make || v.brandName) === brandFilter;
      return matchesSearch && matchesBrand;
    });
  }, [publishedVehicles, searchTerm, brandFilter]);

  const filteredDrafts = useMemo(() => {
    const lower = searchTerm.toLowerCase();
    if (!searchTerm) return draftVehicles;
    return draftVehicles.filter(v =>
      v.brandName?.toLowerCase().includes(lower) ||
      v.model?.toLowerCase().includes(lower) ||
      v.chassisNumber?.toLowerCase().includes(lower) ||
      v.registrationNumber?.toLowerCase().includes(lower)
    );
  }, [draftVehicles, searchTerm]);

  // ------- Publish Action -------

  const openPublishDialog = (vehicle: any) => {
    setPublishingVehicle(vehicle);
    setPublishAskingPrice(vehicle.purchasePrice ? String(vehicle.purchasePrice) : "");
    setPublishDescription(`${vehicle.brandName} ${vehicle.model} ${vehicle.modelYear || vehicle.year} - ${vehicle.color}`);
    setPublishMessage("");
  };

  const handlePublish = async () => {
    if (!publishingVehicle || !user) return;
    if (!publishAskingPrice || parseFloat(publishAskingPrice) <= 0) {
      setPublishMessage("Error: Please enter a valid asking price.");
      return;
    }

    setIsPublishing(true);
    setPublishMessage("");

    try {
      // Create website-inventory document
      await addDoc(collection(db, "website-inventory"), {
        sourceVehicleId: publishingVehicle.id,
        type: "Physical Showroom",
        make: publishingVehicle.brandName,
        model: publishingVehicle.model,
        variant: publishingVehicle.variant || "",
        year: publishingVehicle.modelYear || publishingVehicle.year,
        color: publishingVehicle.color,
        fuelType: publishingVehicle.fuelType,
        transmission: publishingVehicle.transmission,
        engineNo: publishingVehicle.engineNumber,
        chassisNo: publishingVehicle.chassisNumber,
        registrationNo: publishingVehicle.registrationNumber || "",
        askingPrice: parseFloat(publishAskingPrice),
        images: publishingVehicle.assets || [],
        description: publishDescription,
        status: "Available",
        barcode: publishingVehicle.barcode,
        publishedAt: serverTimestamp(),
        publishedBy: user.uid
      });

      // Mark source vehicle as published
      await updateDoc(doc(db, "cars", publishingVehicle.id), {
        publishedToWeb: true,
        publishedAt: serverTimestamp()
      });

      setPublishMessage("Success: Vehicle published to website inventory!");
      setTimeout(() => {
        setPublishingVehicle(null);
        setPublishMessage("");
      }, 1500);

    } catch (err) {
      console.error("Publish error:", err);
      setPublishMessage("Error: Could not publish vehicle. Please try again.");
    } finally {
      setIsPublishing(false);
    }
  };

  // ------- Add Direct Website-Only Listing -------

  const handleAddListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!newListing.make || !newListing.model || !newListing.year || !newListing.askingPrice) {
      setAddMessage("Error: Make, Model, Year, and Asking Price are required.");
      return;
    }

    setIsAddingListing(true);
    setAddMessage("");

    try {
      await addDoc(collection(db, "website-inventory"), {
        sourceVehicleId: null,
        type: "Website Only",
        make: newListing.make,
        model: newListing.model,
        variant: newListing.variant,
        year: parseInt(newListing.year),
        color: newListing.color,
        fuelType: newListing.fuelType,
        transmission: newListing.transmission,
        engineNo: newListing.engineNo,
        chassisNo: newListing.chassisNo,
        registrationNo: newListing.registrationNo,
        askingPrice: parseFloat(newListing.askingPrice),
        images: [],
        description: newListing.description,
        status: "Available",
        publishedAt: serverTimestamp(),
        publishedBy: user.uid
      });

      setAddMessage("Success: Listing added to website inventory!");
      setNewListing({
        make: "", model: "", variant: "", year: "", color: "",
        fuelType: "", transmission: "",
        engineNo: "", chassisNo: "", registrationNo: "",
        askingPrice: "", description: ""
      });
      setSelectedBrandId("");
    } catch (err) {
      console.error("Add listing error:", err);
      setAddMessage("Error: Could not add listing.");
    } finally {
      setIsAddingListing(false);
    }
  };

  // ------- Tabs -------

  const tabs: { key: Tab; label: string; count?: number; icon: any }[] = [
    { key: "published", label: "Published Inventory", count: publishedVehicles.length, icon: Globe },
    { key: "drafts", label: "Registry Drafts", count: draftVehicles.length, icon: Inbox },
    { key: "add", label: "Add Web Listing", icon: PlusCircle },
  ];

  return (
    <>
      <div className="space-y-6">

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-5 border-border flex items-center justify-between shadow-sm bg-gradient-to-tr from-blue-50 to-white">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Published on Website</p>
              <h3 className="text-2xl font-extrabold text-foreground mt-1">{publishedVehicles.length}</h3>
            </div>
            <div className="p-3 bg-blue-100/60 rounded-xl text-primary">
              <Globe size={22} />
            </div>
          </Card>
          <Card className="p-5 border-border flex items-center justify-between shadow-sm bg-gradient-to-tr from-amber-50 to-white">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Awaiting Publication</p>
              <h3 className="text-2xl font-extrabold text-amber-700 mt-1">{draftVehicles.length}</h3>
            </div>
            <div className="p-3 bg-amber-100/60 rounded-xl text-primary">
              <Inbox size={22} />
            </div>
          </Card>
          <Card className="p-5 border-border flex items-center justify-between shadow-sm bg-gradient-to-tr from-emerald-50 to-white">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Available (Published)</p>
              <h3 className="text-2xl font-extrabold text-emerald-900 mt-1">
                {publishedVehicles.filter(v => v.status === "Available").length}
              </h3>
            </div>
            <div className="p-3 bg-muted/60 rounded-xl text-primary">
              <CheckCircle2 size={22} />
            </div>
          </Card>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 bg-muted p-1 rounded-xl w-full md:w-fit">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSearchTerm(""); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap
                ${activeTab === tab.key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
                }`}
            >
              <tab.icon size={15} />
              {tab.label}
              {tab.count !== undefined && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold
                  ${activeTab === tab.key ? "bg-muted text-foreground" : "border-border text-muted-foreground"}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ---------- PUBLISHED TAB ---------- */}
        {activeTab === "published" && (
          <div className="space-y-4">
            {/* Filters */}
            <Card className="p-4 border-border shadow-sm">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 text-muted-foreground" size={16} />
                  <Input
                    className="pl-9 bg-card"
                    placeholder="Search by make, model, chassis, color..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select value={brandFilter} onValueChange={setBrandFilter}>
                  <SelectTrigger className="w-[150px] bg-card">
                    <SelectValue placeholder="All Brands" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Brands</SelectItem>
                    {uniqueBrands.map(b => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Badge variant="outline" className="flex items-center px-3 py-2 text-xs font-bold text-muted-foreground border-border bg-card">
                  {filteredPublished.length} of {publishedVehicles.length}
                </Badge>
              </div>
            </Card>

            {/* Grid */}
            <div className="p-6 bg-muted rounded-2xl border border-border min-h-[300px]">
              {filteredPublished.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredPublished.map(vehicle => (
                    <WebsiteVehicleCard
                      key={vehicle.id}
                      vehicle={vehicle}
                      onOpenDetails={(v) => setSelectedVehicleId(v.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <div className="h-16 w-16 border-border/60 rounded-full flex items-center justify-center mb-4">
                    <Globe size={28} />
                  </div>
                  <p className="text-sm font-bold text-muted-foreground">No published vehicles found</p>
                  <p className="text-xs text-muted-foreground mt-1">Publish vehicles from the Registry Drafts tab.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---------- DRAFTS TAB ---------- */}
        {activeTab === "drafts" && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-muted-foreground" size={16} />
              <Input
                className="pl-9 bg-card"
                placeholder="Search drafts by brand, model, chassis..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              {filteredDrafts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 bg-muted rounded-2xl border border-border text-muted-foreground">
                  <Inbox size={36} className="mb-3 opacity-30" />
                  <p className="text-sm font-bold text-muted-foreground">No draft vehicles awaiting publication</p>
                  <p className="text-xs text-muted-foreground mt-1">All purchase registry vehicles have been published.</p>
                </div>
              ) : (
                filteredDrafts.map(vehicle => (
                  <div key={vehicle.id}
                    className="flex items-center justify-between p-4 bg-card border border-border rounded-xl hover:border-amber-200 hover:shadow-sm transition-all">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm">
                        <Car size={18} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-foreground">
                          {vehicle.brandName} {vehicle.model}
                          {vehicle.variant && <span className="text-xs font-normal text-muted-foreground ml-1">{vehicle.variant}</span>}
                        </h4>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span>Year: {vehicle.modelYear || vehicle.year}</span>
                          <span className="border-l pl-3 border-border">{vehicle.color}</span>
                          <span className="border-l pl-3 border-border font-mono">{vehicle.chassisNumber}</span>
                          {vehicle.purchasePrice && (
                            <span className="border-l pl-3 border-border font-semibold text-foreground">
                              Rs. {Number(vehicle.purchasePrice).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Badge variant="outline" className="text-xs text-primary border-amber-200 bg-muted">
                        Draft
                      </Badge>
                      <Button
                        size="sm"
                        className="bg-secondary hover:bg-secondary/90 text-white text-white text-xs gap-1.5"
                        onClick={() => openPublishDialog(vehicle)}
                      >
                        <Send size={13} />
                        Publish to Web
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ---------- ADD LISTING TAB ---------- */}
        {activeTab === "add" && (
          <Card className="p-6 max-w-3xl">
            <div className="flex items-center gap-2 mb-6 pb-4 border-b border-border">
              <div className="p-2 bg-blue-100 text-primary rounded-lg">
                <PlusCircle size={18} />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Add Website-Only Listing</h3>
                <p className="text-xs text-muted-foreground">This vehicle will be listed online only and is not physically in the showroom.</p>
              </div>
            </div>

            {addMessage && (
              <div className={`mb-4 p-3 rounded-lg text-xs font-medium flex items-center gap-2
                ${addMessage.includes("Error") ? "bg-red-50 text-red-700 border border-red-100" : "bg-green-50 text-green-700 border border-green-100"}`}>
                {!addMessage.includes("Error") && <CheckCircle2 size={14} />}
                {addMessage}
              </div>
            )}

            <form onSubmit={handleAddListing} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Make / Brand *</label>
                  <Select
                    value={selectedBrandId}
                    onValueChange={(val) => {
                      setSelectedBrandId(val);
                      const brandName = brands.find(b => b.id === val)?.name || "";
                      setNewListing(p => ({ ...p, make: brandName, model: "", variant: "" }));
                    }}
                    required
                  >
                    <SelectTrigger className="bg-card">
                      <SelectValue placeholder="Select Brand..." />
                    </SelectTrigger>
                    <SelectContent>
                      {brands.map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Model *</label>
                  <Select
                    value={newListing.model}
                    onValueChange={(val) => {
                      setNewListing(p => ({ ...p, model: val, variant: "" }));
                    }}
                    disabled={!selectedBrandId}
                    required
                  >
                    <SelectTrigger className="bg-card">
                      <SelectValue placeholder={selectedBrandId ? "Select Model..." : "Choose Brand First"} />
                    </SelectTrigger>
                    <SelectContent>
                      {models.map(m => (
                        <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Variant / Trim</label>
                  {models.find(m => m.name === newListing.model)?.variants?.length > 0 ? (
                    <Select
                      value={newListing.variant}
                      onValueChange={(val) => setNewListing(p => ({ ...p, variant: val }))}
                    >
                      <SelectTrigger className="bg-card">
                        <SelectValue placeholder="Select Variant..." />
                      </SelectTrigger>
                      <SelectContent>
                        {models.find(m => m.name === newListing.model)?.variants.map((v: string) => (
                          <SelectItem key={v} value={v}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={newListing.variant}
                      onChange={e => setNewListing(p => ({ ...p, variant: e.target.value }))}
                      placeholder="e.g. GLi"
                      disabled={!newListing.model}
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Year *</label>
                  <Input required type="number" value={newListing.year} onChange={e => setNewListing(p => ({ ...p, year: e.target.value }))} placeholder="e.g. 2022" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Color</label>
                  <Select
                    value={newListing.color}
                    onValueChange={(val) => setNewListing(p => ({ ...p, color: val }))}
                  >
                    <SelectTrigger className="bg-card">
                      <SelectValue placeholder="Select Color..." />
                    </SelectTrigger>
                    <SelectContent>
                      {colors.map(c => (
                        <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Fuel Type</label>
                  <Select
                    value={newListing.fuelType}
                    onValueChange={(val) => setNewListing(p => ({ ...p, fuelType: val }))}
                  >
                    <SelectTrigger className="bg-card">
                      <SelectValue placeholder="Select Fuel..." />
                    </SelectTrigger>
                    <SelectContent>
                      {fuelTypes.map(f => (
                        <SelectItem key={f.id} value={f.name}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Transmission</label>
                  <Select
                    value={newListing.transmission}
                    onValueChange={(val) => setNewListing(p => ({ ...p, transmission: val }))}
                  >
                    <SelectTrigger className="bg-card">
                      <SelectValue placeholder="Select Trans..." />
                    </SelectTrigger>
                    <SelectContent>
                      {transmissions.map(t => (
                        <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Reg. Number</label>
                  <Input value={newListing.registrationNo} onChange={e => setNewListing(p => ({ ...p, registrationNo: e.target.value }))} placeholder="e.g. ABC-123" className="uppercase" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Asking Price (PKR) *</label>
                  <Input required type="number" value={newListing.askingPrice} onChange={e => setNewListing(p => ({ ...p, askingPrice: e.target.value }))} placeholder="e.g. 3500000" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Chassis Number</label>
                  <Input value={newListing.chassisNo} onChange={e => setNewListing(p => ({ ...p, chassisNo: e.target.value }))} placeholder="Optional" className="font-mono" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Engine Number</label>
                  <Input value={newListing.engineNo} onChange={e => setNewListing(p => ({ ...p, engineNo: e.target.value }))} placeholder="Optional" className="font-mono" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Description</label>
                  <Input value={newListing.description} onChange={e => setNewListing(p => ({ ...p, description: e.target.value }))} placeholder="Brief description for website..." />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3 border-t border-border">
                <Button type="submit" className="bg-secondary hover:bg-secondary/90 text-white gap-2" disabled={isAddingListing}>
                  {isAddingListing ? <><Loader2 size={14} className="animate-spin" />Adding...</> : <><Globe size={14} />Publish Listing</>}
                </Button>
              </div>
            </form>
          </Card>
        )}

      </div>

      {/* Publish Dialog */}
      <Dialog open={!!publishingVehicle} onOpenChange={() => setPublishingVehicle(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Publish to Website Inventory</DialogTitle>
            <DialogDescription>
              Set the public asking price and description for{" "}
              <strong>{publishingVehicle?.brandName} {publishingVehicle?.model}</strong>.
              The internal purchase price will remain private.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {publishMessage && (
              <div className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2
                ${publishMessage.includes("Error") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                {!publishMessage.includes("Error") && <CheckCircle2 size={14} />}
                {publishMessage}
              </div>
            )}

            <div className="p-3 bg-muted rounded-lg border border-border text-sm space-y-1">
              <div className="flex gap-2 text-muted-foreground">
                <span className="text-muted-foreground w-28">Brand / Model:</span>
                <span className="font-semibold">{publishingVehicle?.brandName} {publishingVehicle?.model} ({publishingVehicle?.modelYear || publishingVehicle?.year})</span>
              </div>
              <div className="flex gap-2 text-muted-foreground">
                <span className="text-muted-foreground w-28">Color:</span>
                <span className="font-semibold">{publishingVehicle?.color}</span>
              </div>
              <div className="flex gap-2 text-muted-foreground">
                <span className="text-muted-foreground w-28">Chassis No:</span>
                <span className="font-mono font-semibold">{publishingVehicle?.chassisNumber}</span>
              </div>
              {publishingVehicle?.purchasePrice && (
                <div className="flex gap-2 text-muted-foreground">
                  <span className="text-muted-foreground w-28">Purchase Price:</span>
                  <span className="font-semibold text-foreground">Rs. {Number(publishingVehicle.purchasePrice).toLocaleString()} (private)</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Public Asking Price (PKR) *</label>
              <Input
                type="number"
                value={publishAskingPrice}
                onChange={e => setPublishAskingPrice(e.target.value)}
                placeholder="Enter public listing price..."
                className="font-semibold"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Public Description</label>
              <Input
                value={publishDescription}
                onChange={e => setPublishDescription(e.target.value)}
                placeholder="Short description shown on website..."
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setPublishingVehicle(null)} disabled={isPublishing}>Cancel</Button>
            <Button
              className="bg-secondary hover:bg-secondary/90 text-white gap-2"
              onClick={handlePublish}
              disabled={isPublishing}
            >
              {isPublishing ? <><Loader2 size={14} className="animate-spin" /> Publishing...</> : <><Send size={14} /> Publish Now</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Website Vehicle Detail Modal */}
      <WebsiteVehicleDetailModal
        isOpen={!!selectedVehicleId}
        onClose={() => setSelectedVehicleId(null)}
        vehicle={viewingVehicle}
      />
    </>
  );
};
