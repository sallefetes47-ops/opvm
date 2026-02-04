import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Upload, FileText, Loader2, Sparkles } from "lucide-react";
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file type
      const validTypes = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif"];
      if (!validTypes.includes(file.type)) {
        toast({
          title: "نوع ملف غير مدعوم",
          description: "يرجى اختيار ملف PDF أو صورة (PNG, JPG, WEBP)",
          variant: "destructive",
        });
        return;
      }

      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "حجم الملف كبير جداً",
          description: "الحد الأقصى لحجم الملف هو 10 ميجابايت",
          variant: "destructive",
        });
        return;
      }

      setSelectedFile(file);
    }
  };

  const handleProcess = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("documentType", documentType);

      const { data, error } = await supabase.functions.invoke("extract-document", {
        body: formData,
      });

      if (error) {
        throw error;
      }

      if (data.success && data.data) {
        onDataExtracted(data.data);
        toast({
          title: "تم الاستخراج بنجاح",
          description: "تم استخراج البيانات من الملف وملء الحقول تلقائياً",
        });
        setIsOpen(false);
        setSelectedFile(null);
      } else {
        throw new Error("Failed to extract data");
      }
    } catch (error: any) {
      console.error("OCR Error:", error);
      toast({
        title: "فشل في استخراج البيانات",
        description: error.message || "حدث خطأ أثناء معالجة الملف",
        variant: "destructive",
      });
    }

    setIsProcessing(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
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
              اختر ملف PDF أو صورة للوثيقة
            </p>
            <Input
              ref={fileInputRef}
              type="file"
              accept=".pdf,image/png,image/jpeg,image/webp"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
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
                  {(selectedFile.size / 1024).toFixed(1)} كيلوبايت
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              إلغاء
            </Button>
            <Button
              onClick={handleProcess}
              disabled={!selectedFile || isProcessing}
              style={{ backgroundColor: '#D4AF37', color: '#2D2926' }}
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
