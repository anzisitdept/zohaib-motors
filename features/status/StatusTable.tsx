"use client";
import { useState, useEffect } from "react";
import { collection, onSnapshot, doc, updateDoc, serverTimestamp, addDoc, DocumentData } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { X, History, Printer, FolderOpen, Filter, Search, Clock, Ban, ScanBarcode, FileText } from "lucide-react";
import { HistoryModal, HistoryEntry, HistoryType } from "./HistoryModal";
import { DeliveryModal, DeliveryType } from "./DeliveryModal";
import { AssetsModal } from "@/features/assets/AssetsModal";
import { BarcodeModal } from "@/components/shared/BarcodeModal";
import { formatDuration } from "@/lib/dateUtils";

// --- Constants ---
const FILE_STATUSES = [
  "Applied",
  "Excise",
  "Transit",
  "Delivered"
];

const PLATE_STATUSES = [
  "Applied",
  "Plate Printing In Process",
  "Ready for Collection",
  "Collected by Showroom",
  "Delivered to Customer"
];

interface Car extends DocumentData {
  id: string;
  chassisNumber: string;
  model: string;
  ownerName: string;
  fileStatus?: string;
  excisePurpose?: string;
  plateStatus?: string;
  platesApplied?: boolean;
  docsApplied?: boolean; // New field
  barcode?: string;
  cplcCounter?: string;
  history: HistoryEntry[];
  assets?: string[];
  brandName?: string;
  registrationNumber?: string;
  ownerContact?: string;
}

const getFileStatusColor = (status: string) => {
  if (!status) return "text-muted-foreground bg-muted border-border";
  if (status === "Delivered") return "text-green-600 bg-green-50 border-green-100";
  if (status === "Excise" || status === "Transit") return "text-secondary bg-muted border-border";
  return "text-primary bg-muted border-blue-200";
};

