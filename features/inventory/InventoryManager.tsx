"use client";
import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { collection, onSnapshot, query, orderBy, doc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Search, Pencil, Trash2, CarFront, User, FileText, Ban, CheckCircle2, ScanBarcode, Filter, X, Printer } from "lucide-react";
import { EditVehicleModal } from "./EditVehicleModal";
import { BarcodeModal } from "@/components/shared/BarcodeModal";
import { VehicleDetailModal } from "./VehicleDetailModal";
import { VehicleGameCard } from "./VehicleGameCard";
import { AssetsModal } from "@/features/assets/AssetsModal";
import { DocumentDeliveryModal } from "./DocumentDeliveryModal";
import { PlatesDeliveryModal } from "./PlatesDeliveryModal";
import { InventoryReportModal } from "./InventoryReportModal";
import { VehicleExpensesModal } from "./VehicleExpensesModal";

export const InventoryManager = () => {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [editingVehicle, setEditingVehicle] = useState<any | null>(null);
  const [barcodeVehicle, setBarcodeVehicle] = useState<any | null>(null);
  const [viewingVehicle, setViewingVehicle] = useState<any | null>(null);
  const [deliveryVehicle, setDeliveryVehicle] = useState<any | null>(null); // State for Delivery Print Modal
  const [deliveryType, setDeliveryType] = useState<"DOCUMENT" | "PLATE" | null>(null); // Track delivery type
  const [assetsVehicle, setAssetsVehicle] = useState<any | null>(null); // State for Print Modal
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [expensesVehicle, setExpensesVehicle] = useState<any | null>(null); // Expenses modal

  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");
  const [brandFilter, setBrandFilter] = useState("ALL");
  const [plateFilter, setPlateFilter] = useState("ALL");
  const [docFilter, setDocFilter] = useState("ALL");
  const [fuelTypeFilter, setFuelTypeFilter] = useState("ALL");
  const [transmissionFilter, setTransmissionFilter] = useState("ALL");
  const [yearFromFilter, setYearFromFilter] = useState("");
  const [yearToFilter, setYearToFilter] = useState("");
  const [registrationFilter, setRegistrationFilter] = useState("ALL");
  const [ownerFilter, setOwnerFilter] = useState("ALL");

  useEffect(() => {
    const q = query(collection(db, "cars"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setVehicles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const s = searchParams.get("search");
    if (s) {
      setSearchTerm(s);
    }
  }, [searchParams]);

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this vehicle record? This cannot be undone.")) {
      await deleteDoc(doc(db, "cars", id));
    }
  };

  // --- Extract Unique Values for Filters ---
  const uniqueBrands = useMemo(() => {
    const brands = new Set(vehicles.map(v => v.brandName).filter(Boolean));
    return Array.from(brands).sort();
  }, [vehicles]);

  const uniqueFuelTypes = useMemo(() => {
    const fuelTypes = new Set(vehicles.map(v => v.fuelType).filter(Boolean));
    return Array.from(fuelTypes).sort();
  }, [vehicles]);

  const uniqueTransmissions = useMemo(() => {
    const transmissions = new Set(vehicles.map(v => v.transmission).filter(Boolean));
    return Array.from(transmissions).sort();
  }, [vehicles]);

  // --- Comprehensive Filtering Logic ---
  const filteredVehicles = vehicles.filter(v => {
    const searchLower = searchTerm.toLowerCase();

    // 1. Search Query (Checks ALL fields)
    const matchesSearch =
      !searchTerm ||
      v.brandName?.toLowerCase().includes(searchLower) ||
      v.model?.toLowerCase().includes(searchLower) ||
      v.variant?.toLowerCase().includes(searchLower) ||
      v.color?.toLowerCase().includes(searchLower) ||
      v.chassisNumber?.toLowerCase().includes(searchLower) ||
      v.engineNumber?.toLowerCase().includes(searchLower) ||
      v.registrationNumber?.toLowerCase().includes(searchLower) ||
      v.cplcCounter?.toLowerCase().includes(searchLower) ||
      v.barcode?.toLowerCase().includes(searchLower) ||
      v.ownerName?.toLowerCase().includes(searchLower) ||
      v.ownerContact?.toLowerCase().includes(searchLower) ||
      v.registeredOwnerName?.toLowerCase().includes(searchLower) ||
      v.registeredOwnerContact?.toLowerCase().includes(searchLower) ||
      v.year?.toString().includes(searchLower) ||
      v.modelYear?.toString().includes(searchLower) ||
      v.registrationYear?.toString().includes(searchLower);

    // 2. Dropdown Filters
    const matchesBrand = brandFilter === "ALL" || v.brandName === brandFilter;

    const matchesPlate =
      plateFilter === "ALL" ||
      (plateFilter === "NOT_AVAILABLE" && (v.plateStatus === "Never Applied" || v.plateStatus === "Not Issued from Excise" || v.plateStatus === "At Party's Hand")) ||
      (plateFilter === "SHOWROOM" && v.plateStatus === "Showroom") ||
      (plateFilter === "DELIVERED" && v.plateStatus?.toLowerCase().includes("delivered"));

    // 3. Document Filter
    const matchesDoc =
      docFilter === "ALL" ||
      (docFilter === "NOT_APPLIED" && (v.fileStatus === "Not Applied" || (!v.fileStatus && v.docsApplied === false))) ||
      (docFilter === "SHOWROOM" && (v.fileStatus === "Showroom" || (!v.fileStatus && v.docsApplied === true))) ||
      (docFilter === "EXCISE" && v.fileStatus === "At Excise") ||
      (docFilter === "RETURNED" && v.fileStatus === "Returned Back to Showroom") ||
      (docFilter === "DELIVERED" && v.fileStatus?.toLowerCase().includes("delivered"));

    // 4. Fuel Type Filter
    const matchesFuelType = fuelTypeFilter === "ALL" || v.fuelType === fuelTypeFilter;

    // 5. Transmission Filter
    const matchesTransmission = transmissionFilter === "ALL" || v.transmission === transmissionFilter;

    // 6. Year Range Filter
    const vehicleYear = v.year || v.modelYear;
    const matchesYearFrom = !yearFromFilter || (vehicleYear && vehicleYear >= parseInt(yearFromFilter));
    const matchesYearTo = !yearToFilter || (vehicleYear && vehicleYear <= parseInt(yearToFilter));

    // 7. Registration Status Filter
    const matchesRegistration =
      registrationFilter === "ALL" ||
      (registrationFilter === "REGISTERED" && v.registrationNumber) ||
      (registrationFilter === "UNREGISTERED" && !v.registrationNumber);

    // 8. Owner Status Filter
    const matchesOwner =
      ownerFilter === "ALL" ||
      (ownerFilter === "HAS_CURRENT" && v.ownerName) ||
      (ownerFilter === "HAS_REGISTERED" && v.registeredOwnerName) ||
      (ownerFilter === "NO_OWNER" && !v.ownerName && !v.registeredOwnerName);

    return matchesSearch && matchesBrand && matchesPlate &&
      matchesDoc && matchesFuelType && matchesTransmission &&
      matchesYearFrom && matchesYearTo && matchesRegistration && matchesOwner;
  });

  const clearFilters = () => {
    setSearchTerm("");
    setBrandFilter("ALL");
    setPlateFilter("ALL");
    setDocFilter("ALL");
    setFuelTypeFilter("ALL");
    setTransmissionFilter("ALL");
    setYearFromFilter("");
    setYearToFilter("");
    setRegistrationFilter("ALL");
    setOwnerFilter("ALL");
  };

  const hasActiveFilters =
    searchTerm ||
    brandFilter !== "ALL" ||
    plateFilter !== "ALL" ||
    docFilter !== "ALL" ||
    fuelTypeFilter !== "ALL" ||
    transmissionFilter !== "ALL" ||
    yearFromFilter ||
    yearToFilter ||
    registrationFilter !== "ALL" ||
    ownerFilter !== "ALL";


  return (
    <>
      <Card className="flex flex-col ">
        {/* --- Advanced Toolbar --- */}
        <div className="p-4 border-b border-border bg-muted space-y-4">

          {/* Top Row: Search & Count */}
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 text-muted-foreground" size={16} />
              <Input
                className="pl-10 bg-card"
                placeholder="Search anything (Chassis, Engine, Name, Phone, CPLC, Year...)"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className="bg-card hover:bg-muted text-primary border-blue-200"
                onClick={() => setIsReportModalOpen(true)}
              >
                <Printer size={16} className="mr-2" />
                Generate Report
              </Button>
              <Badge variant="outline" className="bg-card w-fit whitespace-nowrap">
                {filteredVehicles.length} / {vehicles.length} Records
              </Badge>
            </div>
          </div>

          {/* Filters Row 1: Primary Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mr-2">
              <Filter size={14} /> Filters:
            </div>

            <Select value={brandFilter} onValueChange={setBrandFilter}>
              <SelectTrigger className="w-[140px] h-8 bg-card text-xs">
                <SelectValue placeholder="Brand" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Brands</SelectItem>
                {uniqueBrands.map(b => <SelectItem key={b as string} value={b as string}>{b as string}</SelectItem>)}
              </SelectContent>
            </Select>


            <Select value={fuelTypeFilter} onValueChange={setFuelTypeFilter}>
              <SelectTrigger className="w-[130px] h-8 bg-card text-xs">
                <SelectValue placeholder="Fuel Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Fuel Types</SelectItem>
                {uniqueFuelTypes.map(f => <SelectItem key={f as string} value={f as string}>{f as string}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={transmissionFilter} onValueChange={setTransmissionFilter}>
              <SelectTrigger className="w-[140px] h-8 bg-card text-xs">
                <SelectValue placeholder="Transmission" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Transmissions</SelectItem>
                {uniqueTransmissions.map(t => <SelectItem key={t as string} value={t as string}>{t as string}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={registrationFilter} onValueChange={setRegistrationFilter}>
              <SelectTrigger className="w-[150px] h-8 bg-card text-xs">
                <SelectValue placeholder="Registration" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Vehicles</SelectItem>
                <SelectItem value="REGISTERED">Registered</SelectItem>
                <SelectItem value="UNREGISTERED">Unregistered</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filters Row 2: Document, Plate, Owner, Year */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mr-2">
              <Filter size={14} className="opacity-0" /> {/* Spacer */}
            </div>

            <Select value={docFilter} onValueChange={setDocFilter}>
              <SelectTrigger className="w-[150px] h-8 bg-card text-xs">
                <SelectValue placeholder="Doc Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Documents</SelectItem>
                <SelectItem value="NOT_APPLIED">Not Applied</SelectItem>
                <SelectItem value="SHOWROOM">Showroom</SelectItem>
                <SelectItem value="EXCISE">At Excise</SelectItem>
                <SelectItem value="RETURNED">Returned to Showroom</SelectItem>
                <SelectItem value="DELIVERED">Delivered</SelectItem>
              </SelectContent>
            </Select>

            <Select value={plateFilter} onValueChange={setPlateFilter}>
              <SelectTrigger className="w-[150px] h-8 bg-card text-xs">
                <SelectValue placeholder="Plate Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Plate Status</SelectItem>
                <SelectItem value="NOT_AVAILABLE">Not Available</SelectItem>
                <SelectItem value="SHOWROOM">Showroom</SelectItem>
                <SelectItem value="DELIVERED">Delivered</SelectItem>
              </SelectContent>
            </Select>

            <Select value={ownerFilter} onValueChange={setOwnerFilter}>
              <SelectTrigger className="w-[150px] h-8 bg-card text-xs">
                <SelectValue placeholder="Owner Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Owners</SelectItem>
                <SelectItem value="HAS_CURRENT">Has Current Owner</SelectItem>
                <SelectItem value="HAS_REGISTERED">Has Reg. Owner</SelectItem>
                <SelectItem value="NO_OWNER">No Owner Info</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1">
              <Input
                type="number"
                placeholder="Year From"
                value={yearFromFilter}
                onChange={e => setYearFromFilter(e.target.value)}
                className="w-[100px] h-8 bg-card text-xs"
              />
              <span className="text-muted-foreground text-xs">-</span>
              <Input
                type="number"
                placeholder="Year To"
                value={yearToFilter}
                onChange={e => setYearToFilter(e.target.value)}
                className="w-[100px] h-8 bg-card text-xs"
              />
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-8 text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
              >
                <X size={14} className="mr-1" /> Reset All
              </Button>
            )}
          </div>
        </div>

        {/* --- Card Grid (Gaming Style) --- */}
        <div className="flex-1 overflow-y-auto p-4 bg-muted min-h-[500px]">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredVehicles.map(vehicle => (
              <VehicleGameCard
                key={vehicle.id}
                vehicle={vehicle}
                onEdit={setEditingVehicle}
                onDelete={handleDelete}
                onPrintDetail={setViewingVehicle}
                onPrintDelivery={(vehicle: any, type: "DOCUMENT" | "PLATE") => {
                  setDeliveryVehicle(vehicle);
                  setDeliveryType(type);
                }}
                onPrintBarcode={setBarcodeVehicle}
                onOpenAssets={setAssetsVehicle}
                onOpenExpenses={setExpensesVehicle}
              />
            ))}
          </div>

          {filteredVehicles.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <div className="h-24 w-24 bg-muted rounded-full flex items-center justify-center mb-4 opacity-50">
                <CarFront size={48} className="text-muted-foreground" />
              </div>
              <p className="text-lg font-semibold text-muted-foreground">No Vehicles Found</p>
              <p className="text-sm">Try adjusting your filters or search terms.</p>
              <Button variant="link" onClick={clearFilters} className="mt-2 text-blue-500">Reset Filters</Button>
            </div>
          )}
        </div>
      </Card>

      {/* Edit Modal */}
      <EditVehicleModal
        isOpen={!!editingVehicle}
        onClose={() => setEditingVehicle(null)}
        vehicle={editingVehicle}
      />

      {/* Barcode Modal */}
      <BarcodeModal
        isOpen={!!barcodeVehicle}
        onClose={() => setBarcodeVehicle(null)}
        value={barcodeVehicle?.barcode || barcodeVehicle?.chassisNumber || "N/A"}
        details={{ model: barcodeVehicle?.model, chassis: barcodeVehicle?.chassisNumber }}
      />

      {/* Vehicle Detail Print Modal */}
      <VehicleDetailModal
        isOpen={!!viewingVehicle}
        onClose={() => setViewingVehicle(null)}
        vehicle={viewingVehicle}
      />

      {/* Assets Modal */}
      <AssetsModal
        isOpen={!!assetsVehicle}
        onClose={() => setAssetsVehicle(null)}
        car={assetsVehicle}
      />

      {/* Document Delivery Print Modal */}
      <DocumentDeliveryModal
        isOpen={!!deliveryVehicle && deliveryType === "DOCUMENT"}
        onClose={() => {
          setDeliveryVehicle(null);
          setDeliveryType(null);
        }}
        vehicle={deliveryVehicle}
      />

      {/* Plates Delivery Print Modal */}
      <PlatesDeliveryModal
        isOpen={!!deliveryVehicle && deliveryType === "PLATE"}
        onClose={() => {
          setDeliveryVehicle(null);
          setDeliveryType(null);
        }}
        vehicle={deliveryVehicle}
      />

      {/* Inventory Report Modal */}
      <InventoryReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        vehicles={vehicles}
        currentFilters={{
          docFilter,
          plateFilter,
          brandFilter,
          registrationFilter
        }}
      />

      {/* Vehicle Expenses Modal */}
      <VehicleExpensesModal
        isOpen={!!expensesVehicle}
        onClose={() => setExpensesVehicle(null)}
        vehicle={expensesVehicle}
      />


    </>
  );
};
