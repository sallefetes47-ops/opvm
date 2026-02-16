import { useState, useRef, useCallback, useEffect } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Loader2, Scale, Plus, Eye, Trash2, Search, Pencil, Upload, FileText, RefreshCw, X, Sparkles, AlertTriangle, ChevronDown, ExternalLink, RefreshCcw, Trash } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { FileImport } from "@/components/FileImport";

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
      /(?:المؤرخ في|بتاريخ|الموافق(?:\s*لـ?)?)\s*(\d{1,2})\s*(جانفي|فيفري|فبراير|يناير|مارس|أفريل|أبريل|ماي|مايو|جوان|يونيو|جويلية|يوليو|أوت|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)\s*(?:سنة\s*)?(\d{4})/i,
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
      const monthKey = m1[2].toLowerCase();
      const month = Object.keys(monthMap).find(k => k.includes(monthKey)) ? monthMap[Object.keys(monthMap).find(k => k.includes(monthKey))!] : "01";
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



const STORAGE_KEY = "opvm_documents";

const mockDocuments = [
  { id: "1", title_ar: "مرسوم تنفيذي 23-14", document_type: "مرسوم", document_number: "23-14", document_date: "2023-01-15", status: "active", description: "يحدد كيفيات تطبيق أحكام القانون..." },
  { id: "2", title_ar: "قرار وزاري مشترك", document_type: "قرار", document_number: "22-55", document_date: "2022-11-20", status: "active", description: "يتضمن المصادقة على المخطط التوجيهي..." },
  { id: "3", title_ar: "تعليمة رقم 05", document_type: "تعليمة", document_number: "05", document_date: "2024-02-01", status: "active", description: "تتعلّق بتسهيل إجراءات منح رخص البناء..." }
];