export const StatusTable = () => {
  const { user } = useAuth();
  const [cars, setCars] = useState<Car[]>([]);

  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [fileFilter, setFileFilter] = useState("ALL");
  const [plateFilter, setPlateFilter] = useState("ALL");

  // Modal States
  const [selectedCar, setSelectedCar] = useState<Car | null>(null);
  const [activeHistoryType, setActiveHistoryType] = useState<HistoryType | 'ALL'>('ALL');
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('VEHICLE');

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isDeliveryFormOpen, setIsDeliveryFormOpen] = useState(false);
  const [isAssetsOpen, setIsAssetsOpen] = useState(false);
  const [isBarcodeOpen, setIsBarcodeOpen] = useState(false);

  // Excise Popup State
  const [isExcisePopupOpen, setIsExcisePopupOpen] = useState(false);
  const [pendingExciseCarId, setPendingExciseCarId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(collection(db, "cars"), (snapshot) => {
      const carList = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Car));
      setCars(carList);
    });
    return () => unsubscribe();
  }, [user]);

  // --- Generic Update Logic ---
  const updateStatusGeneric = async (
    carId: string,
    newStatus: string,
    currentStatus: string | undefined,
    type: HistoryType,
    dbField: string,
    additionalData: any = {}
  ) => {
    if (newStatus === currentStatus && Object.keys(additionalData).length === 0) return;
    if (!user) return;

    // Special handling for Excise status in File column
    if (type === 'FILE' && newStatus === 'Excise' && !additionalData.excisePurpose) {
      setPendingExciseCarId(carId);
      setIsExcisePopupOpen(true);
      return;
    }

    const car = cars.find(c => c.id === carId);
    if (!car) return;

    const now = new Date();
    const timestampISO = now.toISOString();
    let durationString = "N/A";

    // Find relevant history based on type
    const relevantHistory = (car.history || []).filter(h => h.type === type || (!h.type && type === 'MAIN'));

    if (relevantHistory.length > 0) {
      const lastEntry = relevantHistory[relevantHistory.length - 1];
      durationString = formatDuration(lastEntry.timestamp, timestampISO);
    }

    // FIX: Conditionally add 'note' only if it exists. Firestore rejects 'undefined'.
    const newEntry: HistoryEntry = {
      status: newStatus,
      timestamp: timestampISO,
      updatedBy: user.uid,
      duration: durationString,
      type: type,
      ...(additionalData.excisePurpose ? { note: `Purpose: ${additionalData.excisePurpose}` } : {})
    };

    try {
      await updateDoc(doc(db, "cars", carId), {
        [dbField]: newStatus,
        updatedAt: serverTimestamp(),
        history: [...(car.history || []), newEntry],
        ...additionalData
      });

      await addDoc(collection(db, "logs"), {
        action: `${type} Status updated: ${newStatus}`,
        details: `Vehicle: ${car.model} (${car.chassisNumber}) ${additionalData.excisePurpose ? `- ${additionalData.excisePurpose}` : ''}`,
        relatedCarId: carId,
        performedBy: user.uid,
        timestamp: serverTimestamp(),
        type: "STATUS_UPDATE"
      });
    } catch (e) {
      console.error("Update failed", e);
    }
  };

  const handleExciseSelection = async (purpose: 'Registration' | 'Transfer') => {
    if (pendingExciseCarId) {
      await updateStatusGeneric(
        pendingExciseCarId,
        'Excise',
        '', // Force update even if already Excise
        'FILE',
        'fileStatus',
        { excisePurpose: purpose }
      );
      setIsExcisePopupOpen(false);
      setPendingExciseCarId(null);
    }
  };

  // --- Helpers ---
  const getLastDuration = (car: Car, type: HistoryType) => {
    const relevantHistory = (car.history || []).filter(h => h.type === type);
    if (relevantHistory.length === 0) return "New";
    const lastEntry = relevantHistory[relevantHistory.length - 1];
    return formatDuration(lastEntry.timestamp, new Date().toISOString());
  };

  const getFilteredHistory = () => {
    if (!selectedCar) return [];
    if (activeHistoryType === 'ALL') return selectedCar.history || [];
    return (selectedCar.history || []).filter(h => h.type === activeHistoryType || (!h.type && activeHistoryType === 'MAIN'));
  };

  const getHistoryTitle = () => {
    switch (activeHistoryType) {
      case 'FILE': return "File / Document History";
      case 'PLATE': return "Number Plate History";
      default: return "Vehicle Status History";
    }
  };

  // --- Handlers ---
  const openHistory = (car: Car, type: HistoryType | 'ALL' = 'ALL') => {
    setSelectedCar(car);
    setActiveHistoryType(type);
    setIsHistoryOpen(true);
  };

  const openDeliveryForm = (car: Car, type: DeliveryType) => {
    setSelectedCar(car);
    setDeliveryType(type);
    setIsDeliveryFormOpen(true);
  };

  const openAssets = (car: Car) => { setSelectedCar(car); setIsAssetsOpen(true); };

  const openBarcode = (car: Car) => { setSelectedCar(car); setIsBarcodeOpen(true); };

  const clearFilters = () => {
    setSearchTerm("");
    setFileFilter("ALL");
    setPlateFilter("ALL");
  };

  const filteredCars = cars.filter(car => {
    const matchesSearch =
      car.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      car.chassisNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      car.ownerName?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFile = fileFilter === "ALL" || car.fileStatus === fileFilter;
    const matchesPlate = plateFilter === "ALL" || car.plateStatus === plateFilter;

    return matchesSearch && matchesFile && matchesPlate;
  });

  // --- Footer Component ---
  const StatusFooter = ({ car, type, currentStatus }: { car: Car, type: HistoryType, currentStatus?: string }) => {
    let showPrint = false;
    let currentDeliveryType: DeliveryType = 'VEHICLE';

    if (type === 'FILE' && currentStatus?.includes("Delivered")) {
      showPrint = true;
      currentDeliveryType = 'FILE';
    } else if (type === 'PLATE' && currentStatus === "Delivered to Customer") {
      showPrint = true;
      currentDeliveryType = 'PLATE';
    }

    return (
      <div className="flex items-center justify-between mt-1.5 px-1 min-h-[24px]">
        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Clock size={10} /> {getLastDuration(car, type)}
        </span>
        <div className="flex gap-1">
          {showPrint && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-muted-foreground hover:text-green-600 hover:bg-green-50 rounded-full"
              onClick={() => openDeliveryForm(car, currentDeliveryType)}
              title="Print Receipt"
            >
              <Printer size={12} />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-muted-foreground hover:text-primary hover:bg-muted rounded-full"
            onClick={() => openHistory(car, type)}
            title="View History"
          >
            <History size={12} />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* --- Filters Toolbar --- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Filter size={16} className="text-muted-foreground" /> Filter Vehicles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search Chassis, Model, Owner..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={fileFilter} onValueChange={setFileFilter}>
              <SelectTrigger><SelectValue placeholder="File Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Files</SelectItem>
                {FILE_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>

            <div className="flex gap-2">
              <Select value={plateFilter} onValueChange={setPlateFilter}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Plate Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Plates</SelectItem>
                  {PLATE_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>

              {(searchTerm || fileFilter !== "ALL" || plateFilter !== "ALL") && (
                <Button variant="ghost" size="icon" onClick={clearFilters} title="Clear Filters">
                  <X size={16} className="text-muted-foreground" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* --- Main Table --- */}
      <Card className="border-border shadow-sm overflow-hidden">
        <div className="rounded-md">
          <Table>
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead className="w-[50px] text-center">Sr.</TableHead>
                <TableHead className="w-[200px]">Vehicle Details</TableHead>
                <TableHead className="w-[220px]">Documents</TableHead>
                <TableHead className="w-[200px]">Number Plate</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCars.map((car, index) => (
                <TableRow key={car.id} className="hover:bg-muted/50 transition-colors">

                  {/* Sr No */}
                  <TableCell className="text-center font-medium text-muted-foreground align-top pt-4">
                    {index + 1}
                  </TableCell>

                  {/* Vehicle Info */}
                  <TableCell className="align-top">
                    <div className="font-semibold text-foreground">{car.brandName} {car.model}</div>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">{car.chassisNumber}</div>
                    {car.cplcCounter && <div className="text-[10px] text-muted-foreground font-mono">CPLC: {car.cplcCounter}</div>}
                    <div className="text-[10px] text-muted-foreground mt-1">{car.ownerName || "No Owner"}</div>
                  </TableCell>

                  {/* File Status */}
                  <TableCell className="align-top">
                    {car.docsApplied === false ? (
                      <div className="h-8 flex items-center justify-start gap-2 px-3 text-xs text-muted-foreground border border-border rounded-md bg-muted cursor-not-allowed">
                        <Ban size={12} /> Not Applied
                      </div>
                    ) : (
                      <>
                        <Select
                          value={car.fileStatus || "Applied"}
                          onValueChange={(val) => updateStatusGeneric(car.id, val, car.fileStatus, 'FILE', 'fileStatus')}
                        >
                          <SelectTrigger className={`h-8 text-[10px] truncate border-0 ring-1 ring-inset ${getFileStatusColor(car.fileStatus || "")}`}>
                            <span className="truncate">{car.fileStatus || "Select..."}</span>
                          </SelectTrigger>
                          <SelectContent>
                            {FILE_STATUSES.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        {/* Display Excise Purpose if exists */}
                        {car.fileStatus === 'Excise' && car.excisePurpose && (
                          <div className="text-[10px] text-secondary bg-muted px-2 py-0.5 rounded mt-1 inline-block border border-border">
                            For: {car.excisePurpose}
                          </div>
                        )}
                        <StatusFooter car={car} type="FILE" currentStatus={car.fileStatus} />
                      </>
                    )}
                  </TableCell>

                  {/* Plate Status */}
                  <TableCell className="align-top">
                    {car.platesApplied === false ? (
                      <div className="h-8 flex items-center justify-start gap-2 px-3 text-xs text-muted-foreground border border-border rounded-md bg-muted cursor-not-allowed">
                        <Ban size={12} /> Not Applied
                      </div>
                    ) : (
                      <>
                        <Select
                          value={car.plateStatus || "Applied"}
                          onValueChange={(val) => updateStatusGeneric(car.id, val, car.plateStatus, 'PLATE', 'plateStatus')}
                        >
                          <SelectTrigger className={`h-8 text-[10px] truncate border-0 ring-1 ring-inset ${getFileStatusColor(car.plateStatus || "")}`}>
                            <span className="truncate">{car.plateStatus || "Select..."}</span>
                          </SelectTrigger>
                          <SelectContent>
                            {PLATE_STATUSES.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <StatusFooter car={car} type="PLATE" currentStatus={car.plateStatus} />
                      </>
                    )}
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="text-right align-top">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => openBarcode(car)}
                        title="Print Barcode"
                      >
                        <ScanBarcode size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                        onClick={() => openAssets(car)}
                        title="Documents & Assets"
                      >
                        <FolderOpen size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => openHistory(car, 'ALL')}
                        title="View Full Timeline"
                      >
                        <History size={16} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {filteredCars.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    No vehicles found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Linked Modals */}
      {selectedCar && (
        <>
          <HistoryModal
            isOpen={isHistoryOpen}
            onClose={() => setIsHistoryOpen(false)}
            title={getHistoryTitle()}
            carModel={selectedCar.model}
            chassisNumber={selectedCar.chassisNumber}
            history={getFilteredHistory()}
            fullHistory={selectedCar.history || []}
          />
          <DeliveryModal
            isOpen={isDeliveryFormOpen}
            onClose={() => setIsDeliveryFormOpen(false)}
            car={selectedCar}
            type={deliveryType}
          />
          <AssetsModal
            isOpen={isAssetsOpen}
            onClose={() => setIsAssetsOpen(false)}
            car={selectedCar}
          />
          <BarcodeModal
            isOpen={isBarcodeOpen}
            onClose={() => setIsBarcodeOpen(false)}
            value={selectedCar.barcode || selectedCar.chassisNumber || "N/A"}
            details={{ model: selectedCar.model, chassis: selectedCar.chassisNumber }}
          />
        </>
      )}

      {/* Excise Purpose Popup */}
      <Dialog open={isExcisePopupOpen} onOpenChange={setIsExcisePopupOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excise Purpose</DialogTitle>
            <DialogDescription>
              Is this file at Excise for Registration or Transfer?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-4">
            <Button onClick={() => handleExciseSelection('Registration')} className="w-full justify-start text-left bg-secondary hover:bg-secondary/90 text-white">
              <FileText className="mr-2 h-4 w-4" /> For New Registration
            </Button>
            <Button onClick={() => handleExciseSelection('Transfer')} variant="outline" className="w-full justify-start text-left">
              <History className="mr-2 h-4 w-4" /> For Transfer of Ownership
            </Button>
          </div>
          <DialogFooter className="sm:justify-start">
            <Button
              type="button"
              variant="secondary"
              onClick={() => { setIsExcisePopupOpen(false); setPendingExciseCarId(null); }}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};