import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DateInput } from "@/components/ui/date-input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Scale, Plus, Eye, Trash, Search, Trash2, RefreshCcw, FileText, Pencil } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

// --- Types ---
const STORAGE_KEY_AR = "opvm_legislative_ar";
const STORAGE_KEY_FR = "opvm_legislative_fr";

type DocumentCategory = "قوانين" | "مراسيم تنفيذية" | "تعليمات وزارية" | "مناشير";
type DocumentStatus = "ساري المفعول" | "ملغى" | "معدل";

interface LegislativeDocument {
  id: string;
  title: string;
  document_type: DocumentCategory;
  document_number: string;
  document_date: string;
  description: string;
  file_url?: string;
  file_base64?: string;
  status: DocumentStatus;
  keywords: string[];
  created_at: string;
}

// Categories
const CATEGORIES_AR: { value: DocumentCategory; label: string }[] = [
  { value: "قوانين", label: "قوانين" },
  { value: "مراسيم تنفيذية", label: "مراسيم تنفيذية" },
  { value: "تعليمات وزارية", label: "تعليمات وزارية" },
  { value: "مناشير", label: "مناشير" },
];

const CATEGORIES_FR: { value: DocumentCategory; label: string }[] = [
  { value: "Lois", label: "Lois" },
  { value: "Décrets exécutifs", label: "Décrets exécutifs" },
  { value: "Instructions ministérielles", label: "Instructions ministérielles" },
  { value: "Circulaires", label: "Circulaires" },
];

const DOCUMENT_TYPES_AR: { value: string; label: string }[] = [
  { value: "قانون", label: "قانون" },
  { value: "مرسوم", label: "مرسوم" },
  { value: "قرار", label: "قرار" },
  { value: "تعليمة", label: "تعليمة" },
  { value: "منشور", label: "منشور" },
];

const STATUS_AR: { value: DocumentStatus; label: string }[] = [
  { value: "ساري المفعول", label: "ساري المفعول" },
  { value: "ملغى", label: "ملغى" },
  { value: "معدل", label: "معدل" },
];

const STATUS_FR: { value: DocumentStatus; label: string }[] = [
  { value: "En vigueur", label: "En vigueur" },
  { value: "Abrogé", label: "Abrogé" },
  { value: "Modifié", label: "Modifié" },
];

