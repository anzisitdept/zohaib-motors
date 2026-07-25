"use client";
import { useState, ChangeEvent, useEffect } from "react";
import { X, Upload, Loader2, Image as ImageIcon, Trash2, Calendar, Fuel, Settings2, User, Hash, CreditCard, Eye, Plus, ArrowRight, Sparkles, CheckCircle2, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { doc, updateDoc, arrayUnion, arrayRemove, DocumentData } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface WebsiteVehicleDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicle: any;
}

const IMGBB_API_KEY = process.env.NEXT_PUBLIC_IMGBB_API_KEY || "";
const MAX_FILE_SIZE_MB = 10;

// Utility: Validate file size
const validateFileSize = (file: File, maxSizeMB: number): boolean => {
  const fileSizeMB = file.size / (1024 * 1024);
  return fileSizeMB <= maxSizeMB;
};

// Utility: Upload with retry
const uploadWithRetry = async (
  formData: FormData,
  maxRetries: number = 3
): Promise<any> => {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        return data;
      }
      throw new Error(data.error?.message || 'Upload failed');
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  throw lastError;
};

export const WebsiteVehicleDetailModal = ({ isOpen, onClose, vehicle }: WebsiteVehicleDetailModalProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; fileName: string } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [viewerImage, setViewerImage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"specs" | "owner">("specs");

  if (!isOpen || !vehicle) return null;

  // This modal is exclusively used for website-inventory documents.
  // Always update `website-inventory/{vehicle.id}` using the `images` field,
  // regardless of whether the listing originated from a physical car or not.
  const assets = vehicle.images || vehicle.assets || [];

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadError(null);
    const newAssets: string[] = [];
    const failedFiles: string[] = [];

    try {
      // Upload each file sequentially
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress({ current: i + 1, total: files.length, fileName: file.name });

        try {
          if (!validateFileSize(file, MAX_FILE_SIZE_MB)) {
            failedFiles.push(`${file.name} (exceeds ${MAX_FILE_SIZE_MB}MB limit)`);
            continue;
          }

          const formData = new FormData();
          formData.append("image", file);

          const data = await uploadWithRetry(formData);

          if (data.success) {
            newAssets.push(data.data.url);
          }
        } catch (fileError) {
          console.error(`Failed to upload ${file.name}:`, fileError);
          failedFiles.push(file.name);
        }
      }

      if (newAssets.length > 0) {
        const listingRef = doc(db, "website-inventory", vehicle.id);
        await updateDoc(listingRef, {
          images: arrayUnion(...newAssets)
        });
      }

      if (failedFiles.length > 0) {
        setUploadError(`Failed to upload: ${failedFiles.join(', ')}`);
      }
    } catch (error) {
      console.error("Upload failed:", error);
      setUploadError("An unexpected error occurred during upload. Please try again.");
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
      e.target.value = "";
    }
  };

  const handleDeleteAsset = async (url: string) => {
    if (!confirm("Are you sure you want to remove this vehicle picture?")) return;

    try {
      const listingRef = doc(db, "website-inventory", vehicle.id);
      await updateDoc(listingRef, {
        images: arrayRemove(url)
      });
    } catch (error) {
      console.error("Delete failed", error);
    }
  };

  const DetailRow = ({ label, value, icon: Icon }: { label: string, value: string | number | undefined, icon?: any }) => (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0 hover:bg-muted/50 px-2 rounded-md transition-colors">
      <div className="flex items-center gap-2.5 text-muted-foreground">
        {Icon && <Icon size={14} className="text-muted-foreground shrink-0" />}
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <span className="text-sm font-bold text-foreground text-right truncate max-w-[200px]" title={String(value || "N/A")}>
        {value || "N/A"}
      </span>
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
        <Card className="w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl bg-card rounded-2xl border-0 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-border bg-muted/80">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-tr from-blue-500 to-indigo-600 text-white rounded-xl shadow-md shadow-blue-500/20">
                <ImageIcon size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg text-foreground tracking-tight">
                    {vehicle.brandName} <span className="text-muted-foreground font-normal">{vehicle.model}</span>
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-primary uppercase tracking-wider">
                    {vehicle.registrationNumber || "UNREGISTERED"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground font-medium">Chassis: {vehicle.chassisNumber} • Variant: {vehicle.variant || "Base"}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:border-border">
              <X size={18} />
            </Button>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-muted/40">
            
            {/* Left Side: Vehicle Details (Scrollable) */}
            <div className="w-full md:w-5/12 border-r border-border flex flex-col overflow-hidden bg-card">
              
              {/* Tab selector */}
              <div className="flex border-b border-border p-2 gap-1 bg-muted/50">
                <button
                  onClick={() => setActiveTab("specs")}
                  className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all ${
                    activeTab === "specs"
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  Technical Specifications
                </button>
                <button
                  onClick={() => setActiveTab("owner")}
                  className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all ${
                    activeTab === "owner"
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  Ownership & Registry
                </button>
              </div>

              {/* Details Content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {activeTab === "specs" ? (
                  <div className="space-y-3">
                    <h4 className="text-xs font-extrabold text-foreground uppercase tracking-widest border-b pb-1.5 flex items-center gap-1.5">
                      <Settings2 size={13} className="text-blue-500" /> Specifications
                    </h4>
                    <div className="space-y-0.5 bg-muted/50 p-2.5 rounded-xl border border-border">
                      <DetailRow label="Brand Name" value={vehicle.brandName} />
                      <DetailRow label="Model Name" value={vehicle.model} />
                      <DetailRow label="Variant" value={vehicle.variant} />
                      <DetailRow label="Year (Mfg)" value={vehicle.year} icon={Calendar} />
                      <DetailRow label="Model Year" value={vehicle.modelYear} icon={Calendar} />
                      <DetailRow label="Reg Year" value={vehicle.registrationYear} icon={Calendar} />
                      <DetailRow label="Fuel Type" value={vehicle.fuelType} icon={Fuel} />
                      <DetailRow label="Transmission" value={vehicle.transmission} />
                      <DetailRow label="Color" value={vehicle.color} />
                      <DetailRow label="Engine CC" value={vehicle.vehicleCC} />
                      <DetailRow label="Body Type" value={vehicle.bodyType} />
                      <DetailRow label="Drive Type" value={vehicle.driveType} />
                    </div>

                    <h4 className="text-xs font-extrabold text-foreground uppercase tracking-widest border-b pb-1.5 pt-2 flex items-center gap-1.5">
                      <Sparkles size={13} className="text-blue-500" /> Registry System Info
                    </h4>
                    <div className="space-y-0.5 bg-muted/50 p-2.5 rounded-xl border border-border">
                      <DetailRow label="Chassis Number" value={vehicle.chassisNumber} icon={Hash} />
                      <DetailRow label="Engine Number" value={vehicle.engineNumber} icon={Hash} />
                      <DetailRow label="Barcode" value={vehicle.barcode} />
                      <DetailRow label="Reason" value={vehicle.registrationReason} />
                      <DetailRow label="Vehicle Source" value={vehicle.vehicleSource} />
                      <DetailRow label="File Status" value={vehicle.fileStatus} />
                      <DetailRow label="Plates Available" value={vehicle.platesAvailable ? "Yes" : "No"} />
                      <DetailRow label="Plate Status" value={vehicle.plateStatus} />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {/* Current possession owner */}
                    <div>
                      <h4 className="text-xs font-extrabold text-foreground uppercase tracking-widest border-b pb-1.5 flex items-center gap-1.5">
                        <User size={13} className="text-indigo-500" /> Current Owner (Possession)
                      </h4>
                      {vehicle.ownerName ? (
                        <div className="space-y-0.5 bg-muted/50 p-2.5 rounded-xl border border-border mt-2">
                          <DetailRow label="Name" value={vehicle.ownerName} icon={User} />
                          <DetailRow label="Contact" value={vehicle.ownerContact} />
                        </div>
                      ) : (
                        <div className="p-4 bg-muted border border-dashed rounded-xl text-center mt-2">
                          <p className="text-xs text-muted-foreground">No Current Possession Owner assigned.</p>
                        </div>
                      )}
                    </div>

                    {/* Book Registered Owner */}
                    <div>
                      <h4 className="text-xs font-extrabold text-foreground uppercase tracking-widest border-b pb-1.5 flex items-center gap-1.5">
                        <CreditCard size={13} className="text-purple-500" /> Registered Owner (Documents)
                      </h4>
                      {vehicle.registeredOwnerName || vehicle.registeredOwnerCnic ? (
                        <div className="space-y-0.5 bg-muted/50 p-2.5 rounded-xl border border-border mt-2">
                          <DetailRow label="Registered Name" value={vehicle.registeredOwnerName} icon={User} />
                          <DetailRow label="Registered CNIC" value={vehicle.registeredOwnerCnic} icon={CreditCard} />
                        </div>
                      ) : (
                        <div className="p-4 bg-muted border border-dashed rounded-xl text-center mt-2">
                          <p className="text-xs text-muted-foreground">No Registered Book Owner details provided.</p>
                        </div>
                      )}
                    </div>

                    {/* Quick System Badge */}
                    <div className="p-4 bg-slate-900 text-white rounded-xl flex items-center gap-3">
                      <CheckCircle2 size={24} className="text-emerald-400 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Workflow Status</p>
                        <p className="text-sm font-extrabold">{vehicle.currentStatus || "SHOWROOM"}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Side: Vehicle Media Gallery & Uploads */}
            <div className="flex-1 flex flex-col overflow-hidden bg-muted/30">
              
              {/* Media gallery grid */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <ImageIcon size={16} className="text-muted-foreground" /> Vehicle Photo Gallery 
                    <span className="text-xs border-border text-muted-foreground px-2 py-0.5 rounded-full font-bold">
                      {assets.length}
                    </span>
                  </h4>
                </div>

                {assets.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {assets.map((url: string, index: number) => (
                      <div key={index} className="group relative aspect-[4/3] bg-card rounded-xl border-2 border-border overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300">
                        {/* Image */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`Vehicle view ${index + 1}`}
                          className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-500"
                          onClick={() => setViewerImage(url)}
                        />

                        {/* Actions overlay */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            onClick={() => setViewerImage(url)}
                            className="p-2 bg-card/95 rounded-full text-foreground hover:text-primary hover:scale-110 transition-all shadow-md"
                            title="Expand Image"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteAsset(url)}
                            className="p-2 bg-card/95 rounded-full text-foreground hover:text-red-600 hover:scale-110 transition-all shadow-md"
                            title="Delete Picture"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-[250px] flex flex-col items-center justify-center text-muted-foreground bg-card border border-border rounded-xl space-y-3">
                    <ImageIcon size={44} className="opacity-20 text-muted-foreground" />
                    <p className="text-sm font-semibold">No pictures uploaded yet</p>
                    <p className="text-xs max-w-[240px] text-center text-muted-foreground">
                      Upload high-resolution photos of the vehicle to showcase in the website inventory.
                    </p>
                  </div>
                )}
              </div>

              {/* Upload Panel at the bottom */}
              <div className="p-5 border-t border-border bg-card flex flex-col sm:flex-row items-center gap-4">
                <div className="flex-1">
                  <h5 className="text-xs font-extrabold text-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                    Upload Vehicle Pictures
                  </h5>
                  <p className="text-[11px] text-muted-foreground">
                    Supports JPG, PNG (max {MAX_FILE_SIZE_MB}MB). Images will upload securely using your IMGbb API.
                  </p>
                </div>
                
                <div className="relative shrink-0 w-full sm:w-auto">
                  <Input
                    type="file"
                    accept="image/*"
                    multiple
                    className="absolute inset-0 opacity-0 cursor-pointer z-10 h-full w-full"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                  />
                  <Button
                    disabled={isUploading}
                    className="w-full sm:w-auto gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-xs px-5 py-2.5 rounded-xl shadow-md shadow-blue-500/10 hover:shadow-lg hover:shadow-blue-500/20 active:scale-95 transition-all"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="animate-spin" size={14} />
                        {uploadProgress 
                          ? `Uploading (${uploadProgress.current}/${uploadProgress.total})` 
                          : "Processing..."
                        }
                      </>
                    ) : (
                      <>
                        <Upload size={14} />
                        Upload New Pictures
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Error strip */}
              {uploadError && (
                <div className="px-5 py-2.5 bg-red-50 border-t border-red-100 flex items-center gap-2 text-red-700">
                  <ShieldAlert size={14} className="shrink-0" />
                  <p className="text-xs font-semibold">{uploadError}</p>
                </div>
              )}

            </div>
          </div>
        </Card>
      </div>

      {/* Expanded Image Viewer Overlay */}
      {viewerImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 p-4 animate-in fade-in duration-200"
          onClick={() => setViewerImage(null)}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-card/20 rounded-full h-10 w-10"
            onClick={() => setViewerImage(null)}
          >
            <X size={24} />
          </Button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={viewerImage}
            alt="Full screen vehicle view"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl border border-white/10"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};
