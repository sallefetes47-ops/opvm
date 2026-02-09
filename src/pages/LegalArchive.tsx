import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DateInput } from "@/components/ui/date-input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Scale, Plus, Eye, Trash2, Search, FileUp, AlertCircle, X } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { FileImport } from "@/components/FileImport";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface DocumentFormData {
  title_ar: string;
  title_fr: string;
  document_type: string;
  document_number: string;
  document_date: Date | undefined;
  description: string;
  content_text: string;
  keywords: string;
  language: string;
  file: File | null;
}

// Regex-based fallback parser for Arabic legal documents
function parseArabicLegalText(rawText: string, data: Record<string, any>): Record<string, any> {
  const result = { ...data };
  const text = rawText || data.content_text || data.raw_text || "";
  if (!text) return result;

  // Extract document number: مرسوم رقم XX-XX / قرار رقم / تعليمة رقم
  if (!result.document_number) {
    const numPatterns = [
      /(?:مرسوم|قرار|تعليمة|أمر|قانون|منشور)\s*(?:تنفيذي\s*)?(?:رقم|رقم:)\s*([\d\-\/\.]+)/,
      /رقم\s*:?\s*([\d\-\/\.]+)/,
      /n[°o]\s*([\d\-\/\.]+)/i,
    ];
    for (const p of numPatterns) {
      const m = text.match(p);
      if (m) { result.document_number = m[1].trim(); break; }
    }
  }

  // Extract document type
  if (!result.document_type) {
    const typeMap: [RegExp, string][] = [
      [/مرسوم\s*تنفيذي/, "مرسوم"],
      [/مرسوم\s*رئاسي/, "مرسوم"],
      [/مرسوم/, "مرسوم"],
      [/تعليمة/, "تعليمة"],
      [/قرار\s*وزاري|قرار/, "قرار"],
      [/منشور/, "منشور"],
      [/قانون/, "قانون"],
      [/أمر/, "أمر"],
    ];
    for (const [rx, type] of typeMap) {
      if (rx.test(text)) { result.document_type = type; break; }
    }
  }

  // Extract date: المؤرخ في / بتاريخ / الموافق
  if (!result.document_date) {
    // Try Gregorian patterns first (DD month YYYY or DD/MM/YYYY)
    const datePatterns = [
      /(?:المؤرخ في|بتاريخ|الموافق(?:\s*لـ?)?)\s*(\d{1,2})\s*(جانفي|فيفري|فبراير|يناير|مارس|أفريل|أبريل|ماي|مايو|جوان|يونيو|جويلية|يوليو|أوت|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)\s*(?:سنة\s*)?(\d{4})/,
      /(?:المؤرخ في|بتاريخ|الموافق)\s*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,
    ];
    const monthMap: Record<string, string> = {
      "جانفي": "01", "يناير": "01", "فيفري": "02", "فبراير": "02",
      "مارس": "03", "أفريل": "04", "أبريل": "04", "ماي": "05", "مايو": "05",
      "جوان": "06", "يونيو": "06", "جويلية": "07", "يوليو": "07",
      "أوت": "08", "أغسطس": "08", "سبتمبر": "09", "أكتوبر": "10",
      "نوفمبر": "11", "ديسمبر": "12",
    };
    const m1 = text.match(datePatterns[0]);
    if (m1) {
      const day = m1[1].padStart(2, "0");
      const month = monthMap[m1[2]] || "01";
      result.document_date = `${m1[3]}-${month}-${day}`;
    } else {
      const m2 = text.match(datePatterns[1]);
      if (m2) {
        result.document_date = `${m2[3]}-${m2[2].padStart(2, "0")}-${m2[1].padStart(2, "0")}`;
      }
    }
  }

  // Extract title from المتضمن / يتضمن / المتعلق بـ
  if (!result.title_ar) {
    const titlePatterns = [
      /(?:المتضمن|يتضمن|المتعلق\s*بـ?)\s*(.{10,150}?)(?:\.|،|$)/,
      /(?:الموضوع|موضوع)\s*:?\s*(.{10,150}?)(?:\.|،|$)/,
    ];
    for (const p of titlePatterns) {
      const m = text.match(p);
      if (m) { result.title_ar = m[1].trim(); break; }
    }
  }

  return result;
}

