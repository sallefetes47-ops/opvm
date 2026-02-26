﻿import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, Loader2, Sparkles, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface FileImportProps {
  documentType: "meeting_minutes" | "summons" | "legal_document";
  onDataExtracted: (data: Record<string, any>) => void;
  buttonLabel?: string;
}

export function FileImport({ documentType, onDataExtracted, buttonLabel = "استيراد من ملف" }: FileImportProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "نوع ملف غير مدعوم",
        description: "يرجى اختيار ملف PDF أو صورة (PNG, JPG, WEBP)",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast({
        title: "حجم الملف كبير جداً",
        description: "الحد الأقصى لحجم الملف هو 20 ميجابايت",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
  };

  const handleProcess = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setProgress(10);
    setStatusText("جاري تحميل الملف...");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("documentType", documentType);

      setProgress(30);
      const isPdf = selectedFile.type === "application/pdf";
      const sizeMB = selectedFile.size / (1024 * 1024);

      if (isPdf && sizeMB > 2) {
        setStatusText(`جاري معالجة ملف PDF (${sizeMB.toFixed(1)} م.ب)... قد يستغرق هذا بعض الوقت`);
      } else {
        setStatusText("جاري استخراج البيانات بالذكاء الاصطناعي...");
      }

      // Simulate gradual progress while waiting for the API
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 85) return prev;
          return prev + (isPdf && sizeMB > 2 ? 2 : 5);
        });
      }, 1000);

      const { data, error } = await supabase.functions.invoke("extract-document", {
        body: formData,
      });

      clearInterval(progressInterval);
      setProgress(95);
      setStatusText("جاري تحليل النتائج...");

      if (error) throw error;

      if (data.success && data.data) {
        setProgress(100);
        setStatusText("تم بنجاح!");

        // Show warnings for partial failures
        if (data.errors && data.errors.length > 0) {
          toast({
            title: "تم الاستخراج مع بعض التحذيرات",
            description: `تم استخراج البيانات لكن ${data.errors.length} أجزاء فشلت. تم تجاوزها.`,
          });
        } else {
          toast({
            title: "تم الاستخراج بنجاح",
            description: "تم استخراج البيانات من الملف وملء الحقول تلقائياً",
          });
        }

        // Pass raw_response so the page can do regex fallback parsing
        const extractedData = { ...data.data };
        if (data.raw_response) {
          extractedData.raw_text = data.raw_response;
        }
        onDataExtracted(extractedData);
        setTimeout(() => {
          setIsOpen(false);
          setSelectedFile(null);
          setProgress(0);
          setStatusText("");
        }, 500);
      } else {
        throw new Error(data.error || "فشل في استخراج البيانات");
      }
    } catch (error: any) {
      console.error("OCR Error:", error);
      setProgress(0);
      setStatusText("");
      toast({
        title: "فشل في استخراج البيانات",
        description: error.message || "حدث خطأ أثناء معالجة الملف. حاول بملف أصغر أو صورة.",
        variant: "destructive",
      });
    }

    setIsProcessing(false);
  };

  const fileSizeMB = selectedFile ? (selectedFile.size / (1024 * 1024)).toFixed(1) : "0";
  const isLargeFile = selectedFile && selectedFile.size > 4 * 1024 * 1024;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!isProcessing) setIsOpen(open); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Sparkles className="w-4 h-4" />
          {buttonLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>استيراد ملف وتعبئة البيانات تلقائياً</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
            <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground mb-4">
              اختر ملف PDF أو صورة للوثيقة (حتى 20 م.ب)
            </p>
            <Input
              ref={fileInputRef}
              type="file"
              accept=".pdf,image/png,image/jpeg,image/webp"
              onChange={handleFileSelect}
              className="hidden"
              disabled={isProcessing}
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
            >
              <FileText className="w-4 h-4 ml-2" />
              اختيار ملف
            </Button>
          </div>

          {selectedFile && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <FileText className="w-5 h-5 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {fileSizeMB} م.ب
                </p>
              </div>
            </div>
          )}

          {isLargeFile && !isProcessing && (
            <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-muted-foreground">
                هذا ملف كبير ({fileSizeMB} م.ب). قد تستغرق المعالجة وقتاً أطول. يُفضل استخدام ملفات أقل من 4 م.ب للحصول على نتائج أسرع.
              </p>
            </div>
          )}

          {isProcessing && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">{statusText}</p>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isProcessing}>
              إلغاء
            </Button>
            <Button
              onClick={handleProcess}
              disabled={!selectedFile || isProcessing}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  جاري المعالجة...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 ml-2" />
                  استخراج البيانات
                </>
              )}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            سيتم استخدام الذكاء الاصطناعي لاستخراج المعلومات من الوثيقة وتعبئة الحقول تلقائياً
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
