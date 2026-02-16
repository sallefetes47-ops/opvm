import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DateInput } from "@/components/ui/date-input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FileText, Plus, Eye, Trash, Search, Trash2, RefreshCcw, BookOpen, Scale, AlertTriangle, ExternalLink, Pencil, Upload, X, Sparkles, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { FileImport } from "@/components/FileImport";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useDocumentManager } from "@/hooks/useDocumentManager";
import { FileDropZone } from "@/components/FileDropZone";

// --- Constants & Types ---
const STORAGE_KEY = "opvm_documents";

interface LegalDocumentFormData {
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

// Helper to clean Arabic text
const parseArabicLegalText = (text: string) => {
  return text
    .replace(/[^\u0600-\u06FF0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const mockDocuments = [
  { id: "1", title_ar: "مرسوم تنفيذي 23-14", document_type: "مرسوم", document_number: "23-14", document_date: "2023-01-15", status: "active", description: "يحدد كيفيات تطبيق أحكام القانون...", file_url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf" },
  { id: "2", title_ar: "قرار وزاري مشترك", document_type: "قرار", document_number: "22-55", document_date: "2022-11-20", status: "active", description: "يتضمن المصادقة على المخطط التوجيهي...", file_url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf" },
  { id: "3", title_ar: "تعليمة رقم 05", document_type: "تعليمة", document_number: "05", document_date: "2024-02-01", status: "active", description: "تتعلّق بتسهيل إجراءات منح رخص البناء...", file_url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf" }
];

export default function LegalArchive() {
  const { user, role, isViewer } = useAuth();
  const { toast } = useToast();

  // Use shared document manager hook
  const {
    activeDocuments,
    trashedDocuments,
    addDocument,
    updateDocument,
    softDeleteDocument,
    restoreDocument,
    permanentDeleteDocument,
    viewOriginalDocument
  } = useDocumentManager({ storageKey: STORAGE_KEY, initialMockData: mockDocuments });

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [viewDocument, setViewDocument] = useState<any>(null);
  const [previewDocument, setPreviewDocument] = useState<any>(null);

  // Edit & Analysis State
  const [editDocument, setEditDocument] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStatus, setAnalysisStatus] = useState("");
  const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(new Set());
  const [isReplacingFile, setIsReplacingFile] = useState(false);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showRecycleBin, setShowRecycleBin] = useState(false);

  // Upload State
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newFileUrl, setNewFileUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<LegalDocumentFormData>({
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

  const [editFormData, setEditFormData] = useState<LegalDocumentFormData>({
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

  const canEdit = !isViewer && role !== "viewer";

  // --- Handlers ---

  const handleDataExtracted = (data: Record<string, any>) => {
    setFormData({
      title_ar: data.title_ar || "",
      title_fr: data.title_fr || "",
      document_type: data.document_type || "",
      document_number: data.document_number || "",
      document_date: data.document_date ? new Date(data.document_date) : undefined,
      description: data.description || "",
      content_text: data.content_text || "",
      keywords: Array.isArray(data.keywords) ? data.keywords.join(", ") : (data.keywords || ""),
      language: data.language || "ar",
    });
    setIsAddDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!formData.title_ar || !formData.document_type) {
      toast({ title: "خطأ", description: "يرجى ملء الحقول المطلوبة", variant: "destructive" });
      return;
    }

    if (!newFile) {
      toast({ title: "خطأ", description: "يرجى إرفاق ملف الوثيقة (PDF/Image)", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const dataToSave = {
        ...formData,
        document_date: formData.document_date ? format(formData.document_date, "yyyy-MM-dd") : null,
        keywords: formData.keywords.split(",").map(k => k.trim()).filter(Boolean),
      };

      await addDocument(dataToSave, newFile);
      setIsAddDialogOpen(false);
      resetForm();
    } catch (error) {
      // Toast handled in hook
    } finally {
      setIsSubmitting(false);
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
    setNewFile(null);
    setNewFileUrl(null);
  };

  // --- Edit & Analysis Handlers ---

  const openEditModal = (doc: any) => {
    setEditDocument(doc);
    setEditFormData({
      title_ar: doc.title_ar,
      title_fr: doc.title_fr || "",
      document_type: doc.document_type,
      document_number: doc.document_number || "",
      document_date: doc.document_date ? new Date(doc.document_date) : undefined,
      description: doc.description || "",
      content_text: doc.content_text || "",
      keywords: Array.isArray(doc.keywords) ? doc.keywords.join(", ") : (doc.keywords || ""),
      language: doc.language || "ar",
    });
    setIsReplacingFile(false);
    setNewFile(null);
    setNewFileUrl(null);
    setAutoFilledFields(new Set());
  };

  const closeEditModal = () => {
    setEditDocument(null);
    if (newFileUrl) URL.revokeObjectURL(newFileUrl);
    setNewFile(null);
    setNewFileUrl(null);
    setIsAnalyzing(false);
    setAnalysisStatus("");
  };

  const handleEditFileSelect = (file: File) => {
    setNewFile(file);
    const url = URL.createObjectURL(file);
    setNewFileUrl(url);
  };

  const handleAnalyzeNewFile = async () => {
    if (!newFile) return;
    setIsAnalyzing(true);
    setAnalysisProgress(10);
    setAnalysisStatus("جاري قراءة الملف...");

    try {
      // Simulate analysis
      await new Promise(r => setTimeout(r, 1000));
      setAnalysisProgress(50);
      setAnalysisStatus("استخراج النصوص...");

      await new Promise(r => setTimeout(r, 1000));
      setAnalysisProgress(100);
      setAnalysisStatus("تم التحليل بنجاح");

      // Keep existing data mostly, maybe update title if empty?
      // For now, just a simulation.
      setTimeout(() => {
        setIsAnalyzing(false);
        setAnalysisStatus("");
      }, 500);

    } catch (e) {
      console.error(e);
      toast({ title: "خطأ", description: "فشل تحليل الملف", variant: "destructive" });
      setIsAnalyzing(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDocument) return;

    try {
      const dataToSave = {
        ...editFormData,
        document_date: editFormData.document_date ? format(editFormData.document_date, "yyyy-MM-dd") : null,
        keywords: editFormData.keywords.split(",").map(k => k.trim()).filter(Boolean),
      };

      await updateDocument(editDocument.id, dataToSave, newFile);
      closeEditModal();
    } catch (error) {
      // handled in hook
    }
  };

  // --- Filtering ---
  const displayedDocs = showRecycleBin ? trashedDocuments : activeDocuments;

  const filteredDocuments = displayedDocs.filter(d => {
    const term = searchTerm.trim().toLowerCase();
    if (term) {
      const searchContent = `${d.title_ar || ''} ${d.title_fr || ''} ${d.document_number || ''} ${d.content_text || ''} ${(d.keywords || []).join(' ')}`.toLowerCase();
      if (!searchContent.includes(term)) return false;
    }
    if (typeFilter && typeFilter !== 'all') {
      if (d.document_type !== typeFilter) return false;
    }
    return true;
  });

  const autoFillClass = (field: string) =>
    autoFilledFields.has(field) ? "ring-2 ring-green-500/40 bg-green-500/5" : "";

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
            {!showRecycleBin && (
              <>
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

                      {/* File Drop Zone */}
                      <div className="col-span-2 space-y-2">
                        <Label className="block text-sm font-medium mb-2">الملف المرفق (PDF/صورة) *</Label>
                        <FileDropZone
                          onFileSelect={setNewFile}
                          selectedFile={newFile}
                          onClear={() => setNewFile(null)}
                        />
                      </div>

                      <div className="flex gap-2 justify-end">
                        <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                          إلغاء
                        </Button>
                        <Button type="submit" disabled={isSubmitting} style={{ backgroundColor: '#D4AF37', color: '#2D2926' }}>
                          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "حفظ"}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </>
            )}

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
                placeholder="بحث في الوثائق..."
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

      {/* Documents Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {showRecycleBin ? "سلة المحذوفات" : "قائمة الوثائق"}
          </CardTitle>
          <CardDescription>
            {showRecycleBin ? `${trashedDocuments.length} ملف محذوف` : `عرض ${filteredDocuments.length} وثيقة`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredDocuments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {showRecycleBin ? "سلة المحذوفات فارغة" : "لا توجد وثائق مطابقة"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الرقم</TableHead>
                  <TableHead>العنوان</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>كلمات مفتاحية</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocuments.map((doc) => (
                  <TableRow key={doc.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setViewDocument(doc)}>
                    <TableCell className="font-medium">{doc.document_number}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{doc.title_ar}</span>
                        {doc.title_fr && <span className="text-xs text-muted-foreground">{doc.title_fr}</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal">{doc.document_type}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {doc.document_date ? format(new Date(doc.document_date), "dd/MM/yyyy") : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {doc.keywords?.slice(0, 2).map((k: string, i: number) => (
                          <span key={i} className="text-xs bg-primary/5 px-1.5 py-0.5 rounded text-primary">
                            {k}
                          </span>
                        ))}
                        {doc.keywords?.length > 2 && (
                          <span className="text-xs text-muted-foreground">+{doc.keywords.length - 2}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                                disabled={!doc.file_url && !doc.file_base64}
                                onClick={(e) => viewOriginalDocument(e, doc)}
                                title="معاينة الملف الأصلي"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>معاينة الملف</p></TooltipContent>
                          </Tooltip>

                          {showRecycleBin ? (
                            <>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="text-green-600 hover:text-green-800 hover:bg-green-50"
                                    onClick={(e) => { e.stopPropagation(); restoreDocument(doc.id); }}
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
                                    onClick={(e) => { e.stopPropagation(); permanentDeleteDocument(doc.id); }}
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
                              <>
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
                                      <Pencil className="h-4 w-4 text-slate-500" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent><p>تعديل</p></TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                      onClick={(e) => { e.stopPropagation(); softDeleteDocument(doc.id); }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top"><p>حذف (نقل للسلة)</p></TooltipContent>
                                </Tooltip>
                              </>
                            )
                          )}
                        </div>
                      </TooltipProvider>
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
                        <div className="text-center p-8 w-full h-full flex items-center justify-center">
                          <div className="w-full max-w-sm">
                            <FileDropZone
                              onFileSelect={handleEditFileSelect}
                              selectedFile={newFile}
                              onClear={() => {
                                if (newFileUrl) URL.revokeObjectURL(newFileUrl);
                                setNewFile(null);
                                setNewFileUrl(null);
                              }}
                            />
                          </div>
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
                    ) : null}
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
                      placeholder="أدخل العنوان بالعربية"
                      className={autoFillClass("title_ar")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>العنوان بالفرنسية</Label>
                    <Input
                      value={editFormData.title_fr}
                      onChange={(e) => setEditFormData({ ...editFormData, title_fr: e.target.value })}
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
                      value={editFormData.document_type}
                      onValueChange={(value) => setEditFormData({ ...editFormData, document_type: value })}
                    >
                      <SelectTrigger className={autoFillClass("document_type")}>
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
                      value={editFormData.document_number}
                      onChange={(e) => setEditFormData({ ...editFormData, document_number: e.target.value })}
                      placeholder="الرقم / السنة"
                      className={autoFillClass("document_number")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>تاريخ الوثيقة</Label>
                    <DateInput
                      value={editFormData.document_date}
                      onChange={(date) => setEditFormData({ ...editFormData, document_date: date })}
                      className={autoFillClass("document_date")}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>الوصف</Label>
                  <Textarea
                    value={editFormData.description}
                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                    rows={2}
                    className={autoFillClass("description")}
                  />
                </div>
                <div className="space-y-2">
                  <Label>محتوى الوثيقة (للبحث)</Label>
                  <Textarea
                    value={editFormData.content_text}
                    onChange={(e) => setEditFormData({ ...editFormData, content_text: e.target.value })}
                    rows={4}
                    className={autoFillClass("content_text")}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>الكلمات المفتاحية</Label>
                    <Input
                      value={editFormData.keywords}
                      onChange={(e) => setEditFormData({ ...editFormData, keywords: e.target.value })}
                      className={autoFillClass("keywords")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>اللغة</Label>
                    <Select
                      value={editFormData.language}
                      onValueChange={(value) => setEditFormData({ ...editFormData, language: value })}
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

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={closeEditModal}>
                    إلغاء
                  </Button>
                  <Button type="submit" style={{ backgroundColor: '#D4AF37', color: '#2D2926' }}>
                    <Pencil className="w-4 h-4 ml-2" />
                    حفظ التعديلات
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