export default function LegalArchive() {
  const { user, role, isViewer } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [viewDocument, setViewDocument] = useState<any>(null);
  const [previewDocument, setPreviewDocument] = useState<any>(null);
  const [docToDelete, setDocToDelete] = useState<any>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(new Set());
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<DocumentFormData>({
    title_ar: "",
    title_fr: "",
    document_type: "",
    document_number: "",
    document_date: undefined,
    description: "",
    content_text: "",
    keywords: "",
    language: "ar",
    file: null,
  });

  const canEdit = !isViewer && role !== "viewer";

  const handleDataExtracted = (data: Record<string, any>) => {
    // Apply regex fallback parsing on the raw text
    const enriched = parseArabicLegalText(data.raw_text || data.content_text || "", data);

    const filled = new Set<string>();
    const newFormData: DocumentFormData = {
      title_ar: "",
      title_fr: "",
      document_type: "",
      document_number: "",
      document_date: undefined,
      description: "",
      content_text: "",
      keywords: "",
      language: "ar",
      file: null,
    };

    if (enriched.title_ar) { newFormData.title_ar = enriched.title_ar; filled.add("title_ar"); }
    if (enriched.title_fr) { newFormData.title_fr = enriched.title_fr; filled.add("title_fr"); }
    if (enriched.document_type) { newFormData.document_type = enriched.document_type; filled.add("document_type"); }
    if (enriched.document_number) { newFormData.document_number = enriched.document_number; filled.add("document_number"); }
    if (enriched.document_date) {
      const d = new Date(enriched.document_date);
      if (!isNaN(d.getTime())) { newFormData.document_date = d; filled.add("document_date"); }
    }
    if (enriched.description) { newFormData.description = enriched.description; filled.add("description"); }
    if (enriched.content_text) { newFormData.content_text = enriched.content_text; filled.add("content_text"); }
    if (enriched.keywords) {
      newFormData.keywords = Array.isArray(enriched.keywords) ? enriched.keywords.join(", ") : enriched.keywords;
      filled.add("keywords");
    }
    if (enriched.language) { newFormData.language = enriched.language; }

    setFormData(newFormData);
    setAutoFilledFields(filled);
    setIsAddDialogOpen(true);

    toast({
      title: "تم تعبئة الحقول",
      description: `تم ملء ${filled.size} حقول تلقائياً من الوثيقة`,
    });
  };

  const { data: documents, isLoading } = useQuery({
    queryKey: ["legal-documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legal_documents")
        .select("*")
        .order("document_date", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: DocumentFormData) => {
      let fileUrl = null;
      let fileName = null;

      // Upload file if provided
      if (data.file) {
        try {
          const fileName_local = `${Date.now()}_${data.file.name}`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("legal_documents")
            .upload(fileName_local, data.file, {
              cacheControl: "3600",
              upsert: false,
            });

          if (uploadError) throw uploadError;
          
          // Get public URL
          const { data: publicUrl } = supabase.storage
            .from("legal_documents")
            .getPublicUrl(fileName_local);
          
          fileUrl = publicUrl.publicUrl;
          fileName = fileName_local;
        } catch (error: any) {
          console.error("File upload error:", error);
          throw new Error(`فشل تحميل الملف: ${error.message}`);
        }
      }

      const { error } = await supabase.from("legal_documents").insert({
        title_ar: data.title_ar,
        title_fr: data.title_fr || null,
        document_type: data.document_type,
        document_number: data.document_number,
        document_date: data.document_date ? format(data.document_date, "yyyy-MM-dd") : null,
        description: data.description,
        content_text: data.content_text,
        keywords: data.keywords.split(",").map(k => k.trim()).filter(Boolean),
        language: data.language,
        file_url: fileUrl,
        file_name: fileName,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["legal-documents"] });
      toast({ title: "✅ تم الحفظ", description: "تم حفظ الوثيقة والملف بنجاح" });
      setIsAddDialogOpen(false);
      resetForm();
      setUploadProgress(0);
    },
    onError: (error) => {
      toast({ title: "❌ خطأ", description: error.message, variant: "destructive" });
      setUploadProgress(0);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // First get the document to retrieve file info
      const { data: docData } = await supabase
        .from("legal_documents")
        .select("file_name")
        .eq("id", id)
        .single();

      // Delete from storage if file exists
      if (docData?.file_name) {
        try {
          await supabase.storage
            .from("legal_documents")
            .remove([docData.file_name]);
        } catch (error) {
          console.warn("Storage deletion warning:", error);
          // Continue with DB deletion even if storage delete fails
        }
      }

      // Delete from database
      const { error } = await supabase.from("legal_documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["legal-documents"] });
      toast({ title: "✅ تم الحذف", description: "تم حذف الوثيقة والملف بنجاح" });
      setDeleteConfirmOpen(false);
      setDocToDelete(null);
    },
    onError: (error) => {
      toast({ title: "❌ خطأ", description: error.message, variant: "destructive" });
    },
  });

  // Helper to remove file from likely storage buckets
  const removeFromStorage = async (fileName: string | null) => {
    if (!fileName) return;
    const buckets = ["legal_documents", "documents", "files", "public"];
    for (const b of buckets) {
      try {
        const { error } = await supabase.storage.from(b).remove([fileName]);
        if (!error) {
          return; // removed successfully
        }
        // ignore not found - continue
      } catch (err) {
        // ignore and continue
        console.warn(`Storage remove attempt failed for bucket ${b}:`, err);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      title_ar: "",
      title_fr: "",
      document_type: "",
      document_number: "",
      document_date: undefined,
      description: "",
      content_text: "",
      keywords: "",
      language: "ar",
      file: null,
    });
    setAutoFilledFields(new Set());
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const autoFillClass = (field: string) =>
    autoFilledFields.has(field) ? "ring-2 ring-green-500/40 bg-green-500/5" : "";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title_ar || !formData.document_type) {
      toast({ title: "خطأ", description: "يرجى ملء الحقول المطلوبة (العنوان والنوع)", variant: "destructive" });
      return;
    }
    createMutation.mutate(formData);
  };

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

    setFormData({ ...formData, file });
  };

  const filteredDocuments = documents?.filter(d => {
    const term = searchTerm?.trim();
    if (term) {
      const matches = d.title_ar?.includes(term) || d.title_fr?.includes(term) || d.document_number?.includes(term) || d.content_text?.includes(term) || d.keywords?.some((k: string) => k.includes(term));
      if (!matches) return false;
    }
    if (typeFilter && typeFilter !== 'all') {
      if (d.document_type !== typeFilter) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
            <Scale className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">المراسيم والتعليمات</h1>
            <p className="text-muted-foreground">أرشيف الوثائق القانونية والتنظيمية</p>
          </div>
        </div>
        
        {canEdit && (
          <div className="flex gap-2">
            <FileImport
              documentType="legal_document"
              onDataExtracted={handleDataExtracted}
              buttonLabel="استيراد من ملف"
            />
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button style={{ backgroundColor: '#D4AF37', color: '#2D2926' }}>
                  <Plus className="w-4 h-4 ml-2" />
                  إضافة وثيقة
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>إضافة وثيقة قانونية</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>العنوان بالعربية *</Label>
                    <Input
                      value={formData.title_ar}
                      onChange={(e) => setFormData({ ...formData, title_ar: e.target.value })}
                      placeholder="أدخل العنوان بالعربية"
                      required
                      className={autoFillClass("title_ar")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>العنوان بالفرنسية</Label>
                    <Input
                      value={formData.title_fr}
                      onChange={(e) => setFormData({ ...formData, title_fr: e.target.value })}
                      placeholder="Titre en français"
                      dir="ltr"
                      className={autoFillClass("title_fr")}
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>نوع الوثيقة *</Label>
                    <Select
                      value={formData.document_type}
                      onValueChange={(value) => setFormData({ ...formData, document_type: value })}
                    >
                      <SelectTrigger className={autoFillClass("document_type")}>
                        <SelectValue placeholder="اختر النوع" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="مرسوم">مرسوم</SelectItem>
                        <SelectItem value="تعليمة">تعليمة</SelectItem>
                        <SelectItem value="إجراء">إجراء</SelectItem>
                        <SelectItem value="قرار">قرار</SelectItem>
                        <SelectItem value="منشور">منشور</SelectItem>
                        <SelectItem value="قانون">قانون</SelectItem>
                        <SelectItem value="أمر">أمر</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>رقم الوثيقة</Label>
                    <Input
                      value={formData.document_number}
                      onChange={(e) => setFormData({ ...formData, document_number: e.target.value })}
                      placeholder="مثال: 15-19"
                      className={autoFillClass("document_number")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>تاريخ الوثيقة</Label>
                    <DateInput
                      value={formData.document_date}
                      onChange={(date) => setFormData({ ...formData, document_date: date })}
                      placeholder="DD/MM/YYYY"
                      className={autoFillClass("document_date")}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>الوصف</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="وصف مختصر للوثيقة"
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>محتوى الوثيقة (للبحث)</Label>
                  <Textarea
                    value={formData.content_text}
                    onChange={(e) => setFormData({ ...formData, content_text: e.target.value })}
                    placeholder="أدخل نص الوثيقة أو جزء منه للبحث"
                    rows={4}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>الكلمات المفتاحية (مفصولة بفاصلة)</Label>
                    <Input
                      value={formData.keywords}
                      onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                      placeholder="تعمير، بناء، رخصة، ..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>اللغة</Label>
                    <Select
                      value={formData.language}
                      onValueChange={(value) => setFormData({ ...formData, language: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ar">العربية</SelectItem>
                        <SelectItem value="fr">الفرنسية</SelectItem>
                        <SelectItem value="both">ثنائي اللغة</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* File Upload Section */}
                <div className="space-y-2 border rounded-lg p-4 bg-slate-50">
                  <Label className="flex items-center gap-2">
                    <FileUp className="w-4 h-4" />
                    تحميل ملف PDF أو صورة (اختياري)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    الأنواع المدعومة: PDF, PNG, JPG, WEBP | الحد الأقصى: 20 ميجابايت
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full"
                    >
                      <FileUp className="w-4 h-4 ml-2" />
                      اختيار ملف
                    </Button>
                  </div>
                  {formData.file && (
                    <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded">
                      <span className="text-sm font-medium text-green-700">✓</span>
                      <span className="text-sm text-green-700 flex-1">{formData.file.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setFormData({ ...formData, file: null });
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    إلغاء
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} style={{ backgroundColor: '#D4AF37', color: '#2D2926' }}>
                    {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "حفظ"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        )}
      </div>
      {/* Search & Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-3 flex-col md:flex-row items-start md:items-center md:justify-between">
            <div className="relative flex-1 w-full md:flex-none md:min-w-80">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="بحث في الوثائق (العنوان، الرقم، الكلمات المفتاحية، المحتوى)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              <Label className="text-sm font-medium shrink-0">النوع:</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="اختر النوع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="مرسوم">المراسيم</SelectItem>
                  <SelectItem value="تعليمة">التعليمات</SelectItem>
                  <SelectItem value="إجراء">الإجراءات</SelectItem>
                  <SelectItem value="قرار">القرارات</SelectItem>
                  <SelectItem value="منشور">المنشورات</SelectItem>
                  <SelectItem value="قانون">القوانين</SelectItem>
                  <SelectItem value="أمر">الأوامر</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <img src="/Capture.PNG" alt="Bureau Logo" className="h-16 object-contain" />
            <CardTitle>قائمة الوثائق القانونية</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : filteredDocuments?.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">لا توجد وثائق</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>النوع</TableHead>
                  <TableHead>الرقم</TableHead>
                  <TableHead>العنوان</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>اللغة</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocuments?.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <span className="px-2 py-1 rounded-full text-xs bg-primary/10 text-primary">
                        {doc.document_type}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{doc.document_number || "-"}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{doc.title_ar}</TableCell>
                    <TableCell>
                      {doc.document_date ? format(new Date(doc.document_date), "d MMMM yyyy", { locale: ar }) : "-"}
                    </TableCell>
                    <TableCell>
                      {doc.language === "ar" ? "عربي" : doc.language === "fr" ? "فرنسي" : "ثنائي"}
                    </TableCell>
                    <TableCell>
                              <div className="flex gap-2">
                        <Button size="icon" variant="ghost" onClick={() => setPreviewDocument(doc)} title="عرض المعاينة">
                          <Eye className="w-5 h-5 text-blue-600 hover:text-blue-800" />
                        </Button>
                        {canEdit && role === "admin" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setDocToDelete(doc);
                              setDeleteConfirmOpen(true);
                            }}
                            title="حذف الوثيقة"
                          >
                            <Trash2 className="w-5 h-5 text-red-600 hover:text-red-800" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* View Dialog */}
      <Dialog open={!!viewDocument} onOpenChange={() => setViewDocument(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تفاصيل الوثيقة</DialogTitle>
          </DialogHeader>
              {viewDocument && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground">العنوان بالعربية</Label>
                  <p className="font-medium">{viewDocument.title_ar}</p>
                </div>
                {viewDocument.title_fr && (
                  <div>
                    <Label className="text-muted-foreground">العنوان بالفرنسية</Label>
                    <p className="font-medium" dir="ltr">{viewDocument.title_fr}</p>
                  </div>
                )}
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label className="text-muted-foreground">النوع</Label>
                  <p className="font-medium">{viewDocument.document_type}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">الرقم</Label>
                  <p className="font-medium">{viewDocument.document_number || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">التاريخ</Label>
                  <p className="font-medium">
                    {viewDocument.document_date ? format(new Date(viewDocument.document_date), "d MMMM yyyy", { locale: ar }) : "-"}
                  </p>
                </div>
              </div>
              {viewDocument.description && (
                <div>
                  <Label className="text-muted-foreground">الوصف</Label>
                  <p className="font-medium whitespace-pre-wrap">{viewDocument.description}</p>
                </div>
              )}
              {viewDocument.content_text && (
                <div>
                  <Label className="text-muted-foreground">المحتوى</Label>
                  <p className="font-medium whitespace-pre-wrap bg-muted p-3 rounded-lg max-h-60 overflow-y-auto">
                    {viewDocument.content_text}
                  </p>
                </div>
              )}
              {viewDocument.keywords?.length > 0 && (
                <div>
                  <Label className="text-muted-foreground">الكلمات المفتاحية</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {viewDocument.keywords.map((keyword: string, index: number) => (
                      <span key={index} className="px-2 py-1 rounded-full text-xs bg-primary/10 text-primary">
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* File preview if available */}
              {viewDocument.file_url && (
                <div>
                  <Label className="text-muted-foreground">المعاينة</Label>
                  <div className="border rounded p-2 mt-2">
                    {viewDocument.file_url.endsWith('.pdf') || viewDocument.file_url.includes('application/pdf') ? (
                      <iframe src={viewDocument.file_url} className="w-full h-[60vh]" title="PDF Preview" />
                    ) : (
                      <img src={viewDocument.file_url} alt={viewDocument.title_ar} className="w-full h-auto object-contain max-h-[60vh]" />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Preview Dialog (High-Resolution Modal) */}
      <Dialog open={!!previewDocument} onOpenChange={() => setPreviewDocument(null)}>
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto p-0" style={{ maxWidth: "90vw", maxHeight: "95vh" }}>
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="text-right">{previewDocument?.title_ar}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto p-4 bg-gradient-to-b from-slate-50 to-white min-h-96 flex items-center justify-center">
            {previewDocument?.file_url ? (
              previewDocument.file_url.endsWith('.pdf') || previewDocument.file_url.includes('application/pdf') ? (
                <iframe
                  src={previewDocument.file_url}
                  title="PDF Preview"
                  className="w-full h-[85vh] border rounded-lg shadow-lg"
                  style={{ minHeight: "600px" }}
                />
              ) : (
                <div className="flex items-center justify-center w-full">
                  <img
                    src={previewDocument.file_url}
                    alt={previewDocument.title_ar}
                    className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-lg"
                  />
                </div>
              )
            ) : (
              <div className="text-center text-muted-foreground space-y-2">
                <AlertCircle className="w-12 h-12 mx-auto opacity-50" />
                <p>لا توجد معاينة متاحة للوثيقة</p>
                <p className="text-sm">لم يتم تحميل أي ملف مع هذه الوثيقة</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog (Arabic) */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right">تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              هل أنت متأكد من حذف هذا الملف؟
              <br />
              <span className="font-semibold text-foreground mt-2 block">{docToDelete?.title_ar}</span>
              <br />
              <span className="text-sm text-destructive">هذا الإجراء لا يمكن التراجع عنه. سيتم حذف الملف من الخادم والقاعدة البيانية.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2 justify-end mt-4">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (docToDelete) {
                  deleteMutation.mutate(docToDelete.id);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  جاري الحذف...
                </>
              ) : (
                "حذف الملف"
              )}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
