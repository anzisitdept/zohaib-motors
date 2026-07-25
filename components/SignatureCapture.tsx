"use client";
import { useRef, useState, forwardRef, useImperativeHandle } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eraser, Check, PenTool } from "lucide-react";

export interface SignatureCaptureRef {
    getSignatureDataURL: () => string | null;
    clear: () => void;
    isEmpty: () => boolean;
}

interface SignatureCaptureProps {
    onSave?: (dataURL: string) => void;
    existingSignature?: string;
    label?: string;
}

export const SignatureCapture = forwardRef<SignatureCaptureRef, SignatureCaptureProps>(
    ({ onSave, existingSignature, label = "Signature" }, ref) => {
        const sigCanvas = useRef<SignatureCanvas>(null);
        const [hasDrawn, setHasDrawn] = useState(false);

        useImperativeHandle(ref, () => ({
            getSignatureDataURL: () => {
                if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
                    return sigCanvas.current.toDataURL("image/png");
                }
                return null;
            },
            clear: () => {
                sigCanvas.current?.clear();
                setHasDrawn(false);
            },
            isEmpty: () => {
                return sigCanvas.current?.isEmpty() ?? true;
            },
        }));

        const handleClear = () => {
            sigCanvas.current?.clear();
            setHasDrawn(false);
        };

        const handleSave = () => {
            if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
                const dataURL = sigCanvas.current.toDataURL("image/png");
                onSave?.(dataURL);
            }
        };

        const handleBegin = () => {
            setHasDrawn(true);
        };

        return (
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground flex items-center gap-2">
                        <PenTool size={14} />
                        {label}
                    </label>
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleClear}
                            disabled={!hasDrawn}
                            className="gap-1.5"
                        >
                            <Eraser size={14} />
                            Clear
                        </Button>
                        {onSave && (
                            <Button
                                type="button"
                                size="sm"
                                onClick={handleSave}
                                disabled={!hasDrawn}
                                className="gap-1.5"
                            >
                                <Check size={14} />
                                Save
                            </Button>
                        )}
                    </div>
                </div>

                {existingSignature ? (
                    <Card className="p-4 bg-muted border-border">
                        <div className="space-y-2">
                            <p className="text-xs text-muted-foreground">Current Signature:</p>
                            <div className="bg-card border border-border rounded p-2 flex items-center justify-center">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={existingSignature}
                                    alt="Current signature"
                                    className="max-h-20 object-contain"
                                />
                            </div>
                            <p className="text-xs text-muted-foreground italic">
                                Draw a new signature below to replace
                            </p>
                        </div>
                    </Card>
                ) : null}

                <Card className="p-0 overflow-hidden border-2 border-slate-300 bg-card">
                    <SignatureCanvas
                        ref={sigCanvas}
                        canvasProps={{
                            className: "w-full h-40 touch-none cursor-crosshair",
                            style: { touchAction: "none" },
                        }}
                        backgroundColor="rgb(255, 255, 255)"
                        penColor="rgb(15, 23, 42)"
                        minWidth={1}
                        maxWidth={2.5}
                        onBegin={handleBegin}
                    />
                </Card>

                <p className="text-xs text-muted-foreground italic">
                    Draw your signature above using mouse or touch
                </p>
            </div>
        );
    }
);

SignatureCapture.displayName = "SignatureCapture";