const loadDocs = () => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return JSON.parse(saved);
  const initialData = mockDocuments.map(doc => ({ ...doc, status: doc.status || 'active' }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
  return initialData;
};

const readFileAsBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export default function LegalArchive() {
  const { user, role, isViewer } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [viewDocument, setViewDocument] = useState<any>(null);
  const [previewDocument, setPreviewDocument] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(new Set());
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
  });

  // ── Edit state ──
  const [editDocument, setEditDocument] = useState<any>(null);
  const [editFormData, setEditFormData] = useState<DocumentFormData>({
    title_ar: "", title_fr: "", document_type: "", document_number: "",
    document_date: undefined, description: "", content_text: "", keywords: "", language: "ar",
  });
  const [isReplacingFile, setIsReplacingFile] = useState(false);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newFileUrl, setNewFileUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // ── Local State for Immediate UI Updates ──
  const [allDocuments, setAllDocuments] = useState<any[]>(loadDocs());
  const [showRecycleBin, setShowRecycleBin] = useState(false);

  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStatus, setAnalysisStatus] = useState("");
  const editFileInputRef = useRef<HTMLInputElement>(null);
  // ── Smart file cache: stores Blob URLs keyed by document ID ──
  const fileCache = useRef<Record<string, string>>({});

  const canEdit = !isViewer && role !== "viewer";

  // ── Smart View Original File handler ──
  const handleViewOriginalFile = useCallback((doc: any) => {
    if (!doc.file_url) {
      toast({
        title: "غير متوفر",
        description: "عذراً، رابط الملف الأصلي غير متوفر لهذه الوثيقة",
        variant: "destructive",
      });
      return;
    }

    // Open the file directly in a new tab
    window.open(doc.file_url, '_blank', 'noopener,noreferrer');
  }, [toast]);

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

  // ── Replace useQuery with Local State ──
  // const { data: documents } = useQuery... (Removed for Local Storage Override)

  // ── Sync Helper ──
  const syncToStorage = (newDocs: any[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newDocs));
    setAllDocuments(newDocs);
  };

  const createMutation = useMutation({
    mutationFn: async ({ data, file }: { data: DocumentFormData; file: File | null }) => {
      // PROMISE WRAPPER FOR SYNC LOCAL STORAGE
      return new Promise<void>(async (resolve) => {
        let fileBase64 = null;
        let fileName = null;
        if (file) {
          try {
            fileBase64 = await readFileAsBase64(file);
            fileName = file.name;
          } catch (e) {
            console.error("File read error", e);
          }
        }

        const newDoc = {
          id: crypto.randomUUID(),
          ...data,
          document_date: data.document_date ? format(data.document_date, "yyyy-MM-dd") : null,
          keywords: data.keywords.split(",").map(k => k.trim()).filter(Boolean),
          created_at: new Date().toISOString(),
          status: 'active',
          file_base64: fileBase64,
          file_name: fileName || undefined
        };
        const current = loadDocs();
        const updated = [newDoc, ...current];
        syncToStorage(updated);
        resolve();
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["legal-documents"] }); // No-op really
      toast({ title: "تم الحفظ", description: "تم حفظ الوثيقة محلياً بنجاح" });
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, file }: { id: string; data: DocumentFormData; file: File | null }) => {
      return new Promise<void>(async (resolve) => {
        let fileBase64 = null;
        let fileName = null;
        if (file) {
          try {
            fileBase64 = await readFileAsBase64(file);
            fileName = file.name;
          } catch (e) { console.error(e); }
        }

        const current = loadDocs();
        const updated = current.map((doc: any) => {
          if (doc.id === id) {
            return {
              ...doc,
              ...data,
              document_date: data.document_date ? format(data.document_date, "yyyy-MM-dd") : null,
              keywords: data.keywords.split(",").map(k => k.trim()).filter(Boolean),
              // Update file if new one provided, else keep old
              file_base64: fileBase64 || doc.file_base64,
              file_name: fileName || doc.file_name
            };
          }
          return doc;
        });
        syncToStorage(updated);
        resolve();
      });
    },
    onSuccess: () => {
      toast({ title: "تم التحديث", description: "تم تحديث الوثيقة محلياً بنجاح" });
      closeEditModal();
    },
    onError: (error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  // Helper to remove file from likely storage buckets
  const removeFromStorage = async (fileName: string | null) => {
    if (!fileName) return;
    const buckets = ["documents", "legal_documents", "files", "public"];
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
    });
    setAutoFilledFields(new Set());
  };

  // ── Edit handlers ──
  const openEditModal = (doc: any) => {
    setEditFormData({
      title_ar: doc.title_ar || "",
      title_fr: doc.title_fr || "",
      document_type: doc.document_type || "",
      document_number: doc.document_number || "",
      document_date: doc.document_date ? new Date(doc.document_date) : undefined,
      description: doc.description || "",
      content_text: doc.content_text || "",
      keywords: Array.isArray(doc.keywords) ? doc.keywords.join(", ") : (doc.keywords || ""),
      language: doc.language || "ar",
    });
    setEditDocument(doc);
    setIsReplacingFile(false);
    setNewFile(null);
    setNewFileUrl(null);
    setUploadProgress(0);
  };

  const closeEditModal = () => {
    if (newFileUrl) URL.revokeObjectURL(newFileUrl);
    setEditDocument(null);
    setIsReplacingFile(false);
    setNewFile(null);
    setNewFileUrl(null);
    setUploadProgress(0);
  };

  const handleEditFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) {
      toast({ title: "حجم الملف كبير", description: "الحد الأقصى 20 م.ب", variant: "destructive" });
      return;
    }
    if (newFileUrl) URL.revokeObjectURL(newFileUrl);
    setNewFile(f);
    setNewFileUrl(URL.createObjectURL(f));
  };

  const handleAnalyzeNewFile = async () => {
    if (!newFile) return;

    setIsAnalyzing(true);
    setAnalysisProgress(10);
    setAnalysisStatus("جاري تحضير الملف...");

    try {
      const formData = new FormData();
      formData.append("file", newFile);
      formData.append("documentType", "legal_document");

      setAnalysisProgress(30);
      setAnalysisStatus("جاري استخراج البيانات بالذكاء الاصطناعي...");

      // Simulate progress
      const progressInterval = setInterval(() => {
        setAnalysisProgress(prev => {
          if (prev >= 85) return prev;
          return prev + 5;
        });
      }, 800);

      const { data, error } = await supabase.functions.invoke("extract-document", {
        body: formData,
      });

      clearInterval(progressInterval);
      setAnalysisProgress(95);

      if (error) throw error;

      if (data.success && data.data) {
        setAnalysisProgress(100);
        setAnalysisStatus("تم التحليل بنجاح!");

        // Merge extracted data
        const extracted = data.data;
        const enriched = parseArabicLegalText(data.raw_response || extracted.content_text || "", extracted);

        setEditFormData(prev => ({
          ...prev,
          title_ar: enriched.title_ar || prev.title_ar,
          title_fr: enriched.title_fr || prev.title_fr,
          document_type: enriched.document_type || prev.document_type,
          document_number: enriched.document_number || prev.document_number,
          document_date: enriched.document_date ? new Date(enriched.document_date) : prev.document_date,
          description: enriched.description || prev.description,
          content_text: enriched.content_text || prev.content_text,
          keywords: Array.isArray(enriched.keywords) ? enriched.keywords.join(", ") : (enriched.keywords || prev.keywords),
          language: enriched.language || prev.language,
        }));

        toast({
          title: "تم التحليل",
          description: "تم تحديث الحقول بناءً على محتوى الملف الجديد",
        });
      }
    } catch (err: any) {
      console.error("Analysis Error:", err);
      toast({
        title: "فشل التحليل",
        description: err.message || "حدث خطأ أثناء تحليل الملف",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress(0);
      setAnalysisStatus("");
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDocument) return;
    if (!editFormData.title_ar || !editFormData.document_type) {
      toast({ title: "خطأ", description: "يرجى ملء الحقول المطلوبة", variant: "destructive" });
      return;
    }
    updateMutation.mutate({ id: editDocument.id, data: editFormData, file: newFile });
  };

  const autoFillClass = (field: string) =>
    autoFilledFields.has(field) ? "ring-2 ring-green-500/40 bg-green-500/5" : "";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (createMutation.isPending) return; // Prevent double submission
    if (!formData.title_ar || !formData.document_type) {
      toast({ title: "خطأ", description: "يرجى ملء الحقول المطلوبة", variant: "destructive" });
      return;
    }
    createMutation.mutate({ data: formData, file: newFile });
  };

  // ── Explicit Handlers (per User Request) ──

  const handleSoftDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();

    // 1. Mutate local storage directly
    let currentDocs = loadDocs();
    currentDocs = currentDocs.map((doc: any) =>
      doc.id === id ? { ...doc, status: 'trashed' } : doc
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentDocs));

    // 2. Sync React State immediately
    setAllDocuments(currentDocs);
    toast({ title: "تم النقل للمحذوفات", description: "تم نقل الملف إلى سلة المحذوفات محلياً" });
  };

  const handleRestore = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    let currentDocs = loadDocs();
    currentDocs = currentDocs.map((doc: any) =>
      doc.id === id ? { ...doc, status: 'active' } : doc
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentDocs));
    setAllDocuments(currentDocs);
    toast({ title: "تم الاسترجاع", description: "تم استرجاع الملف بنجاح" });
  };

  const handlePermanentDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm("حذف نهائي! لا يمكن التراجع. هل أنت متأكد؟")) return;

    let currentDocs = loadDocs();
    currentDocs = currentDocs.filter((doc: any) => doc.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentDocs));
    setAllDocuments(currentDocs);
    toast({ title: "تم الحذف نهائياً", description: "تم حذف الملف من قاعدة البيانات المحلية" });
  };

  const handleViewOriginal = (e: React.MouseEvent, fileUrl: string | null, fileBase64?: string | null) => {
    e.stopPropagation(); // Stop row click

    // 1. If it's a newly uploaded file stored as Base64 in localStorage
    if (fileBase64) {
      const win = window.open();
      if (win) {
        win.document.write(`<iframe src="${fileBase64}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
      } else {
        toast({ title: "محظور", description: "يرجى السماح بالنوافذ المنبثقة (Pop-ups) في متصفحك", variant: "destructive" });
      }
      return;
    }

    // 2. If it's a standard web URL
    if (fileUrl && fileUrl.trim() !== "") {
      window.open(fileUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    // 3. If it's mock data with no actual file attached
    toast({ title: "خطأ", description: "عذراً، هذا الملف تجريبي ولا يحتوي على وثيقة أصلية مرفقة.", variant: "destructive" });
  };


  const filteredDocuments = allDocuments?.filter(d => {
    // 1. Recycle Bin Filter
    const isTrashed = d.status === 'trashed';
    if (showRecycleBin) {
      if (!isTrashed) return false;
    } else {
      if (isTrashed) return false;
    }

    const term = searchTerm?.trim();
    if (term) {
      const searchContent = `${d.title_ar || ''} ${d.title_fr || ''} ${d.document_number || ''} ${d.content_text || ''} ${(d.keywords || []).join(' ')}`;
      if (!searchContent.includes(term)) return false;
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
                        <SelectTrigger className={cn(autoFillClass("document_type"), "text-right flex flex-row-reverse items-center justify-between")}>
                          <SelectValue placeholder="اختر النوع" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="مرسوم">مرسوم</SelectItem>
                          <SelectItem value="قرار">قرار</SelectItem>
                          <SelectItem value="تعليمة">تعليمة</SelectItem>
                          <SelectItem value="منشور">منشور</SelectItem>
                          <SelectItem value="قانون">قانون</SelectItem>
                          <SelectItem value="أمر">أمر</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>رقم الملف</Label>
                      <Input
                        value={formData.document_number}
                        onChange={(e) => setFormData({ ...formData, document_number: e.target.value })}
                        placeholder="الرقم / السنة"
                        className={autoFillClass("document_number")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>تاريخ الوثيقة</Label>
                      <DateInput
                        value={formData.document_date}
                        onChange={(date) => setFormData({ ...formData, document_date: date })}
                        placeholder="يوم/شهر/سنة"
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
                      className={autoFillClass("description")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>محتوى الوثيقة (للبحث)</Label>
                    <Textarea
                      value={formData.content_text}
                      onChange={(e) => setFormData({ ...formData, content_text: e.target.value })}
                      placeholder="أدخل نص الوثيقة أو جزء منه للبحث"
                      rows={4}
                      className={autoFillClass("content_text")}
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>الكلمات المفتاحية (مفصولة بفاصلة)</Label>
                      <Input
                        value={formData.keywords}
                        onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                        placeholder="تعمير، بناء، رخصة، ..."
                        className={autoFillClass("keywords")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>اللغة</Label>
                      <Select
                        value={formData.language}
                        onValueChange={(value) => setFormData({ ...formData, language: value })}
                      >
                        <SelectTrigger className="text-right flex flex-row-reverse items-center justify-between">
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
            <Button
              variant={showRecycleBin ? "destructive" : "outline"}
              onClick={() => setShowRecycleBin(!showRecycleBin)}
              className="gap-2"
            >
              <Trash2 className="w-4 h-4" />
              {showRecycleBin ? "العودة للأرشيف" : "سلة المحذوفات"}
            </Button>
          </div>
        )}
      </div>
      {/* Search & Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-3 flex-col md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="بحث في الوثائق (العنوان، الرقم، الكلمات المفتاحية، المحتوى)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm shrink-0">النوع:</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="الكل" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="مرسوم">مرسوم</SelectItem>
                  <SelectItem value="قرار">قرار</SelectItem>
                  <SelectItem value="تعليمة">تعليمة</SelectItem>
                  <SelectItem value="منشور">منشور</SelectItem>
                  <SelectItem value="قانون">قانون</SelectItem>
                  <SelectItem value="أمر">أمر</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {showRecycleBin ? "سلة المحذوفات (وثائق محذوفة)" : "قائمة الوثائق القانونية"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {false ? ( // isLoading bypassed
            <div className="flex justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : filteredDocuments?.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">لا توجد وثائق مطابقة للبحث</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>النوع</TableHead>
                  <TableHead>رقم الملف</TableHead>
                  <TableHead>العنوان</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>اللغة</TableHead>
                  <TableHead className="text-left">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocuments?.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <span className={cn(
                        "px-2 py-1 rounded-full text-xs",
                        doc.document_type === 'مرسوم' && 'bg-blue-100 text-blue-800',
                        doc.document_type === 'قرار' && 'bg-green-100 text-green-800',
                        doc.document_type === 'تعليمة' && 'bg-yellow-100 text-yellow-800',
                        doc.document_type === 'منشور' && 'bg-indigo-100 text-indigo-800',
                        doc.document_type === 'قانون' && 'bg-red-100 text-red-800',
                        doc.document_type === 'أمر' && 'bg-purple-100 text-purple-800',
                      )}>
                        {doc.document_type}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">
                      {doc.document_number && doc.document_date
                        ? `${doc.document_number} / ${new Date(doc.document_date).getFullYear()}`
                        : doc.document_number || "-"}
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate" title={doc.title_ar}>{doc.title_ar}</TableCell>
                    <TableCell>
                      {doc.document_date ? format(new Date(doc.document_date), "d MMMM yyyy", { locale: ar }) : "-"}
                    </TableCell>
                    <TableCell>
                      {doc.language === "ar" ? "العربية" : doc.language === "fr" ? "الفرنسية" : "ثنائي اللغة"}
                    </TableCell>
                    <TableCell>
                      <TooltipProvider delayDuration={200}>
                        <div className="flex flex-row gap-4 items-center justify-center">
                          {/* Edit */}
                          {canEdit && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEditModal(doc);
                                  }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top"><p>تعديل</p></TooltipContent>
                            </Tooltip>
                          )}
                          {/* View Summary */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewDocument(doc);
                                }}
                              >
                                <Eye className="h-5 w-5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top"><p>عرض الملخص</p></TooltipContent>
                          </Tooltip>
                          {/* View Original File */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                                disabled={!doc.file_url && !doc.file_base64}
                                onClick={(e) => handleViewOriginal(e, doc.file_url, doc.file_base64)}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top"><p>معاينة الملف الأصلي</p></TooltipContent>
                          </Tooltip>
                          {/* Recycle Bin Actions */}
                          {showRecycleBin ? (
                            <>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="text-green-600 hover:text-green-800 hover:bg-green-50"
                                    onClick={(e) => handleRestore(e, doc.id)}
                                  >
                                    <RefreshCcw className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>استرجاع</p></TooltipContent>
                              </Tooltip>

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="text-red-600 hover:text-red-800 hover:bg-red-50"
                                    onClick={(e) => handlePermanentDelete(e, doc.id)}
                                  >
                                    <Trash className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>حذف نهائي</p></TooltipContent>
                              </Tooltip>
                            </>
                          ) : (
                            /* Normal Actions */
                            canEdit && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                    onClick={(e) => handleSoftDelete(e, doc.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top"><p>حذف (نقل للسلة)</p></TooltipContent>
                              </Tooltip>
                            )
                          )}
                        </div>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                )) ?? <TableRow><TableCell colSpan={6} className="text-center">لا يوجد</TableCell></TableRow>}
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
            <div className="space-y-4 py-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground">العنوان بالعربية</Label>
                  <p className="font-medium text-lg">{viewDocument.title_ar}</p>
                </div>
                {viewDocument.title_fr && (
                  <div>
                    <Label className="text-muted-foreground">العنوان بالفرنسية</Label>
                    <p className="font-medium text-lg" dir="ltr">{viewDocument.title_fr}</p>
                  </div>
                )}
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label className="text-muted-foreground">النوع</Label>
                  <p className="font-medium">{viewDocument.document_type}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">رقم الملف</Label>
                  <p className="font-medium">
                    {viewDocument.document_number && viewDocument.document_date
                      ? `${viewDocument.document_number} / ${new Date(viewDocument.document_date).getFullYear()}`
                      : viewDocument.document_number || "-"}
                  </p>
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
              {viewDocument.content_text && (
                <div>
                  <Label className="text-muted-foreground">المحتوى النصي</Label>
                  <pre className="font-mono text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-lg max-h-60 overflow-y-auto border">
                    {viewDocument.content_text}
                  </pre>
                </div>
              )}

              {/* File preview if available */}
              {viewDocument.file_url && (
                <div className="space-y-2 pt-4">
                  <Label className="text-muted-foreground">معاينة الملف المرفق</Label>
                  <div className="border rounded-lg p-2 mt-2 h-[60vh] overflow-hidden">
                    {viewDocument.file_url.endsWith('.pdf') || viewDocument.file_url.includes('application/pdf') ? (
                      <iframe src={viewDocument.file_url} className="w-full h-full" title="PDF Preview" />
                    ) : (
                      <img src={viewDocument.file_url} alt={viewDocument.title_ar} className="w-full h-full object-contain" />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Preview Dialog (embedded PDF/Image) */}
      <Dialog open={!!previewDocument} onOpenChange={() => setPreviewDocument(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>معاينة الوثيقة</DialogTitle>
          </DialogHeader>
          {previewDocument && (
            <div>
              {previewDocument.file_url ? (
                previewDocument.file_url.endsWith('.pdf') || previewDocument.file_url.includes('application/pdf') ? (
                  <iframe src={previewDocument.file_url} title="PDF Preview" className="w-full h-[80vh]" />
                ) : (
                  <img src={previewDocument.file_url} alt={previewDocument.title_ar} className="w-full h-auto object-contain max-h-[80vh]" />
                )
              ) : (
                <p className="text-center text-muted-foreground">لا توجد معاينة للوثيقة</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══════ EDIT DOCUMENT DIALOG (Dual Preview) ═══════ */}
      <Dialog open={!!editDocument} onOpenChange={(open) => { if (!open && !isAnalyzing) closeEditModal(); }}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary" />
              تعديل بيانات الملف
            </DialogTitle>
          </DialogHeader>

          {editDocument && (
            <div className="flex flex-col gap-6">
              {/* ── TOP SECTION: File Preview / Management ── */}
              <div className="relative w-full h-[300px] overflow-hidden rounded-xl border z-0 mb-4">
                <div className="border rounded-lg bg-muted/10 flex flex-col h-full overflow-hidden">
                  <div className="p-3 border-b bg-muted/40 flex items-center justify-between">
                    <Label className="flex items-center gap-2 font-semibold">
                      <FileText className="w-4 h-4 text-primary" />
                      {newFile ? "الملف الجديد (قيد الإضافة)" : "الملف الحالي"}
                    </Label>
                    {!isReplacingFile && !newFile && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsReplacingFile(true)}
                        className="gap-1 h-7 text-xs"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        تغيير الملف
                      </Button>
                    )}
                    {(isReplacingFile || newFile) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive h-7 text-xs gap-1"
                        onClick={() => {
                          if (newFileUrl) URL.revokeObjectURL(newFileUrl);
                          setNewFile(null);
                          setNewFileUrl(null);
                          setIsReplacingFile(false);
                          setAnalysisStatus("");
                        }}
                      >
                        <X className="w-3.5 h-3.5" />
                        إلغاء التغيير
                      </Button>
                    )}
                  </div>

                  <div className="flex-1 overflow-hidden relative bg-slate-100 flex flex-col justify-center items-center">
                    {!isReplacingFile && !newFile ? (
                      /* Current File View */
                      editDocument.file_url ? (
                        editDocument.file_url.endsWith('.pdf') || editDocument.file_url.includes('application/pdf') ? (
                          <iframe src={editDocument.file_url} className="w-full h-full" title="Current PDF" />
                        ) : (
                          <div className="p-4 w-full h-full flex items-center justify-center overflow-auto">
                            <img src={editDocument.file_url} alt="Current" className="max-w-full max-h-full object-contain shadow-md" />
                          </div>
                        )
                      ) : (
                        <div className="text-center p-8 text-muted-foreground">
                          <FileText className="w-16 h-16 mx-auto mb-2 opacity-20" />
                          <p>لا يوجد ملف مرفق حالياً</p>
                          <Button variant="outline" className="mt-4" onClick={() => setIsReplacingFile(true)}>
                            <Upload className="w-4 h-4 ml-2" />
                            إضافة ملف
                          </Button>
                        </div>
                      )
                    ) : newFile && newFileUrl ? (
                      /* New File View */
                      <div className="w-full h-full flex flex-col">
                        <div className="flex-1 relative">
                          {newFile.type === 'application/pdf' ? (
                            <iframe src={newFileUrl} className="w-full h-full" title="New PDF" />
                          ) : (
                            <div className="p-4 w-full h-full flex items-center justify-center overflow-auto">
                              <img src={newFileUrl} alt="New" className="max-w-full max-h-full object-contain shadow-md" />
                            </div>
                          )}
                        </div>
                        {/* Analysis Actions Bar */}
                        <div className="p-3 bg-white border-t space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-green-600 font-medium truncate flex-1">
                              ✅ {newFile.name}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {(newFile.size / (1024 * 1024)).toFixed(1)} MB
                            </span>
                          </div>

                          {!isAnalyzing ? (
                            <Button
                              type="button"
                              onClick={handleAnalyzeNewFile}
                              className="w-full gap-2"
                              variant="secondary"
                            >
                              <Sparkles className="w-4 h-4 text-purple-600" />
                              تحليل واستخراج البيانات تلقائياً
                            </Button>
                          ) : (
                            <div className="space-y-2">
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>{analysisStatus}</span>
                                <span>{analysisProgress}%</span>
                              </div>
                              <Progress value={analysisProgress} className="h-1.5" />
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* Upload Zone */
                      <div className="p-8 w-full max-w-md mx-auto">
                        <div
                          className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer hover:border-primary/50 hover:bg-white/50 transition-all bg-white/20"
                          onClick={() => editFileInputRef.current?.click()}
                        >
                          <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                          <h3 className="font-semibold text-lg mb-2">اضغط لرفع ملف جديد</h3>
                          <p className="text-sm text-muted-foreground mb-6">
                            PDF أو صور (PNG, JPG) - الحد الأقصى 20 م.ب
                          </p>
                          <Button variant="outline">اختيار ملف</Button>
                        </div>
                        <input
                          ref={editFileInputRef}
                          type="file"
                          accept=".pdf,image/png,image/jpeg,image/webp"
                          onChange={handleEditFileSelect}
                          className="hidden"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── BOTTOM SECTION: Form Fields ── */}
              <form onSubmit={handleEditSubmit} className="flex flex-col space-y-4">
                <Alert className="bg-blue-50 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900">
                  <Pencil className="h-4 w-4 text-blue-500" />
                  <AlertTitle className="text-blue-700 dark:text-blue-300">وضع التعديل</AlertTitle>
                  <AlertDescription className="text-blue-600/80 dark:text-blue-400/80 text-xs">
                    قم بتعديل البيانات أدناه. يمكنك تحديث البيانات تلقائياً عند تغيير الملف وتحليله.
                  </AlertDescription>
                </Alert>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>العنوان بالعربية *</Label>
                    <Input
                      value={editFormData.title_ar}
                      onChange={(e) => setEditFormData({ ...editFormData, title_ar: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>العنوان بالفرنسية</Label>
                    <Input
                      value={editFormData.title_fr}
                      onChange={(e) => setEditFormData({ ...editFormData, title_fr: e.target.value })}
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>نوع الوثيقة *</Label>
                    <Select
                      value={editFormData.document_type}
                      onValueChange={(value) => setEditFormData({ ...editFormData, document_type: value })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="مرسوم">مرسوم</SelectItem>
                        <SelectItem value="قرار">قرار</SelectItem>
                        <SelectItem value="تعليمة">تعليمة</SelectItem>
                        <SelectItem value="منشور">منشور</SelectItem>
                        <SelectItem value="قانون">قانون</SelectItem>
                        <SelectItem value="أمر">أمر</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>رقم الملف</Label>
                    <Input
                      value={editFormData.document_number}
                      onChange={(e) => setEditFormData({ ...editFormData, document_number: e.target.value })}
                      placeholder="الرقم / السنة"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>تاريخ الوثيقة</Label>
                    <DateInput
                      value={editFormData.document_date}
                      onChange={(date) => setEditFormData({ ...editFormData, document_date: date })}
                      placeholder="يوم/شهر/سنة"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>الوصف</Label>
                  <Textarea
                    value={editFormData.description}
                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                    placeholder="وصف مختصر للوثيقة"
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label>محتوى الوثيقة (للبحث)</Label>
                  <Textarea
                    value={editFormData.content_text}
                    onChange={(e) => setEditFormData({ ...editFormData, content_text: e.target.value })}
                    placeholder="نص الوثيقة"
                    rows={6}
                    className="font-mono text-xs"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>الكلمات المفتاحية</Label>
                    <Input
                      value={editFormData.keywords}
                      onChange={(e) => setEditFormData({ ...editFormData, keywords: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>اللغة</Label>
                    <Select
                      value={editFormData.language}
                      onValueChange={(value) => setEditFormData({ ...editFormData, language: value })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ar">العربية</SelectItem>
                        <SelectItem value="fr">الفرنسية</SelectItem>
                        <SelectItem value="both">ثنائي اللغة</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* ── Action buttons ── */}
                <div className="flex gap-3 justify-end pt-4 border-t mt-auto sticky bottom-0 bg-background/95 backdrop-blur py-2">
                  <Button type="button" variant="outline" onClick={closeEditModal} disabled={isAnalyzing || updateMutation.isPending}>
                    <X className="w-4 h-4 ml-1" />
                    إلغاء
                  </Button>
                  <Button
                    type="submit"
                    disabled={updateMutation.isPending || isAnalyzing}
                    style={{ backgroundColor: '#D4AF37', color: '#2D2926' }}
                    className="gap-2 min-w-[140px]"
                  >
                    {updateMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> جاري الحفظ...</>
                    ) : (
                      'حفظ التغييرات'
                    )}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
