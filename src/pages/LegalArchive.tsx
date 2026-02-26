import { useState } from "react";
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
import { Loader2, FileText, Plus, Eye, Trash, Search, Trash2, RefreshCcw, Scale, Pencil, Upload, Scan, Globe, Languages } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { FileImport } from "@/components/FileImport";
import { FileDropZone } from "@/components/FileDropZone";
import { scanFromLocalScanner } from "@/lib/scanner-bridge";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

// --- Types ---
const STORAGE_KEY = "opvm_legislative_documents";

type DocumentCategory = "all" | "قوانين التعمير" | "مراسيم تنفيذية" | "تعليمات وزارية" | "مخططات PDAU/POS";
type DocumentType = "مرسوم" | "قرار" | "تعليمة" | "منشور" | "قانون" | "أمر";
type Language = "ar" | "fr" | "both";

interface LegislativeDocument {
  id: string;
  title_ar: string;
  title_fr: string;
  document_type: DocumentType;
  category: DocumentCategory;
  document_number: string;
  document_date: string;
  description_ar: string;
  description_fr: string;
  file_url_ar?: string;
  file_url_fr?: string;
  file_base64_ar?: string;
  file_base64_fr?: string;
  language: Language;
  keywords: string[];
  status: "active" | "archived";
  created_at: string;
}

// Algerian Urban Planning Categories
const CATEGORIES: { value: DocumentCategory; label_ar: string; label_fr: string }[] = [
  { value: "all", label_ar: "الكل", label_fr: "Tout" },
  { value: "قوانين التعمير", label_ar: "قوانين التعمير", label_fr: "Lois d'urbanisme" },
  { value: "مراسيم تنفيذية", label_ar: "مراسيم تنفيذية", label_fr: "Décrets exécutifs" },
  { value: "تعليمات وزارية", label_ar: "تعليمات وزارية", label_fr: "Instructions ministérielles" },
  { value: "مخططات PDAU/POS", label_ar: "مخططات PDAU/POS", label_fr: "Plans PDAU/POS" },
];

const DOCUMENT_TYPES: { value: string; label_ar: string; label_fr: string }[] = [
  { value: "مرسوم", label_ar: "مرسوم", label_fr: "Décret" },
  { value: "قرار", label_ar: "قرار", label_fr: "Arrêté" },
  { value: "تعليمة", label_ar: "تعليمة", label_fr: "Instruction" },
  { value: "منشور", label_ar: "منشور", label_fr: "Circulaire" },
  { value: "قانون", label_ar: "قانون", label_fr: "Loi" },
  { value: "أمر", label_ar: "أمر", label_fr: "Ordonnance" },
];

// Mock bilingual documents
const mockDocuments: LegislativeDocument[] = [
  {
    id: "1",
    title_ar: "المرسوم التنفيذي رقم 23-14",
    title_fr: "Décret exécutif n° 23-14",
    document_type: "مرسوم",
    category: "مراسيم تنفيذية",
    document_number: "23-14",
    document_date: "2023/01/15",
    description_ar: "يحدد كيفيات تطبيق أحكام القانون المتعلق بالتعمير والبناء في الجزائر",
    description_fr: "Détermine les modalités d'application de la loi relative à l'urbanisme et à la construction en Algérie",
    file_url_ar: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    file_url_fr: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    language: "both",
    keywords: ["تعمير", "بناء", "رخصة"],
    status: "active",
    created_at: "2023/01/15",
  },
  {
    id: "2",
    title_ar: "القرار الوزاري المشترك رقم 22-55",
    title_fr: "Arrêté interministériel n° 22-55",
    document_type: "قرار",
    category: "تعليمات وزارية",
    document_number: "22-55",
    document_date: "2022/11/20",
    description_ar: "يتضمن المصادقة على المخطط التوجيهي للتهيئة العمرانية لولاية غرداية",
    description_fr: "Portant approbation du plan directeur d'aménagement urbain de la wilaya de Ghardaïa",
    file_url_ar: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    file_url_fr: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    language: "both",
    keywords: ["PDAU", "غرداية", "مخطط"],
    status: "active",
    created_at: "2022/11/20",
  },
  {
    id: "3",
    title_ar: "التعليمة رقم 05",
    title_fr: "Instruction n° 05",
    document_type: "تعليمة",
    category: "تعليمات وزارية",
    document_number: "05",
    document_date: "2024/02/01",
    description_ar: "تتعلق بتسهيل إجراءات منح رخص البناء",
    description_fr: "Relative à la simplification des procédures d'octroi des permis de construire",
    file_url_ar: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    language: "both",
    keywords: ["رخصة بناء", "إجراءات"],
    status: "active",
    created_at: "2024/02/01",
  },
];

