"use client";
import { useState, ChangeEvent, useEffect } from "react";
import { X, Upload, Loader2, Image as ImageIcon, Trash2, Download, CheckSquare, Square, Eye } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { doc, updateDoc, arrayUnion, arrayRemove, DocumentData } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Car extends DocumentData {
  id: string;
  chassisNumber: string;
  model: string;
  assets?: string[]; // Array of image URLs
}

interface AssetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  car: Car | null;
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
        // Exponential backoff: wait 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  throw lastError;
};

export const AssetsModal = ({ isOpen, onClose, car }: AssetsModalProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [localAssets, setLocalAssets] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; fileName: string } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Image viewer state
  const [viewerImage, setViewerImage] = useState<string | null>(null);

  // Multi-select state
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // Sync local state when modal opens with fresh car data
  useEffect(() => {
    if (car?.assets) {
      setLocalAssets(car.assets);
    } else {
      setLocalAssets([]);
    }
    // Reset selections when modal opens
    setSelectedAssets(new Set());
  }, [car]);

  if (!isOpen || !car) return null;

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
          // Validate file size
          if (!validateFileSize(file, MAX_FILE_SIZE_MB)) {
            failedFiles.push(`${file.name} (exceeds ${MAX_FILE_SIZE_MB}MB limit)`);
            continue;
          }

          const formData = new FormData();
          formData.append("image", file);

          // Upload with retry logic
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
        const carRef = doc(db, "cars", car.id);
        // Use arrayUnion to add new images without overwriting existing ones
        await updateDoc(carRef, {
          assets: arrayUnion(...newAssets)
        });

        // Update local state immediately for real-time preview without reopening
        setLocalAssets(prev => [...prev, ...newAssets]);
      }

      // Show summary
      if (failedFiles.length > 0) {
        setUploadError(`Failed to upload ${failedFiles.length} file(s): ${failedFiles.join(', ')}`);
      } else if (newAssets.length > 0) {
        // Success - clear any previous errors
        setUploadError(null);
      }
    } catch (error) {
      console.error("Upload failed:", error);
      setUploadError("An unexpected error occurred during upload. Please try again.");
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
      // Reset input
      e.target.value = "";
    }
  };

  const handleDeleteAsset = async (url: string) => {
    if (!confirm("Are you sure you want to remove this image?")) return;

    try {
      const carRef = doc(db, "cars", car.id);
      await updateDoc(carRef, {
        assets: arrayRemove(url)
      });
      // Update local state immediately
      setLocalAssets(prev => prev.filter(asset => asset !== url));
      // Remove from selection if selected
      setSelectedAssets(prev => {
        const newSet = new Set(prev);
        newSet.delete(url);
        return newSet;
      });
    } catch (error) {
      console.error("Delete failed", error);
    }
  };

  const toggleAssetSelection = (url: string) => {
    setSelectedAssets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(url)) {
        newSet.delete(url);
      } else {
        newSet.add(url);
      }
      return newSet;
    });
  };

  const selectAllAssets = () => {
    if (selectedAssets.size === localAssets.length) {
      setSelectedAssets(new Set());
    } else {
      setSelectedAssets(new Set(localAssets));
    }
  };

  const handleDownloadSelectedAsPdf = async () => {
    if (selectedAssets.size === 0) return;

    setIsDownloadingPdf(true);
    try {
      // Load jsPDF if not already loaded
      if (!(window as any).jspdf) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
          script.onload = resolve;
          script.onerror = reject;
          document.body.appendChild(script);
        });
      }

      const { jsPDF } = (window as any).jspdf;
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: 'a4'
      });

      const selectedUrls = Array.from(selectedAssets);

      for (let i = 0; i < selectedUrls.length; i++) {
        const url = selectedUrls[i];

        // Fetch the image
        const response = await fetch(url);
        const blob = await response.blob();

        const base64data = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = () => resolve(reader.result as string);
        });

        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image();
          image.crossOrigin = "Anonymous";
          image.src = base64data;
          image.onload = () => resolve(image);
          image.onerror = reject;
        });

        // Add new page for each image except the first
        if (i > 0) {
          pdf.addPage();
        }

        const imgWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgHeight = (img.height * imgWidth) / img.width;

        // Center the image vertically if it's smaller than the page
        const yOffset = imgHeight < pageHeight ? (pageHeight - imgHeight) / 2 : 0;

        pdf.addImage(img, 'JPEG', 0, yOffset, imgWidth, imgHeight);
      }

      pdf.save(`${car.model.replace(/\s+/g, '_')}_${car.chassisNumber}_Assets.pdf`);

      // Clear selection after download
      setSelectedAssets(new Set());
    } catch (error) {
      console.error("PDF Generation Error:", error);
      alert("Could not generate PDF. Please try again.");
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
        <Card className="w-full max-w-4xl max-h-[85vh] flex flex-col shadow-xl bg-card overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-muted">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 text-primary rounded-lg">
                <ImageIcon size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Vehicle Assets</h3>
                <p className="text-xs text-muted-foreground">{car.model} • {car.chassisNumber}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {localAssets.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAllAssets}
                    className="text-xs"
                  >
                    {selectedAssets.size === localAssets.length ? "Deselect All" : "Select All"}
                  </Button>
                  {selectedAssets.size > 0 && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleDownloadSelectedAsPdf}
                      disabled={isDownloadingPdf}
                      className="text-xs bg-secondary hover:bg-secondary/90 text-white"
                    >
                      {isDownloadingPdf ? (
                        <>
                          <Loader2 size={14} className="mr-1 animate-spin" />
                          Generating PDF...
                        </>
                      ) : (
                        <>
                          <Download size={14} className="mr-1" />
                          Download ({selectedAssets.size})
                        </>
                      )}
                    </Button>
                  )}
                </>
              )}
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X size={18} />
              </Button>
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Gallery Area */}
            <div className="flex-1 overflow-y-auto p-6 bg-muted/50">
              {localAssets.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {localAssets.map((url, index) => (
                    <div key={index} className="group relative aspect-video bg-card rounded-lg border-2 border-border overflow-hidden shadow-sm hover:shadow-md transition-all">
                      {/* Selection Checkbox */}
                      <div className="absolute top-2 left-2 z-10">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleAssetSelection(url);
                          }}
                          className="p-1.5 bg-card/90 rounded-md shadow-sm hover:bg-card transition-colors"
                        >
                          {selectedAssets.has(url) ? (
                            <CheckSquare size={18} className="text-primary" />
                          ) : (
                            <Square size={18} className="text-muted-foreground" />
                          )}
                        </button>
                      </div>

                      {/* Image */}
                      <img
                        src={url}
                        alt={`Asset ${index + 1}`}
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => setViewerImage(url)}
                      />

                      {/* Overlay Actions */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        {/* View Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewerImage(url);
                          }}
                          className="p-2 bg-card/90 rounded-full text-foreground hover:text-primary hover:bg-card transition-colors"
                          title="View Image"
                        >
                          <Eye size={16} />
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => handleDeleteAsset(url)}
                          className="p-2 bg-card/90 rounded-full text-foreground hover:text-red-600 hover:bg-card transition-colors"
                          title="Delete Image"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {/* Selection Indicator */}
                      {selectedAssets.has(url) && (
                        <div className="absolute inset-0 border-4 border-blue-500 pointer-events-none rounded-lg"></div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-3 min-h-[300px]">
                  <ImageIcon size={48} className="opacity-20" />
                  <p className="text-sm font-medium">No images uploaded yet</p>
                  <p className="text-xs max-w-[200px] text-center">Upload photos of documents, condition reports, or the vehicle itself.</p>
                </div>
              )}
            </div>

            {/* Sidebar / Upload Area */}
            <div className="w-72 border-l border-border bg-card p-6 flex flex-col">
              <h4 className="font-semibold text-sm text-foreground mb-4">Add New Assets</h4>

              <div className="relative flex flex-col items-center justify-center p-6 border-2 border-dashed border-border bg-muted/50 rounded-xl hover:bg-muted transition-colors cursor-pointer group">
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  className="absolute inset-0 opacity-0 cursor-pointer z-10 h-full"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                />
                <div className="flex flex-col items-center space-y-3 py-4">
                  {isUploading ? (
                    <>
                      <Loader2 className="animate-spin text-blue-500" size={32} />
                      {uploadProgress && (
                        <div className="w-full space-y-2">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span className="truncate max-w-[180px]">{uploadProgress.fileName}</span>
                            <span>{uploadProgress.current} / {uploadProgress.total}</span>
                          </div>
                          <div className="w-full border-border rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-muted0 h-full transition-all duration-300 rounded-full"
                              style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="p-3 bg-card rounded-full shadow-sm text-blue-500 group-hover:scale-110 transition-transform">
                      <Upload size={24} />
                    </div>
                  )}
                  <div className="text-center space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {isUploading ? "Uploading..." : "Click to Upload"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">JPG, PNG supported (max {MAX_FILE_SIZE_MB}MB)</p>
                  </div>
                </div>
              </div>

              {/* Upload Error Message */}
              {uploadError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800">
                  <p className="text-xs">{uploadError}</p>
                </div>
              )}

              <div className="mt-auto pt-6 border-t border-border">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <strong>Tip:</strong> Click on any image to view it in full size. Select multiple images and click Download to save them as a single PDF file.
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Image Viewer Dialog */}
      {viewerImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 animate-in fade-in duration-200"
          onClick={() => setViewerImage(null)}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-card/20"
            onClick={() => setViewerImage(null)}
          >
            <X size={24} />
          </Button>
          <img
            src={viewerImage}
            alt="Full size view"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};