// Pre-populated Arabic Documents (1962-2026)
const INITIAL_DOCUMENTS_AR: LegislativeDocument[] = [
  {
    id: "ar-1",
    title: "القانون رقم 90-29 المتعلق بالتعمير والبناء",
    document_type: "قوانين",
    document_number: "90-29",
    document_date: "1990/12/01",
    description: "القانون الأساسي المنظم للتعمير والبناء واستغلال الأراضي في الجزائر. يحدد القواعد العامة لإعداد وثائق التعمير ومنح رخص البناء.",
    status: "ساري المفعول",
    keywords: ["تعمير", "بناء", "رخصة", "مخطط", "أرض"],
    created_at: "1990/12/01",
  },
  {
    id: "ar-2",
    title: "القانون رقم 08-15 المتعلق بشهادة إتمام البناء",
    document_type: "قوانين",
    document_number: "08-15",
    document_date: "2008/07/19",
    description: "يتعلق بإلزامية الحصول على شهادة إتمام البناء للمباني الموجهة للسكن ويحدد الإجراءات والشروط التقنية.",
    status: "ساري المفعول",
    keywords: ["شهادة", "بناء", "إتمام", "سكن", "مطابقة"],
    created_at: "2008/07/19",
  },
  {
    id: "ar-3",
    title: "المرسوم التنفيذي رقم 15-19",
    document_type: "مراسيم تنفيذية",
    document_number: "15-19",
    document_date: "2015/01/25",
    description: "يحدد كيفيات منح رخص التعمير والشهادات الحضرية. ينظم إجراءات دراسة ملفات الرخص وتسليمها.",
    status: "ساري المفعول",
    keywords: ["رخصة", "شهادة", "تعمير", "إجراءات"],
    created_at: "2015/01/25",
  },
  {
    id: "ar-4",
    title: "التعليمة الوزارية رقم 004/2017",
    document_type: "تعليمات وزارية",
    document_number: "004/2017",
    document_date: "2017/03/15",
    description: "تتعلق بهشاشة الموقع والمتطلبات التقنية الخاصة للبناء في المناطق الحساسة بيئياً وتاريخياً.",
    status: "ساري المفعول",
    keywords: ["هشاشة", "موقع", "حماية", "بيئة", "تاريخ"],
    created_at: "2017/03/15",
  },
  {
    id: "ar-5",
    title: "المنشور رقم 002/2021",
    document_type: "مناشير",
    document_number: "002/2021",
    document_date: "2021/06/10",
    description: "يتعلق بتسوية وضعية المباني المشيدة على أراضٍ فلاحية أو محمية. يحدد إجراءات التقنين الاستثنائية.",
    status: "ساري المفعول",
    keywords: ["تسوية", "أرض فلاحية", "حماية", "تقنين"],
    created_at: "2021/06/10",
  },
  {
    id: "ar-6",
    title: "القانون رقم 91-09 المتعلق بحماية المعالم التاريخية",
    document_type: "قوانين",
    document_number: "91-09",
    document_date: "1991/04/27",
    description: "يحدد نظام حماية المعالم التاريخية والمواقع الأثرية وينظم التدخلات المسموح بها في محيطها.",
    status: "ساري المفعول",
    keywords: ["تراث", "حماية", "معلم", "أثري"],
    created_at: "1991/04/27",
  },
  {
    id: "ar-7",
    title: "المرسوم التنفيذي رقم 06-01",
    document_type: "مراسيم تنفيذية",
    document_number: "06-01",
    document_date: "2006/01/03",
    description: "يحدد محتوى وثائق التعمير وإجراءات إعدادها والمصادقة عليها.",
    status: "ساري المفعول",
    keywords: ["وثيقة", "مخطط", "إعداد", "مصادقة"],
    created_at: "2006/01/03",
  },
  {
    id: "ar-8",
    title: "التعليمة الوزارية رقم 01/2019",
    document_type: "تعليمات وزارية",
    document_number: "01/2019",
    document_date: "2019/02/20",
    description: "تتعلق بالرقمنة وإجراءات تقديم طلبات رخص البناء عبر الخط.",
    status: "ساري المفعول",
    keywords: ["رقمنة", "إلكتروني", "رخصة"],
    created_at: "2019/02/20",
  },
];