export default function LegalArchive() {
  const { role, isViewer } = useAuth();
  const { toast } = useToast();

  // Document state
  const [documents, setDocuments] = useState<LegislativeDocument[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return mockDocuments;
      }
    }
    return mockDocuments;
  });

  // UI State
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [viewDocument, setViewDocument] = useState<LegislativeDocument | null>(null);
  const [editDocument, setEditDocument] = useState<LegislativeDocument | null>(null);
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const [languageFilter, setLanguageFilter] = useState<"all" | "ar" | "fr" | "both">("all");

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<DocumentCategory>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | string>("all");

  // Upload State
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newFileUrl, setNewFileUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanLanguage, setScanLanguage] = useState<"ar" | "fr">("ar");

  // Form Data
  const [formData, setFormData] = useState<Omit<LegislativeDocument, "id" | "status" | "created_at">>({
    title_ar: "",
    title_fr: "",
    document_type: "مرسوم",
    category: "مراسيم تنفيذية",
    document_number: "",
    document_date: "",
    description_ar: "",
    description_fr: "",
    file_url_ar: undefined,
    file_url_fr: undefined,
    language: "both",
    keywords: [],
  });

  const canEdit = !isViewer && role !== "viewer";

  // Save to localStorage
  const saveDocuments = (docs: LegislativeDocument[]) => {
    setDocuments(docs);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
  };

  // Handlers
  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title_ar || !formData.document_type) {
      toast({ title: "خطأ", description: "يرجى ملء الحقول المطلوبة", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const newDoc: LegislativeDocument = {
        ...formData,
        id: Date.now().toString(),
        status: "active",
        created_at: format(new Date(), "yyyy/MM/dd"),
        file_url_ar: newFileUrl && scanLanguage === "ar" ? newFileUrl : formData.file_url_ar,
        file_url_fr: newFileUrl && scanLanguage === "fr" ? newFileUrl : formData.file_url_fr,
      };

      saveDocuments([...documents, newDoc]);
      setIsAddDialogOpen(false);
      resetForm();
      toast({ title: "نجاح", description: "تمت إضافة الوثيقة بنجاح" });
    } catch (error) {
      toast({ title: "خطأ", description: "حدث خطأ أثناء الإضافة", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    saveDocuments(documents.filter(d => d.id !== id));
    toast({ title: "تم الحذف", description: "تم حذف الوثيقة بنجاح" });
  };

  const handleDirectScan = async () => {
    setIsScanning(true);
    try {
      const scannedFile = await scanFromLocalScanner("Kyocera FS-1035MFP WIA Driver");
      setNewFile(scannedFile);
      setNewFileUrl(URL.createObjectURL(scannedFile));
      toast({
        title: "تم المسح بنجاح",
        description: `تم مسح الوثيقة باللغة ${scanLanguage === "ar" ? "العربية" : "الفرنسية"}`,
      });
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: "يرجى التأكد من تشغيل تطبيق Scanner Bridge",
        variant: "destructive",
      });
    } finally {
      setIsScanning(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title_ar: "",
      title_fr: "",
      document_type: "مرسوم",
      category: "مراسيم تنفيذية",
      document_number: "",
      document_date: "",
      description_ar: "",
      description_fr: "",
      file_url_ar: undefined,
      file_url_fr: undefined,
      language: "both",
      keywords: [],
    });
    setNewFile(null);
    setNewFileUrl(null);
  };

  // Filtering
  const filteredDocuments = documents.filter(doc => {
    if (showRecycleBin) return false;
    
    const term = searchTerm.toLowerCase();
    const matchesSearch = !term || 
      doc.title_ar.toLowerCase().includes(term) ||
      doc.title_fr.toLowerCase().includes(term) ||
      doc.document_number.toLowerCase().includes(term);

    const matchesCategory = categoryFilter === "all" || doc.category === categoryFilter;
    const matchesType = typeFilter === "all" || doc.document_type === typeFilter;
    const matchesLanguage = languageFilter === "all" || doc.language === languageFilter;

    return matchesSearch && matchesCategory && matchesType && matchesLanguage;
  });

  // Bilingual PDF Viewer Component
  const BilingualViewer = ({ doc }: { doc: LegislativeDocument }) => {
    const [activeLang, setActiveLang] = useState<"ar" | "fr" | "split">("split");

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-bold text-lg">{doc.language === "both" ? "العرض الثنائي اللغة" : "معاينة الوثيقة"}</h3>
          {doc.language === "both" && (
            <div className="flex items-center gap-1">
              <Button
                variant={activeLang === "ar" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveLang("ar")}
                className="text-xs"
              >
                عربي
              </Button>
              <Button
                variant={activeLang === "split" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveLang("split")}
                className="text-xs"
              >
                <Languages className="w-3 h-3 ml-1" />
                معاً
              </Button>
              <Button
                variant={activeLang === "fr" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveLang("fr")}
                className="text-xs"
              >
                Français
              </Button>
            </div>
          )}
        </div>

        {activeLang === "split" && doc.language === "both" ? (
          <div className="grid grid-cols-2 gap-4 h-[600px]">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-green-700">
                <Globe className="w-4 h-4" />
                <span>العربية</span>
              </div>
              <div className="h-full rounded-lg border overflow-hidden bg-slate-50">
                {doc.file_url_ar ? (
                  <iframe src={doc.file_url_ar} className="w-full h-full" title="Arabic PDF" />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    لا يوجد ملف عربي
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
                <Globe className="w-4 h-4" />
                <span>Français</span>
              </div>
              <div className="h-full rounded-lg border overflow-hidden bg-slate-50">
                {doc.file_url_fr ? (
                  <iframe src={doc.file_url_fr} className="w-full h-full" title="French PDF" />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    Aucun fichier français
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Globe className="w-4 h-4" />
              <span>{activeLang === "ar" ? "العربية" : "Français"}</span>
            </div>
            <div className="h-[600px] rounded-lg border overflow-hidden">
              {activeLang === "ar" && doc.file_url_ar ? (
                <iframe src={doc.file_url_ar} className="w-full h-full" title="Arabic PDF" />
              ) : activeLang === "fr" && doc.file_url_fr ? (
                <iframe src={doc.file_url_fr} className="w-full h-full" title="French PDF" />
              ) : doc.file_url_ar ? (
                <iframe src={doc.file_url_ar} className="w-full h-full" title="PDF" />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  لا يوجد ملف للمعاينة
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
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

        {canEdit && !showRecycleBin && (
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button style={{ backgroundColor: '#D4AF37', color: '#2D2926' }}>
                <Plus className="w-4 h-4 ml-2" />
                إضافة وثيقة
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>إضافة وثيقة قانونية ثنائية اللغة</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddDocument} className="space-y-4">
                {/* Language Selection */}
                <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                  <Label className="font-medium">اللغة:</Label>
                  <Select
                    value={formData.language}
                    onValueChange={(v: Language) => setFormData({ ...formData, language: v })}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="both">ثنائي اللغة (العربية/الفرنسية)</SelectItem>
                      <SelectItem value="ar">العربية فقط</SelectItem>
                      <SelectItem value="fr">Français seulement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Bilingual Titles */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>العنوان بالعربية *</Label>
                    <Input
                      value={formData.title_ar}
                      onChange={(e) => setFormData({ ...formData, title_ar: e.target.value })}
                      placeholder="أدخل العنوان بالعربية"
                      required
                      dir="rtl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Titre en français</Label>
                    <Input
                      value={formData.title_fr}
                      onChange={(e) => setFormData({ ...formData, title_fr: e.target.value })}
                      placeholder="Titre en français"
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* Category & Type */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>الفئة *</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(v: DocumentCategory) => setFormData({ ...formData, category: v })}
                    >
                      <SelectTrigger className="text-right">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.filter(c => c.value !== "all").map(cat => (
                          <SelectItem key={cat.value} value={cat.value}>{cat.label_ar}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>نوع الوثيقة *</Label>
                    <Select
                      value={formData.document_type}
                      onValueChange={(v: DocumentType) => setFormData({ ...formData, document_type: v })}
                    >
                      <SelectTrigger className="text-right">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DOCUMENT_TYPES.map(t => (
                          <SelectItem key={t.value} value={t.value}>{t.label_ar}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Number & Date */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>رقم الوثيقة</Label>
                    <Input
                      value={formData.document_number}
                      onChange={(e) => setFormData({ ...formData, document_number: e.target.value })}
                      placeholder="الرقم / السنة"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>تاريخ الوثيقة</Label>
                    <DateInput
                      value={formData.document_date ? new Date(formData.document_date) : undefined}
                      onChange={(date) => setFormData({ ...formData, document_date: date ? format(date, "yyyy/MM/dd") : "" })}
                      placeholder="YYYY/MM/DD"
                    />
                  </div>
                </div>

                {/* Bilingual Descriptions */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>الوصف بالعربية</Label>
                    <Textarea
                      value={formData.description_ar}
                      onChange={(e) => setFormData({ ...formData, description_ar: e.target.value })}
                      placeholder="وصف مختصر بالعربية"
                      rows={3}
                      dir="rtl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description en français</Label>
                    <Textarea
                      value={formData.description_fr}
                      onChange={(e) => setFormData({ ...formData, description_fr: e.target.value })}
                      placeholder="Description en français"
                      rows={3}
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* File Upload with Scanner */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>الملف المرفق</Label>
                    {formData.language === "both" && (
                      <div className="flex items-center gap-2">
                        <Label className="text-sm">لغة المسح:</Label>
                        <Select value={scanLanguage} onValueChange={(v: "ar" | "fr") => setScanLanguage(v)}>
                          <SelectTrigger className="w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ar">العربية</SelectItem>
                            <SelectItem value="fr">Français</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={handleDirectScan} disabled={isScanning} className="flex-1">
                      {isScanning ? (
                        <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جاري المسح...</>
                      ) : (
                        <><Scan className="w-4 h-4 ml-2" /> مسح ضوئي</>
                      )}
                    </Button>
                  </div>
                  <FileDropZone
                    onFileSelect={(file) => {
                      setNewFile(file);
                      setNewFileUrl(URL.createObjectURL(file));
                    }}
                    selectedFile={newFile}
                    onClear={() => {
                      setNewFile(null);
                      setNewFileUrl(null);
                    }}
                  />
                  {newFile && newFileUrl && (
                    <div className="h-48 rounded-lg border overflow-hidden">
                      {newFile.type === "application/pdf" ? (
                        <iframe src={newFileUrl} className="w-full h-full" title="Preview" />
                      ) : (
                        <img src={newFileUrl} alt="Preview" className="w-full h-full object-contain" />
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => { setIsAddDialogOpen(false); resetForm(); }}>
                    إلغاء
                  </Button>
                  <Button type="submit" disabled={isSubmitting} style={{ backgroundColor: '#D4AF37', color: '#2D2926' }}>
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "حفظ"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-3 flex-col md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="بحث في الوثائق... / Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={(v: DocumentCategory) => setCategoryFilter(v)}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="الفئة" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label_ar}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v)}>
              <SelectTrigger className="w-full md:w-[150px]">
                <SelectValue placeholder="النوع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                {DOCUMENT_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label_ar}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={languageFilter} onValueChange={(v) => setLanguageFilter(v)}>
              <SelectTrigger className="w-full md:w-[120px]">
                <SelectValue placeholder="اللغة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="ar">العربية</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
                <SelectItem value="both">ثنائي</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Documents Table */}
      <Card>
        <CardHeader>
          <CardTitle>قائمة الوثائق ({filteredDocuments.length})</CardTitle>
          <CardDescription>أرشيف الوثائق القانونية والتنظيمية</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredDocuments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>لا توجد وثائق مطابقة</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[10%] text-right">الرقم</TableHead>
                  <TableHead className="w-[25%] text-right">العنوان / Titre</TableHead>
                  <TableHead className="w-[15%] text-center">الفئة</TableHead>
                  <TableHead className="w-[10%] text-center">النوع</TableHead>
                  <TableHead className="w-[12%] text-right">التاريخ</TableHead>
                  <TableHead className="w-[10%] text-center">اللغة</TableHead>
                  <TableHead className="w-[18%] text-left">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocuments.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">{doc.document_number}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium" dir="rtl">{doc.title_ar}</p>
                        {doc.title_fr && <p className="text-xs text-muted-foreground" dir="ltr">{doc.title_fr}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{doc.category}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{doc.document_type}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{doc.document_date}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={doc.language === "both" ? "default" : "secondary"} className="text-xs">
                        {doc.language === "both" ? (
                          <><Languages className="w-3 h-3 ml-1" /> ثنائي</>
                        ) : doc.language === "ar" ? "عربي" : "FR"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-blue-600 hover:text-blue-800"
                          onClick={() => setViewDocument(doc)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {canEdit && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-amber-600 hover:text-amber-800"
                              onClick={() => setEditDocument(doc)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-800"
                              onClick={() => handleDelete(doc.id)}
                            >
                              <Trash className="w-4 h-4" />
                            </Button>
                          </>
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

      {/* View Dialog with Bilingual Viewer */}
      <Dialog open={!!viewDocument} onOpenChange={() => setViewDocument(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              <div className="flex items-center gap-3">
                <Scale className="w-5 h-5" />
                <span>معاينة الوثيقة</span>
              </div>
            </DialogTitle>
          </DialogHeader>
          {viewDocument && (
            <div className="space-y-6">
              {/* Document Info */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">العنوان (العربية)</Label>
                  <p className="font-semibold text-lg" dir="rtl">{viewDocument.title_ar}</p>
                </div>
                {viewDocument.title_fr && (
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Titre (Français)</Label>
                    <p className="font-semibold text-lg" dir="ltr">{viewDocument.title_fr}</p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Bilingual PDF Viewer */}
              <BilingualViewer doc={viewDocument} />

              {/* Metadata */}
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <Label className="text-muted-foreground text-sm">الفئة</Label>
                  <p className="font-medium">{viewDocument.category}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm">النوع</Label>
                  <p className="font-medium">{viewDocument.document_type}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm">التاريخ</Label>
                  <p className="font-mono">{viewDocument.document_date}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
