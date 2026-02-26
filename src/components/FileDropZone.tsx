﻿﻿import { useState, useRef } from "react";
import { Upload, FileText, X, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface FileDropZoneProps {
    onFileSelect: (file: File) => void;
    selectedFile: File | null;
    onClear: () => void;
    accept?: string;
    maxSizeMB?: number; // Default 20MB
}

export function FileDropZone({
    onFileSelect,
    selectedFile,
    onClear,
    accept = ".pdf,image/png,image/jpeg,image/webp",
    maxSizeMB = 20
}: FileDropZoneProps) {
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            validateAndSetFile(file);
        }
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            validateAndSetFile(e.target.files[0]);
        }
    };

    const validateAndSetFile = (file: File) => {
        // Basic validation msg could be handled by parent or toast, 
        // but here we just pass it up if valid-ish. 
        // The parent logic (hashing etc) takes over.
        if (file.size > maxSizeMB * 1024 * 1024) {
            alert(`File size exceeds available limit of ${maxSizeMB}MB`); // Simple alert, or rely on parent
            return;
        }
        onFileSelect(file);
    };

    return (
        <div className="w-full">
            {!selectedFile ? (
                <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                        "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ease-in-out",
                        isDragging
                            ? "border-primary bg-primary/10 scale-[1.02]"
                            : "border-slate-200 dark:border-slate-700 hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-slate-900/50"
                    )}
                >
                    <div className="flex flex-col items-center gap-3">
                        <div className={cn(
                            "p-3 rounded-full transition-colors",
                            isDragging ? "bg-primary/20" : "bg-slate-100 dark:bg-slate-800"
                        )}>
                            <Upload className={cn(
                                "w-6 h-6",
                                isDragging ? "text-primary" : "text-slate-400"
                            )} />
                        </div>
                        <div className="space-y-1">
                            <p className="font-medium text-sm">
                                <span className="text-primary hover:underline">Click to upload</span> or drag and drop
                            </p>
                            <p className="text-xs text-muted-foreground">
                                PDF, PNG, JPG (Max {maxSizeMB}MB)
                            </p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="relative border rounded-xl p-4 bg-slate-50 dark:bg-slate-900/50 flex items-center gap-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate pr-2" title={selectedFile.name}>
                            {selectedFile.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive shrink-0"
                        onClick={(e) => {
                            e.stopPropagation();
                            onClear();
                        }}
                    >
                        <X className="w-4 h-4" />
                    </Button>
                    <div className="absolute -top-2 -right-2">
                        <CheckCircle className="w-5 h-5 text-green-500 bg-white dark:bg-slate-900 rounded-full" />
                    </div>
                </div>
            )}

            <input
                ref={fileInputRef}
                type="file"
                accept={accept}
                onChange={handleFileInput}
                className="hidden"
            />
        </div>
    );
}