// Pre-populated French Documents (1962-2026)
const INITIAL_DOCUMENTS_FR: LegislativeDocument[] = [
  {
    id: "fr-1",
    title: "Loi n° 90-29 relative à l'urbanisme et à la construction",
    document_type: "Lois",
    document_number: "90-29",
    document_date: "1990/12/01",
    description: "Loi fondamentale régissant l'urbanisme, la construction et l'utilisation des terres en Algérie. Définit les règles générales pour l'élaboration des documents d'urbanisme et l'octroi des permis de construire.",
    status: "En vigueur",
    keywords: ["urbanisme", "construction", "permis", "plan", "terre"],
    created_at: "1990/12/01",
  },
  {
    id: "fr-2",
    title: "Loi n° 08-15 relative au certificat d'achèvement des travaux",
    document_type: "Lois",
    document_number: "08-15",
    document_date: "2008/07/19",
    description: "Relative à l'obligation d'obtenir un certificat d'achèvement pour les bâtiments à usage d'habitation et définit les procédures et les exigences techniques.",
    status: "En vigueur",
    keywords: ["certificat", "achèvement", "habitation", "conformité"],
    created_at: "2008/07/19",
  },
  {
    id: "fr-3",
    title: "Décret exécutif n° 15-19",
    document_type: "Décrets exécutifs",
    document_number: "15-19",
    document_date: "2015/01/25",
    description: "Détermine les modalités d'octroi des permis d'urbanisme et des certificats. Réglemente les procédures d'instruction des demandes de permis.",
    status: "En vigueur",
    keywords: ["permis", "certificat", "urbanisme", "procédure"],
    created_at: "2015/01/25",
  },
  {
    id: "fr-4",
    title: "Instruction ministérielle n° 004/2017",
    document_type: "Instructions ministérielles",
    document_number: "004/2017",
    document_date: "2017/03/15",
    description: "Relative à la vulnérabilité des sites et aux exigences techniques spécifiques pour la construction dans les zones sensibles sur le plan environnemental et historique.",
    status: "En vigueur",
    keywords: ["vulnérabilité", "site", "protection", "environnement", "histoire"],
    created_at: "2017/03/15",
  },
  {
    id: "fr-5",
    title: "Circulaire n° 002/2021",
    document_type: "Circulaires",
    document_number: "002/2021",
    document_date: "2021/06/10",
    description: "Relative à la régularisation des bâtiments édifiés sur des terres agricoles ou protégées. Définit les procédures exceptionnelles de régularisation.",
    status: "En vigueur",
    keywords: ["régularisation", "terre agricole", "protection", "légalisation"],
    created_at: "2021/06/10",
  },
  {
    id: "fr-6",
    title: "Loi n° 91-09 relative à la protection des monuments historiques",
    document_type: "Lois",
    document_number: "91-09",
    document_date: "1991/04/27",
    description: "Définit le régime de protection des monuments historiques et des sites archéologiques et réglemente les interventions autorisées dans leur périmètre.",
    status: "En vigueur",
    keywords: ["patrimoine", "protection", "monument", "archéologie"],
    created_at: "1991/04/27",
  },
  {
    id: "fr-7",
    title: "Décret exécutif n° 06-01",
    document_type: "Décrets exécutifs",
    document_number: "06-01",
    document_date: "2006/01/03",
    description: "Détermine le contenu des documents d'urbanisme et les procédures de leur élaboration et de leur approbation.",
    status: "En vigueur",
    keywords: ["document", "plan", "élaboration", "approbation"],
    created_at: "2006/01/03",
  },
  {
    id: "fr-8",
    title: "Instruction ministérielle n° 01/2019",
    document_type: "Instructions ministérielles",
    document_number: "01/2019",
    document_date: "2019/02/20",
    description: "Relative à la dématérialisation et aux procédures de soumission des demandes de permis de construire en ligne.",
    status: "En vigueur",
    keywords: ["dématérialisation", "électronique", "permis"],
    created_at: "2019/02/20",
  },
];

