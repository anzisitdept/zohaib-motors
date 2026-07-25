"use client";
import { useState, ChangeEvent, useEffect } from "react";
import { X, Upload, Loader2, Image as ImageIcon, Trash2, Download, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { doc, updateDoc, arrayUnion, arrayRemove, DocumentData } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PDFDocument } from "pdf-lib";

interface Client extends DocumentData {
    id: string;
    name: string;
    phone: string;
    assets?: string[]; // Array of image URLs
}

interface ClientAssetsModalProps {
    isOpen: boolean;
    onClose: () => void;
    client: Client | null;
}

const IMGBB_API_KEY = "a6736e3e38e68147b6f9d7b24d2f8d36";
const MAX_FILE_SIZE_MB = 90;

// Utility: Compress PDF
const compressPDF = async (file: File): Promise<File> => {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);

        // Save with compression options
        const compressedPdfBytes = await pdfDoc.save({
            useObjectStreams: true,
            addDefaultPage: false,
            objectsPerTick: 50,
        });

        const compressedBlob = new Blob([compressedPdfBytes as BlobPart], { type: 'application/pdf' });
        return new File([compressedBlob], file.name, { type: 'application/pdf' });
    } catch (error) {
        console.error('PDF compression failed:', error);
        return file; // Return original if compression fails
    }
};

// Utility: Validate file size
const validateFileSize = (file: File, maxSizeMB: number): boolean => {
    const fileSizeMB = file.size / (1024 * 1024);
    return fileSizeMB <= maxSizeMB;
};

// Utility: Format file size
const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
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

export const ClientAssetsModal = ({ isOpen, onClose, client }: ClientAssetsModalProps) => {
    const [isUploading, setIsUploading] = useState(false);
    const [localAssets, setLocalAssets] = useState<string[]>([]);
    const [downloadingUrl, setDownloadingUrl] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; fileName: string } | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);

    // Sync local state when modal opens with fresh data
    useEffect(() => {
        if (client?.assets) {
            setLocalAssets(client.assets);
        } else {
            setLocalAssets([]);
        }
    }, [client]);

    if (!isOpen || !client) return null;

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
                    // Validate file size BEFORE compression
                    if (!validateFileSize(file, MAX_FILE_SIZE_MB)) {
                        failedFiles.push(`${file.name} (exceeds ${MAX_FILE_SIZE_MB}MB limit)`);
                        continue;
                    }

                    let fileToUpload = file;

                    // Compress PDF files
                    if (file.type === 'application/pdf') {
                        const originalSize = formatFileSize(file.size);
                        fileToUpload = await compressPDF(file);
                        const compressedSize = formatFileSize(fileToUpload.size);
                        console.log(`PDF compressed: ${originalSize} → ${compressedSize}`);
                    }

                    const formData = new FormData();
                    formData.append("image", fileToUpload);

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
                const clientRef = doc(db, "clients", client.id);
                // Use arrayUnion to add new images without overwriting existing ones
                await updateDoc(clientRef, {
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
            const clientRef = doc(db, "clients", client.id);
            await updateDoc(clientRef, {
                assets: arrayRemove(url)
            });
            // Update local state immediately
            setLocalAssets(prev => prev.filter(asset => asset !== url));
        } catch (error) {
            console.error("Delete failed", error);
        }
    };

    const handleDownloadPdf = async (url: string, index: number) => {
        setDownloadingUrl(url);
        try {
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

            // Fetch the image/file
            const response = await fetch(url);
            const blob = await response.blob();

            const reader = new FileReader();
            reader.readAsDataURL(blob);

            reader.onloadend = () => {
                const base64data = reader.result;
                const pdf = new jsPDF({
                    orientation: 'portrait',
                    unit: 'px',
                    format: 'a4'
                });

                const img = new Image();
                img.crossOrigin = "Anonymous";
                img.src = base64data as string;

                img.onload = () => {
                    const imgWidth = pdf.internal.pageSize.getWidth();
                    const pageHeight = pdf.internal.pageSize.getHeight();
                    const imgHeight = (img.height * imgWidth) / img.width;

                    let heightLeft = imgHeight;
                    let position = 0;

                    // First page
                    pdf.addImage(img, 'JPEG', 0, 0, imgWidth, imgHeight);
                    heightLeft -= pageHeight;

                    // Loop for subsequent pages
                    while (heightLeft > 0) {
                        pdf.addPage();
                        // Calculate the position to show the next slice of the image
                        // The image is shifted upwards by the amount already displayed
                        pdf.addImage(img, 'JPEG', 0, -(imgHeight - heightLeft), imgWidth, imgHeight);
                        heightLeft -= pageHeight;
                    }

                    pdf.save(`${client.name.replace(/\s+/g, '_')}_Asset_${index + 1}.pdf`);
                    setDownloadingUrl(null); // Clear loading state
                };
            };

        } catch (e) {
            console.error("PDF Generation Error (User Logic):", e);
            alert("Could not generate PDF. Please try again.");
            setDownloadingUrl(null);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <Card className="w-full max-w-3xl max-h-[85vh] flex flex-col shadow-xl bg-card overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border bg-muted">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 text-primary rounded-lg">
                            <ImageIcon size={20} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-foreground">Client Assets</h3>
                            <p className="text-xs text-muted-foreground">{client.name} • {client.phone}</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X size={18} />
                    </Button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Gallery Area */}
                    <div className="flex-1 overflow-y-auto p-6 bg-muted/50">
                        {localAssets.length > 0 ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {localAssets.map((url, index) => (
                                    <div key={index} className="group relative aspect-video bg-card rounded-lg border border-border overflow-hidden shadow-sm hover:shadow-md transition-all">
                                        <img
                                            src={url}
                                            alt={`Asset ${index + 1}`}
                                            className="w-full h-full object-cover"
                                        />
                                        {/* Overlay Actions */}
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">

                                            {/* Download PDF Button */}
                                            <button
                                                onClick={() => handleDownloadPdf(url, index)}
                                                className="p-2 bg-card/90 rounded-full text-foreground hover:text-primary hover:bg-card transition-colors disabled:opacity-50"
                                                title="Download as PDF"
                                                disabled={downloadingUrl === url}
                                            >
                                                {downloadingUrl === url ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
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
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-3 min-h-[300px]">
                                <ImageIcon size={48} className="opacity-20" />
                                <p className="text-sm font-medium">No assets uploaded yet</p>
                                <p className="text-xs max-w-[200px] text-center">Upload photos of ID cards, documents, or other client related files.</p>
                            </div>
                        )}
                    </div>

                    {/* Sidebar / Upload Area */}
                    <div className="w-72 border-l border-border bg-card p-6 flex flex-col">
                        <h4 className="font-semibold text-sm text-foreground mb-4">Add New Assets</h4>

                        <div className="relative flex flex-col items-center justify-center p-6 border-2 border-dashed border-border bg-muted/50 rounded-xl hover:bg-muted transition-colors cursor-pointer group">
                            <Input
                                type="file"
                                accept="image/*,application/pdf"
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
                                    <p className="text-[10px] text-muted-foreground">JPG, PNG, PDF supported (max {MAX_FILE_SIZE_MB}MB)</p>
                                </div>
                            </div>
                        </div>

                        {/* Upload Error Message */}
                        {uploadError && (
                            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2 text-red-800">
                                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                                <p className="text-xs">{uploadError}</p>
                            </div>
                        )}

                        <div className="mt-auto pt-6 border-t border-border">
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                <strong>Note:</strong> Images and PDFs are securely stored. Large PDFs are automatically compressed. Click the download icon on any image to save it as a PDF.
                            </p>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
};