export default function LegalArchive() {
  const { role, isViewer } = useAuth();
  const { toast } = useToast();

  // Separate state for Arabic and French documents
  const [documentsAr, setDocumentsAr] = useState<LegislativeDocument[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_AR);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return INITIAL_DOCUMENTS_AR;
      }
    }
    return INITIAL_DOCUMENTS_AR;
  });

  const [documentsFr, setDocumentsFr] = useState<LegislativeDocument[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_FR);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return INITIAL_DOCUMENTS_FR;
      }
    }
    return INITIAL_DOCUMENTS_FR;
  });

  // UI State
  const [activeTab, setActiveTab] = useState<"ar" | "fr">("ar");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [viewDocument, setViewDocument] = useState<LegislativeDocument | null>(null);
  const [editDocument, setEditDocument] = useState<LegislativeDocument | null>(null);
  const [showRecycleBin, setShowRecycleBin] = useState(false);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Form Data
  const [formData, setFormData] = useState<Omit<LegislativeDocument, "id" | "status" | "created_at">>({
    title: "",
    document_type: "قوانين",
    document_number: "",
    document_date: "",
    description: "",
    keywords: [],
  });

  const [newFile, setNewFile] = useState<File | null>(null);
  const [newFileUrl, setNewFileUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canEdit = !isViewer && role !== "viewer";

  // Save to localStorage
  const saveDocumentsAr = (docs: LegislativeDocument[]) => {
    setDocumentsAr(docs);
    localStorage.setItem(STORAGE_KEY_AR, JSON.stringify(docs));
  };

  const saveDocumentsFr = (docs: LegislativeDocument[]) => {
    setDocumentsFr(docs);
    localStorage.setItem(STORAGE_KEY_FR, JSON.stringify(docs));
  };

  // Get current documents based on active tab
  const currentDocuments = activeTab === "ar" ? documentsAr : documentsFr;
  const setCurrentDocuments = activeTab === "ar" ? saveDocumentsAr : saveDocumentsFr;
  const categories = activeTab === "ar" ? CATEGORIES_AR : CATEGORIES_FR;
  const statuses = activeTab === "ar" ? STATUS_AR : STATUS_FR;

  // Handlers
  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.document_type) {
      toast({ title: "خطأ", description: "يرجى ملء الحقول المطلوبة", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const newDoc: LegislativeDocument = {
        ...formData,
        id: `${activeTab}-${Date.now()}`,
        status: "ساري المفعول",
        created_at: format(new Date(), "yyyy/MM/dd"),
        file_url: newFileUrl || undefined,
      };

      setCurrentDocuments([...currentDocuments, newDoc]);
      setIsAddDialogOpen(false);
      resetForm();
      toast({
        title: "نجاح",
        description: activeTab === "ar" ? "تمت إضافة الوثيقة بنجاح" : "Document ajouté avec succès",
      });
    } catch (error) {
      toast({ title: "خطأ", description: "حدث خطأ أثناء الإضافة", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    setCurrentDocuments(currentDocuments.filter(d => d.id !== id));
    toast({
      title: "تم الحذف",
      description: activeTab === "ar" ? "تم حذف الوثيقة بنجاح" : "Document supprimé avec succès",
    });
  };

  const resetForm = () => {
    setFormData({
      title: "",
      document_type: activeTab === "ar" ? "قوانين" : "Lois",
      document_number: "",
      document_date: "",
      description: "",
      keywords: [],
    });
    setNewFile(null);
    setNewFileUrl(null);
  };

  // Filtering
  const filteredDocuments = currentDocuments.filter(doc => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = !term ||
      doc.title.toLowerCase().includes(term) ||
      doc.document_number.toLowerCase().includes(term) ||
      doc.description.toLowerCase().includes(term);

    const matchesCategory = categoryFilter === "all" || doc.document_type === categoryFilter;
    const matchesType = typeFilter === "all" || true; // Simplified
    const matchesStatus = statusFilter === "all" || doc.status === statusFilter;

    return matchesSearch && matchesCategory && matchesType && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
            <Scale className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-cairo">المراسيم والتعليمات</h1>
            <p className="text-muted-foreground text-sm font-cairo">أرشيف الوثائق القانونية والتنظيمية (1962-2026)</p>
          </div>
        </div>
      </div>

      {/* Dual Language Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "ar" | "fr")} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="ar" className="font-cairo text-lg">
            التشريع العمراني (العربية)
          </TabsTrigger>
          <TabsTrigger value="fr" className="font-inter text-lg">
            Législation de l'Urbanisme (Français)
          </TabsTrigger>
        </TabsList>

        {/* Arabic Content */}
        <TabsContent value="ar" className="space-y-4 mt-4">
          {/* Action Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant={showRecycleBin ? "destructive" : "outline"}
                onClick={() => setShowRecycleBin(!showRecycleBin)}
                className="gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {showRecycleBin ? "العودة للقائمة" : "سلة المحذوفات"}
              </Button>
            </div>

            {canEdit && !showRecycleBin && (
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button style={{ backgroundColor: '#D4AF37', color: '#2D2926' }}>
                    <Plus className="w-4 h-4 ml-2" />
                    إضافة وثيقة
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="font-cairo">إضافة وثيقة قانونية جديدة</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAddDocument} className="space-y-4">
                    <div className="space-y-2">
                      <Label className="font-cairo">العنوان *</Label>
                      <Input
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="أدخل العنوان"
                        required
                        dir="rtl"
                        className="font-cairo"
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="font-cairo">الفئة *</Label>
                        <Select
                          value={formData.document_type}
                          onValueChange={(v: DocumentCategory) => setFormData({ ...formData, document_type: v })}
                        >
                          <SelectTrigger className="font-cairo">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORIES_AR.map(cat => (
                              <SelectItem key={cat.value} value={cat.value} className="font-cairo">{cat.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="font-cairo">الحالة *</Label>
                        <Select
                          value={formData.status as string}
                          onValueChange={(v: DocumentStatus) => setFormData({ ...formData, status: v })}
                        >
                          <SelectTrigger className="font-cairo">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_AR.map(s => (
                              <SelectItem key={s.value} value={s.value} className="font-cairo">{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="font-cairo">رقم الوثيقة</Label>
                        <Input
                          value={formData.document_number}
                          onChange={(e) => setFormData({ ...formData, document_number: e.target.value })}
                          placeholder="مثال: 90-29"
                          dir="ltr"
                          className="font-mono"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="font-cairo">تاريخ الوثيقة</Label>
                        <DateInput
                          value={formData.document_date ? new Date(formData.document_date) : undefined}
                          onChange={(date) => setFormData({ ...formData, document_date: date ? format(date, "yyyy/MM/dd") : "" })}
                          placeholder="YYYY/MM/DD"
                          className="font-cairo"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="font-cairo">الوصف</Label>
                      <Textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="وصف مختصر"
                        rows={4}
                        dir="rtl"
                        className="font-cairo"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="font-cairo">الملف المرفق (اختياري)</Label>
                      <Input
                        type="file"
                        accept=".pdf,image/png,image/jpeg,image/webp"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setNewFile(file);
                            setNewFileUrl(URL.createObjectURL(file));
                          }
                        }}
                        disabled={isSubmitting}
                        className="font-cairo"
                      />
                      {newFile && newFileUrl && (
                        <div className="h-40 rounded-lg border overflow-hidden">
                          {newFile.type === "application/pdf" ? (
                            <iframe src={newFileUrl} className="w-full h-full" title="Preview" />
                          ) : (
                            <img src={newFileUrl} alt="Preview" className="w-full h-full object-contain" />
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 justify-end">
                      <Button type="button" variant="outline" onClick={() => { setIsAddDialogOpen(false); resetForm(); }} className="font-cairo">
                        إلغاء
                      </Button>
                      <Button type="submit" disabled={isSubmitting} style={{ backgroundColor: '#D4AF37', color: '#2D2926' }} className="font-cairo">
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
                    placeholder="بحث في الوثائق..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-10 font-cairo"
                    dir="rtl"
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full md:w-[180px] font-cairo">
                    <SelectValue placeholder="الفئة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="font-cairo">الكل</SelectItem>
                    {CATEGORIES_AR.map(cat => (
                      <SelectItem key={cat.value} value={cat.value} className="font-cairo">{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-[150px] font-cairo">
                    <SelectValue placeholder="الحالة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="font-cairo">الكل</SelectItem>
                    {STATUS_AR.map(s => (
                      <SelectItem key={s.value} value={s.value} className="font-cairo">{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Documents Table */}
          <Card>
            <CardHeader>
              <CardTitle className="font-cairo">قائمة الوثائق ({filteredDocuments.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredDocuments.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="font-cairo">لا توجد وثائق مطابقة</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[10%] text-right font-cairo">الرقم</TableHead>
                      <TableHead className="w-[30%] text-right font-cairo">العنوان</TableHead>
                      <TableHead className="w-[15%] text-center font-cairo">الفئة</TableHead>
                      <TableHead className="w-[12%] text-right font-cairo">التاريخ</TableHead>
                      <TableHead className="w-[13%] text-center font-cairo">الحالة</TableHead>
                      <TableHead className="w-[20%] text-left font-cairo">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDocuments.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell className="text-right font-mono font-cairo">{doc.document_number || "-"}</TableCell>
                        <TableCell className="text-right font-cairo">
                          <div className="flex flex-col">
                            <span className="font-medium">{doc.title}</span>
                            {doc.description && (
                              <span className="text-xs text-muted-foreground line-clamp-1">{doc.description}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className="font-cairo">{doc.document_type}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-cairo">{doc.document_date || "-"}</TableCell>
                        <TableCell className="text-center">
                          <Badge
                            className={cn(
                              "font-cairo",
                              doc.status === "ساري المفعول" && "bg-green-100 text-green-800",
                              doc.status === "ملغى" && "bg-red-100 text-red-800",
                              doc.status === "معدل" && "bg-yellow-100 text-yellow-800"
                            )}
                          >
                            {doc.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-left">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setViewDocument(doc)}
                              title="عرض"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {canEdit && !showRecycleBin && (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setEditDocument(doc)}
                                  title="تعديل"
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="text-red-500 hover:text-red-700"
                                  onClick={() => handleDelete(doc.id)}
                                  title="حذف"
                                >
                                  <Trash2 className="w-4 h-4" />
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
        </TabsContent>

        {/* French Content */}
        <TabsContent value="fr" className="space-y-4 mt-4">
          {/* Action Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant={showRecycleBin ? "destructive" : "outline"}
                onClick={() => setShowRecycleBin(!showRecycleBin)}
                className="gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {showRecycleBin ? "Retour à la liste" : "Corbeille"}
              </Button>
            </div>

            {canEdit && !showRecycleBin && (
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button style={{ backgroundColor: '#D4AF37', color: '#2D2926' }}>
                    <Plus className="w-4 h-4 ml-2" />
                    Ajouter un document
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="font-inter">Ajouter un nouveau document juridique</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAddDocument} className="space-y-4">
                    <div className="space-y-2">
                      <Label className="font-inter">Titre *</Label>
                      <Input
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="Entrez le titre"
                        required
                        dir="ltr"
                        className="font-inter"
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="font-inter">Catégorie *</Label>
                        <Select
                          value={formData.document_type}
                          onValueChange={(v: DocumentCategory) => setFormData({ ...formData, document_type: v })}
                        >
                          <SelectTrigger className="font-inter">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORIES_FR.map(cat => (
                              <SelectItem key={cat.value} value={cat.value} className="font-inter">{cat.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="font-inter">Statut *</Label>
                        <Select
                          value={formData.status as string}
                          onValueChange={(v: DocumentStatus) => setFormData({ ...formData, status: v })}
                        >
                          <SelectTrigger className="font-inter">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_FR.map(s => (
                              <SelectItem key={s.value} value={s.value} className="font-inter">{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="font-inter">Numéro du document</Label>
                        <Input
                          value={formData.document_number}
                          onChange={(e) => setFormData({ ...formData, document_number: e.target.value })}
                          placeholder="Ex: 90-29"
                          dir="ltr"
                          className="font-mono font-inter"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="font-inter">Date du document</Label>
                        <DateInput
                          value={formData.document_date ? new Date(formData.document_date) : undefined}
                          onChange={(date) => setFormData({ ...formData, document_date: date ? format(date, "yyyy/MM/dd") : "" })}
                          placeholder="YYYY/MM/DD"
                          className="font-inter"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="font-inter">Description</Label>
                      <Textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Description courte"
                        rows={4}
                        dir="ltr"
                        className="font-inter"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="font-inter">Fichier joint (optionnel)</Label>
                      <Input
                        type="file"
                        accept=".pdf,image/png,image/jpeg,image/webp"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setNewFile(file);
                            setNewFileUrl(URL.createObjectURL(file));
                          }
                        }}
                        disabled={isSubmitting}
                        className="font-inter"
                      />
                      {newFile && newFileUrl && (
                        <div className="h-40 rounded-lg border overflow-hidden">
                          {newFile.type === "application/pdf" ? (
                            <iframe src={newFileUrl} className="w-full h-full" title="Preview" />
                          ) : (
                            <img src={newFileUrl} alt="Preview" className="w-full h-full object-contain" />
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 justify-end">
                      <Button type="button" variant="outline" onClick={() => { setIsAddDialogOpen(false); resetForm(); }} className="font-inter">
                        Annuler
                      </Button>
                      <Button type="submit" disabled={isSubmitting} style={{ backgroundColor: '#D4AF37', color: '#2D2926' }} className="font-inter">
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enregistrer"}
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
                    placeholder="Rechercher dans les documents..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-10 font-inter"
                    dir="ltr"
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full md:w-[200px] font-inter">
                    <SelectValue placeholder="Catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="font-inter">Tout</SelectItem>
                    {CATEGORIES_FR.map(cat => (
                      <SelectItem key={cat.value} value={cat.value} className="font-inter">{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-[150px] font-inter">
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="font-inter">Tout</SelectItem>
                    {STATUS_FR.map(s => (
                      <SelectItem key={s.value} value={s.value} className="font-inter">{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Documents Table */}
          <Card>
            <CardHeader>
              <CardTitle className="font-inter">Liste des documents ({filteredDocuments.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredDocuments.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="font-inter">Aucun document trouvé</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[10%] text-right font-inter">N°</TableHead>
                      <TableHead className="w-[30%] text-right font-inter">Titre</TableHead>
                      <TableHead className="w-[15%] text-center font-inter">Catégorie</TableHead>
                      <TableHead className="w-[12%] text-right font-inter">Date</TableHead>
                      <TableHead className="w-[13%] text-center font-inter">Statut</TableHead>
                      <TableHead className="w-[20%] text-left font-inter">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDocuments.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell className="text-right font-mono font-inter">{doc.document_number || "-"}</TableCell>
                        <TableCell className="text-right font-inter">
                          <div className="flex flex-col">
                            <span className="font-medium">{doc.title}</span>
                            {doc.description && (
                              <span className="text-xs text-muted-foreground line-clamp-1">{doc.description}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className="font-inter">{doc.document_type}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-inter">{doc.document_date || "-"}</TableCell>
                        <TableCell className="text-center">
                          <Badge
                            className={cn(
                              "font-inter",
                              doc.status === "En vigueur" && "bg-green-100 text-green-800",
                              doc.status === "Abrogé" && "bg-red-100 text-red-800",
                              doc.status === "Modifié" && "bg-yellow-100 text-yellow-800"
                            )}
                          >
                            {doc.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-left">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setViewDocument(doc)}
                              title="Voir"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {canEdit && !showRecycleBin && (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setEditDocument(doc)}
                                  title="Modifier"
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="text-red-500 hover:text-red-700"
                                  onClick={() => handleDelete(doc.id)}
                                  title="Supprimer"
                                >
                                  <Trash2 className="w-4 h-4" />
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
        </TabsContent>
      </Tabs>

      {/* View Dialog */}
      <Dialog open={!!viewDocument} onOpenChange={() => setViewDocument(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className={activeTab === "ar" ? "font-cairo" : "font-inter"}>
              {activeTab === "ar" ? "تفاصيل الوثيقة" : "Détails du document"}
            </DialogTitle>
          </DialogHeader>
          {viewDocument && (
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">{activeTab === "ar" ? "العنوان" : "Titre"}</Label>
                <p className={`font-medium ${activeTab === "ar" ? "font-cairo" : "font-inter"}`}>{viewDocument.title}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground">{activeTab === "ar" ? "الرقم" : "Numéro"}</Label>
                  <p className={`font-mono ${activeTab === "ar" ? "font-cairo" : "font-inter"}`}>{viewDocument.document_number || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">{activeTab === "ar" ? "التاريخ" : "Date"}</Label>
                  <p className={activeTab === "ar" ? "font-cairo" : "font-inter"}>{viewDocument.document_date || "-"}</p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground">{activeTab === "ar" ? "الفئة" : "Catégorie"}</Label>
                  <Badge variant="secondary" className={activeTab === "ar" ? "font-cairo" : "font-inter"}>
                    {viewDocument.document_type}
                  </Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">{activeTab === "ar" ? "الحالة" : "Statut"}</Label>
                  <Badge className={activeTab === "ar" ? "font-cairo" : "font-inter"}>
                    {viewDocument.status}
                  </Badge>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">{activeTab === "ar" ? "الوصف" : "Description"}</Label>
                <p className={`text-sm ${activeTab === "ar" ? "font-cairo" : "font-inter"}`}>{viewDocument.description || "-"}</p>
              </div>
              {viewDocument.file_url && (
                <div>
                  <Label className="text-muted-foreground">{activeTab === "ar" ? "الملف المرفق" : "Fichier joint"}</Label>
                  <div className="h-64 rounded-lg border overflow-hidden mt-2">
                    {viewDocument.file_url.includes('.pdf') ? (
                      <iframe src={viewDocument.file_url} className="w-full h-full" title="PDF" />
                    ) : (
                      <img src={viewDocument.file_url} alt="Preview" className="w-full h-full object-contain" />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper for conditional class names
function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}
