import { useState, useEffect, useMemo } from "react";
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
import { 
  Loader2, Scale, Plus, Eye, Trash, Search, Trash2, RefreshCcw, FileText, 
  Pencil, ZoomIn, ZoomOut, Printer, Languages, X, ChevronLeft, ChevronRight,
  Download, Maximize2
} from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";

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
  full_text_ar?: string;
  full_text_fr?: string;
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

// Pre-populated Arabic Documents with Full Text (1962-2026)
const INITIAL_DOCUMENTS_AR: LegislativeDocument[] = [
  {
    id: "ar-1",
    title: "القانون رقم 90-29 المتعلق بالتعمير والبناء",
    document_type: "قوانين",
    document_number: "90-29",
    document_date: "1990/12/01",
    description: "القانون الأساسي المنظم للتعمير والبناء واستغلال الأراضي في الجزائر",
    full_text_ar: `
      <h1 class="text-2xl font-bold text-center mb-6">القانون رقم 90-29</h1>
      <h2 class="text-xl font-bold mb-4">المتعلق بالتعمير والبناء</h2>
      
      <div class="mb-6">
        <h3 class="font-bold mb-2">الفصل الأول: أحكام عامة</h3>
        <p class="mb-3"><strong>المادة 1:</strong> يهدف هذا القانون إلى تحديد القواعد العامة للتعمير والبناء واستغلال الأراضي في التراب الوطني.</p>
        <p class="mb-3"><strong>المادة 2:</strong> تعتبر وثائق التعمير وثائق إدارية ملزمة لجميع الأشخاص الطبيعيين والمعنويين.</p>
      </div>

      <div class="mb-6">
        <h3 class="font-bold mb-2">الفصل الثاني: وثائق التعمير</h3>
        <p class="mb-3"><strong>المادة 3:</strong> تتكون وثائق التعمير من:</p>
        <ul class="list-disc pr-6 mb-3">
          <li>المخطط التوجيهي للتهيئة العمرانية (PDAU)</li>
          <li>مخطط شغل الأراضي (POS)</li>
          <li>المخططات القطاعية</li>
        </ul>
      </div>

      <div class="mb-6">
        <h3 class="font-bold mb-2">الفصل الثالث: رخص البناء</h3>
        <p class="mb-3"><strong>المادة 4:</strong> يجب الحصول على رخصة بناء لكل أشغال البناء والتعمير.</p>
        <p class="mb-3"><strong>المادة 5:</strong> تقدم طلبات رخص البناء لدى البلدية المختصة إقليمياً.</p>
      </div>

      <div class="mb-6">
        <h3 class="font-bold mb-2">الفصل الرابع: العقوبات</h3>
        <p class="mb-3"><strong>المادة 6:</strong> يعاقب على مخالفة أحكام هذا القانون بغرامة مالية وهدم الأشغال المخالفة.</p>
      </div>
    `,
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
    description: "يتعلق بإلزامية الحصول على شهادة إتمام البناء للمباني الموجهة للسكن",
    full_text_ar: `
      <h1 class="text-2xl font-bold text-center mb-6">القانون رقم 08-15</h1>
      <h2 class="text-xl font-bold mb-4">المتعلق بشهادة إتمام البناء</h2>
      
      <div class="mb-6">
        <h3 class="font-bold mb-2">أحكام عامة</h3>
        <p class="mb-3"><strong>المادة 1:</strong> يهدف هذا القانون إلى إلزامية الحصول على شهادة إتمام البناء للمباني الموجهة للسكن.</p>
        <p class="mb-3"><strong>المادة 2:</strong> تسلم شهادة إتمام البناء بعد التأكد من مطابقة الأشغال المنجزة للرخصة المسلمة.</p>
      </div>

      <div class="mb-6">
        <h3 class="font-bold mb-2">إجراءات التسليم</h3>
        <p class="mb-3"><strong>المادة 3:</strong> يقدم طلب شهادة إتمام البناء خلال الستة أشهر التي تلي انتهاء الأشغال.</p>
        <p class="mb-3"><strong>المادة 4:</strong> تقوم اللجنة التقنية بمعاينة الموقع خلال الثلاثين يوماً الموالية للطلب.</p>
      </div>
    `,
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
    description: "يحدد كيفيات منح رخص التعمير والشهادات الحضرية",
    full_text_ar: `
      <h1 class="text-2xl font-bold text-center mb-6">المرسوم التنفيذي رقم 15-19</h1>
      <h2 class="text-xl font-bold mb-4">المؤرخ في 25 يناير 2015</h2>
      <h3 class="text-lg font-bold mb-4">يحدد كيفيات منح رخص التعمير والشهادات الحضرية</h3>
      
      <div class="mb-6">
        <p class="mb-3">رئيس الجمهورية،</p>
        <p class="mb-3">بعد الاطلاع على الدستور،</p>
        <p class="mb-3">وبعد الاطلاع على القانون رقم 90-29 المتعلق بالتعمير والبناء،</p>
        <p class="mb-3">وبعد الاطلاع على القانون رقم 08-15 المتعلق بشهادة إتمام البناء،</p>
      </div>

      <div class="mb-6">
        <h3 class="font-bold mb-2">الباب الأول: أحكام عامة</h3>
        <p class="mb-3"><strong>المادة 1:</strong> يهدف هذا المرسوم إلى تحديد كيفيات منح رخص التعمير والشهادات الحضرية.</p>
      </div>

      <div class="mb-6">
        <h3 class="font-bold mb-2">الباب الثاني: رخص التعمير</h3>
        <p class="mb-3"><strong>المادة 2:</strong> تخضع الأشغال التالية لرخصة التعمير:</p>
        <ul class="list-disc pr-6 mb-3">
          <li>أشغال البناء الجديدة</li>
          <li>أشغال الترميم والتغيير</li>
          <li>أشغال الهدم</li>
        </ul>
      </div>

      <div class="mb-6">
        <h3 class="font-bold mb-2">الباب الثالث: الشهادات الحضرية</h3>
        <p class="mb-3"><strong>المادة 3:</strong> تسلم الشهادات الحضرية من قبل رئيس المجلس الشعبي البلدي.</p>
        <p class="mb-3"><strong>المادة 4:</strong> تحدد مدة صلاحية الشهادة الحضرية في سنة واحدة قابلة للتجديد.</p>
      </div>
    `,
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
    description: "تتعلق بهشاشة الموقع والمتطلبات التقنية الخاصة للبناء",
    full_text_ar: `
      <h1 class="text-2xl font-bold text-center mb-6">التعليمة الوزارية رقم 004/2017</h1>
      <h2 class="text-xl font-bold mb-4">المتعلقة بهشاشة الموقع</h2>
      
      <div class="mb-6">
        <h3 class="font-bold mb-2">مقدمة</h3>
        <p class="mb-3">تهدف هذه التعليمة إلى تحديد المتطلبات التقنية الخاصة للبناء في المناطق ذات الهشاشة العالية.</p>
      </div>

      <div class="mb-6">
        <h3 class="font-bold mb-2">الفصل الأول: تعريف هشاشة الموقع</h3>
        <p class="mb-3"><strong>المادة 1:</strong> تعتبر منطقة هشة كل منطقة تتعرض لأخطار طبيعية أو تكنولوجية.</p>
        <p class="mb-3"><strong>المادة 2:</strong> تشمل المناطق الهشة: المناطق الزلزالية، المناطق المعرضة للفيضانات، المناطق الساحلية.</p>
      </div>

      <div class="mb-6">
        <h3 class="font-bold mb-2">الفصل الثاني: المتطلبات التقنية</h3>
        <p class="mb-3"><strong>المادة 3:</strong> يجب احترام القواعد التقنية التالية في المناطق الهشة:</p>
        <ul class="list-disc pr-6 mb-3">
          <li>دراسة التربة إلزامية</li>
          <li>احترام قواعد البناء المضاد للزلازل</li>
          <li>تحديد ارتفاعات البناء حسب طبيعة المنطقة</li>
        </ul>
      </div>
    `,
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
    description: "يتعلق بتسوية وضعية المباني المشيدة على أراضٍ فلاحية أو محمية",
    full_text_ar: `
      <h1 class="text-2xl font-bold text-center mb-6">المنشور رقم 002/2021</h1>
      <h2 class="text-xl font-bold mb-4">المتعلق بتسوية المباني على الأراضي الفلاحية</h2>
      
      <div class="mb-6">
        <h3 class="font-bold mb-2">مقدمة</h3>
        <p class="mb-3">يحدد هذا المنشور إجراءات التقنين الاستثنائية لتسوية وضعية المباني المشيدة على أراضٍ فلاحية أو محمية.</p>
      </div>

      <div class="mb-6">
        <h3 class="font-bold mb-2">الشروط</h3>
        <p class="mb-3"><strong>المادة 1:</strong> يشترط لتسوية الوضعية أن يكون البناء مخصصاً للسكن الرئيسي.</p>
        <p class="mb-3"><strong>المادة 2:</strong> يجب أن يكون البناء منجزاً قبل تاريخ نشر هذا المنشور.</p>
      </div>
    `,
    status: "ساري المفعول",
    keywords: ["تسوية", "أرض فلاحية", "حماية", "تقنين"],
    created_at: "2021/06/10",
  },
];

// Pre-populated French Documents with Full Text
const INITIAL_DOCUMENTS_FR: LegislativeDocument[] = [
  {
    id: "fr-1",
    title: "Loi n° 90-29 relative à l'urbanisme et à la construction",
    document_type: "Lois",
    document_number: "90-29",
    document_date: "1990/12/01",
    description: "Loi fondamentale régissant l'urbanisme, la construction et l'utilisation des terres en Algérie",
    full_text_fr: `
      <h1 class="text-2xl font-bold text-center mb-6">Loi n° 90-29</h1>
      <h2 class="text-xl font-bold mb-4">Relative à l'urbanisme et à la construction</h2>
      
      <div class="mb-6">
        <h3 class="font-bold mb-2">Chapitre I: Dispositions Générales</h3>
        <p class="mb-3"><strong>Article 1:</strong> La présente loi a pour objet de définir les règles générales de l'urbanisme, de la construction et de l'utilisation des terres sur le territoire national.</p>
        <p class="mb-3"><strong>Article 2:</strong> Les documents d'urbanisme sont des documents administratifs obligatoires pour toutes les personnes physiques et morales.</p>
      </div>

      <div class="mb-6">
        <h3 class="font-bold mb-2">Chapitre II: Documents d'Urbanisme</h3>
        <p class="mb-3"><strong>Article 3:</strong> Les documents d'urbanisme comprennent:</p>
        <ul class="list-disc pr-6 mb-3">
          <li>Le Plan Directeur d'Aménagement Urbain (PDAU)</li>
          <li>Le Plan d'Occupation des Sols (POS)</li>
          <li>Les plans sectoriels</li>
        </ul>
      </div>

      <div class="mb-6">
        <h3 class="font-bold mb-2">Chapitre III: Permis de Construire</h3>
        <p class="mb-3"><strong>Article 4:</strong> Un permis de construire est requis pour tous les travaux de construction et d'urbanisme.</p>
        <p class="mb-3"><strong>Article 5:</strong> Les demandes de permis de construire sont déposées auprès de la commune territorialement compétente.</p>
      </div>
    `,
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
    description: "Relative à l'obligation d'obtenir un certificat d'achèvement pour les bâtiments à usage d'habitation",
    full_text_fr: `
      <h1 class="text-2xl font-bold text-center mb-6">Loi n° 08-15</h1>
      <h2 class="text-xl font-bold mb-4">Relative au certificat d'achèvement des travaux</h2>
      
      <div class="mb-6">
        <h3 class="font-bold mb-2">Dispositions Générales</h3>
        <p class="mb-3"><strong>Article 1:</strong> La présente loi a pour objet de rendre obligatoire l'obtention d'un certificat d'achèvement des travaux pour les bâtiments à usage d'habitation.</p>
        <p class="mb-3"><strong>Article 2:</strong> Le certificat d'achèvement est délivré après vérification de la conformité des travaux réalisés au permis délivré.</p>
      </div>

      <div class="mb-6">
        <h3 class="font-bold mb-2">Procédures de Délivrance</h3>
        <p class="mb-3"><strong>Article 3:</strong> La demande de certificat d'achèvement est présentée dans les six mois suivant l'achèvement des travaux.</p>
        <p class="mb-3"><strong>Article 4:</strong> La commission technique procède à la visite des lieux dans les trente jours suivant la demande.</p>
      </div>
    `,
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
    description: "Détermine les modalités d'octroi des permis d'urbanisme et des certificats",
    full_text_fr: `
      <h1 class="text-2xl font-bold text-center mb-6">Décret exécutif n° 15-19</h1>
      <h2 class="text-xl font-bold mb-4">Du 25 janvier 2015</h2>
      <h3 class="text-lg font-bold mb-4">Déterminant les modalités d'octroi des permis d'urbanisme et des certificats</h3>
      
      <div class="mb-6">
        <p class="mb-3">Le Président de la République,</p>
        <p class="mb-3">Vu la Constitution,</p>
        <p class="mb-3">Vu la loi n° 90-29 relative à l'urbanisme et à la construction,</p>
        <p class="mb-3">Vu la loi n° 08-15 relative au certificat d'achèvement des travaux,</p>
      </div>

      <div class="mb-6">
        <h3 class="font-bold mb-2">Titre I: Dispositions Générales</h3>
        <p class="mb-3"><strong>Article 1:</strong> Le présent décret a pour objet de déterminer les modalités d'octroi des permis d'urbanisme et des certificats.</p>
      </div>

      <div class="mb-6">
        <h3 class="font-bold mb-2">Titre II: Permis d'Urbanisme</h3>
        <p class="mb-3"><strong>Article 2:</strong> Sont soumis au permis d'urbanisme les travaux suivants:</p>
        <ul class="list-disc pr-6 mb-3">
          <li>Les travaux de construction nouvelle</li>
          <li>Les travaux de restauration et de modification</li>
          <li>Les travaux de démolition</li>
        </ul>
      </div>
    `,
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
    description: "Relative à la vulnérabilité des sites et aux exigences techniques spécifiques",
    full_text_fr: `
      <h1 class="text-2xl font-bold text-center mb-6">Instruction ministérielle n° 004/2017</h1>
      <h2 class="text-xl font-bold mb-4">Relative à la vulnérabilité des sites</h2>
      
      <div class="mb-6">
        <h3 class="font-bold mb-2">Introduction</h3>
        <p class="mb-3">La présente instruction a pour objet de définir les exigences techniques spécifiques pour la construction dans les zones à haute vulnérabilité.</p>
      </div>

      <div class="mb-6">
        <h3 class="font-bold mb-2">Chapitre I: Définition de la Vulnérabilité</h3>
        <p class="mb-3"><strong>Article 1:</strong> Est considérée comme zone vulnérable toute zone exposée à des risques naturels ou technologiques.</p>
        <p class="mb-3"><strong>Article 2:</strong> Les zones vulnérables comprennent: les zones sismiques, les zones exposées aux inondations, les zones côtières.</p>
      </div>

      <div class="mb-6">
        <h3 class="font-bold mb-2">Chapitre II: Exigences Techniques</h3>
        <p class="mb-3"><strong>Article 3:</strong> Les règles techniques suivantes doivent être respectées dans les zones vulnérables:</p>
        <ul class="list-disc pr-6 mb-3">
          <li>Étude de sol obligatoire</li>
          <li>Respect des règles de construction parasismique</li>
          <li>Détermination des hauteurs de construction selon la nature de la zone</li>
        </ul>
      </div>
    `,
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
    description: "Relative à la régularisation des bâtiments édifiés sur des terres agricoles ou protégées",
    full_text_fr: `
      <h1 class="text-2xl font-bold text-center mb-6">Circulaire n° 002/2021</h1>
      <h2 class="text-xl font-bold mb-4">Relative à la régularisation des bâtiments sur terres agricoles</h2>
      
      <div class="mb-6">
        <h3 class="font-bold mb-2">Introduction</h3>
        <p class="mb-3">La présente circulaire définit les procédures exceptionnelles de régularisation des bâtiments édifiés sur des terres agricoles ou protégées.</p>
      </div>

      <div class="mb-6">
        <h3 class="font-bold mb-2">Conditions</h3>
        <p class="mb-3"><strong>Article 1:</strong> La régularisation est conditionnée par l'affectation du bâtiment à l'habitation principale.</p>
        <p class="mb-3"><strong>Article 2:</strong> Le bâtiment doit être achevé avant la date de publication de la présente circulaire.</p>
      </div>
    `,
    status: "En vigueur",
    keywords: ["régularisation", "terre agricole", "protection", "légalisation"],
    created_at: "2021/06/10",
  },
];

// Document Previewer Component
function DocumentPreviewer({ 
  doc, 
  language, 
  onClose 
}: { 
  doc: LegislativeDocument | null; 
  language: "ar" | "fr" | "both";
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(100);
  const [viewMode, setViewMode] = useState<"single" | "split">("single");
  const [searchTerm, setSearchTerm] = useState("");

  if (!doc) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 10, 150));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 10, 75));
  };

  const renderContent = (text: string, lang: "ar" | "fr") => (
    <div 
      className={`prose max-w-none ${lang === "ar" ? "font-cairo" : "font-inter"}`}
      style={{ 
        fontSize: `${zoom}%`,
        direction: lang === "ar" ? "rtl" : "ltr"
      }}
      dangerouslySetInnerHTML={{ __html: text }}
    />
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-background w-full max-w-7xl h-[90vh] rounded-lg shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <h2 className={`font-bold ${language === "ar" ? "font-cairo" : "font-inter"}`}>
              {doc.title}
            </h2>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Language Toggle */}
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <Button
                variant={viewMode === "single" && language === "ar" ? "default" : "ghost"}
                size="sm"
                onClick={() => { setViewMode("single"); setZoom(100); }}
                className="text-xs h-8"
              >
                عربي
              </Button>
              <Button
                variant={viewMode === "split" ? "default" : "ghost"}
                size="sm"
                onClick={() => { setViewMode("split"); setZoom(100); }}
                className="text-xs h-8"
              >
                <Languages className="w-3 h-3 mr-1" />
                معاً
              </Button>
              <Button
                variant={viewMode === "single" && language === "fr" ? "default" : "ghost"}
                size="sm"
                onClick={() => { setViewMode("single"); setZoom(100); }}
                className="text-xs h-8"
              >
                FR
              </Button>
            </div>

            <Separator orientation="vertical" className="h-6" />

            {/* Zoom Controls */}
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={handleZoomOut} disabled={zoom <= 75}>
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-xs w-12 text-center font-mono">{zoom}%</span>
              <Button variant="ghost" size="icon" onClick={handleZoomIn} disabled={zoom >= 150}>
                <ZoomIn className="w-4 h-4" />
              </Button>
            </div>

            <Separator orientation="vertical" className="h-6" />

            {/* Actions */}
            <Button variant="ghost" size="icon" onClick={handlePrint}>
              <Printer className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon">
              <Download className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setViewMode(viewMode === "single" ? "split" : "single")}>
              <Maximize2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 p-6">
          {viewMode === "split" ? (
            <div className="grid grid-cols-2 gap-6 h-full">
              {/* Arabic */}
              {doc.full_text_ar && (
                <div className="border rounded-lg p-6 bg-muted/20 overflow-auto">
                  <div className="flex items-center gap-2 mb-4">
                    <Badge variant="secondary" className="font-cairo">العربية</Badge>
                  </div>
                  {renderContent(doc.full_text_ar, "ar")}
                </div>
              )}
              
              {/* French */}
              {doc.full_text_fr && (
                <div className="border rounded-lg p-6 bg-muted/20 overflow-auto">
                  <div className="flex items-center gap-2 mb-4">
                    <Badge variant="secondary" className="font-inter">Français</Badge>
                  </div>
                  {renderContent(doc.full_text_fr, "fr")}
                </div>
              )}
            </div>
          ) : (
            <div className="border rounded-lg p-6 bg-muted/20 max-w-4xl mx-auto overflow-auto">
              {language === "ar" && doc.full_text_ar ? (
                <>
                  <div className="flex items-center gap-2 mb-4">
                    <Badge variant="secondary" className="font-cairo">العربية</Badge>
                  </div>
                  {renderContent(doc.full_text_ar, "ar")}
                </>
              ) : language === "fr" && doc.full_text_fr ? (
                <>
                  <div className="flex items-center gap-2 mb-4">
                    <Badge variant="secondary" className="font-inter">Français</Badge>
                  </div>
                  {renderContent(doc.full_text_fr, "fr")}
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>لا يوجد نص متاح للمعاينة / Aucun texte disponible</p>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Footer Info */}
        <div className="flex items-center justify-between p-4 border-t bg-muted/30 text-xs text-muted-foreground">
          <span className={language === "ar" ? "font-cairo" : "font-inter"}>
            {doc.document_number} • {doc.document_date}
          </span>
          <span className={language === "ar" ? "font-cairo" : "font-inter"}>
            {doc.status}
          </span>
        </div>
      </div>
    </div>
  );
}

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
  const [previewLanguage, setPreviewLanguage] = useState<"ar" | "fr" | "both">("ar");
  const [editDocument, setEditDocument] = useState<LegislativeDocument | null>(null);
  const [showRecycleBin, setShowRecycleBin] = useState(false);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
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
        status: activeTab === "ar" ? "ساري المفعول" : "En vigueur",
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

  const handleViewDocument = (doc: LegislativeDocument) => {
    setViewDocument(doc);
    setPreviewLanguage(activeTab);
  };

  // Filtering
  const filteredDocuments = currentDocuments.filter(doc => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = !term ||
      doc.title.toLowerCase().includes(term) ||
      doc.document_number.toLowerCase().includes(term) ||
      doc.description.toLowerCase().includes(term);

    const matchesCategory = categoryFilter === "all" || doc.document_type === categoryFilter;
    const matchesStatus = statusFilter === "all" || doc.status === statusFilter;

    return matchesSearch && matchesCategory && matchesStatus;
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
            <p className="text-muted-foreground text-sm font-cairo">مستعرض الوثائق القانونية (1962-2026)</p>
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
                className="gap-2 font-cairo"
              >
                <Trash2 className="w-4 h-4" />
                {showRecycleBin ? "العودة للقائمة" : "سلة المحذوفات"}
              </Button>
            </div>

            {canEdit && !showRecycleBin && (
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button style={{ backgroundColor: '#D4AF37', color: '#2D2926' }} className="font-cairo">
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

          {/* Documents List with Preview */}
          <div className="grid grid-cols-12 gap-4 min-h-[600px]">
            {/* Left: Document List */}
            <div className="col-span-4">
              <Card className="h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="font-cairo text-lg">فهرس الوثائق ({filteredDocuments.length})</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[550px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="font-cairo">العنوان</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredDocuments.map((doc) => (
                          <TableRow 
                            key={doc.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handleViewDocument(doc)}
                          >
                            <TableCell>
                              <div className="flex flex-col gap-1 py-2">
                                <span className="font-medium font-cairo">{doc.title}</span>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Badge variant="secondary" className="font-cairo text-xs">{doc.document_number}</Badge>
                                  <span className="font-cairo">{doc.document_date}</span>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Right: Preview Panel */}
            <div className="col-span-8">
              <Card className="h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-cairo text-lg">معاينة الوثيقة</CardTitle>
                    <div className="flex items-center gap-2">
                      <Button
                        variant={previewLanguage === "ar" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPreviewLanguage("ar")}
                        className="font-cairo text-xs"
                      >
                        عربي
                      </Button>
                      <Button
                        variant={previewLanguage === "both" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPreviewLanguage("both")}
                        className="font-cairo text-xs"
                      >
                        <Languages className="w-3 h-3 mr-1" />
                        معاً
                      </Button>
                      <Button
                        variant={previewLanguage === "fr" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPreviewLanguage("fr")}
                        className="font-inter text-xs"
                      >
                        FR
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  <ScrollArea className="h-[550px]">
                    {viewDocument ? (
                      <div className="space-y-4">
                        <div className="text-center border-b pb-4">
                          <h3 className="text-xl font-bold font-cairo mb-2">{viewDocument.title}</h3>
                          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                            <Badge variant="secondary" className="font-cairo">{viewDocument.document_type}</Badge>
                            <span className="font-mono">{viewDocument.document_number}</span>
                            <span className="font-cairo">{viewDocument.document_date}</span>
                          </div>
                        </div>
                        
                        {previewLanguage === "ar" && viewDocument.full_text_ar ? (
                          <div 
                            className="prose prose-sm max-w-none font-cairo"
                            dangerouslySetInnerHTML={{ __html: viewDocument.full_text_ar }}
                          />
                        ) : previewLanguage === "fr" && viewDocument.full_text_fr ? (
                          <div 
                            className="prose prose-sm max-w-none font-inter"
                            dangerouslySetInnerHTML={{ __html: viewDocument.full_text_fr }}
                          />
                        ) : previewLanguage === "both" ? (
                          <div className="grid grid-cols-2 gap-4">
                            {viewDocument.full_text_ar && (
                              <div className="border rounded-lg p-4 bg-muted/20">
                                <Badge variant="secondary" className="mb-2 font-cairo">العربية</Badge>
                                <div 
                                  className="prose prose-sm max-w-none font-cairo"
                                  dangerouslySetInnerHTML={{ __html: viewDocument.full_text_ar }}
                                />
                              </div>
                            )}
                            {viewDocument.full_text_fr && (
                              <div className="border rounded-lg p-4 bg-muted/20">
                                <Badge variant="secondary" className="mb-2 font-inter">Français</Badge>
                                <div 
                                  className="prose prose-sm max-w-none font-inter"
                                  dangerouslySetInnerHTML={{ __html: viewDocument.full_text_fr }}
                                />
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-center py-12 text-muted-foreground">
                            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p className="font-cairo">لا يوجد نص متاح للمعاينة</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p className="font-cairo">اختر وثيقة من الفهرس للمعاينة</p>
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* French Content */}
        <TabsContent value="fr" className="space-y-4 mt-4">
          {/* Action Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant={showRecycleBin ? "destructive" : "outline"}
                onClick={() => setShowRecycleBin(!showRecycleBin)}
                className="gap-2 font-inter"
              >
                <Trash2 className="w-4 h-4" />
                {showRecycleBin ? "Retour à la liste" : "Corbeille"}
              </Button>
            </div>

            {canEdit && !showRecycleBin && (
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button style={{ backgroundColor: '#D4AF37', color: '#2D2926' }} className="font-inter">
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

          {/* Documents List with Preview */}
          <div className="grid grid-cols-12 gap-4 min-h-[600px]">
            {/* Left: Document List */}
            <div className="col-span-4">
              <Card className="h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="font-inter text-lg">Liste des documents ({filteredDocuments.length})</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[550px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="font-inter">Titre</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredDocuments.map((doc) => (
                          <TableRow 
                            key={doc.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handleViewDocument(doc)}
                          >
                            <TableCell>
                              <div className="flex flex-col gap-1 py-2">
                                <span className="font-medium font-inter">{doc.title}</span>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Badge variant="secondary" className="font-inter text-xs">{doc.document_number}</Badge>
                                  <span className="font-inter">{doc.document_date}</span>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Right: Preview Panel */}
            <div className="col-span-8">
              <Card className="h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-inter text-lg">Aperçu du document</CardTitle>
                    <div className="flex items-center gap-2">
                      <Button
                        variant={previewLanguage === "ar" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPreviewLanguage("ar")}
                        className="font-cairo text-xs"
                      >
                        عربي
                      </Button>
                      <Button
                        variant={previewLanguage === "both" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPreviewLanguage("both")}
                        className="font-inter text-xs"
                      >
                        <Languages className="w-3 h-3 mr-1" />
                        Ensemble
                      </Button>
                      <Button
                        variant={previewLanguage === "fr" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPreviewLanguage("fr")}
                        className="font-inter text-xs"
                      >
                        FR
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  <ScrollArea className="h-[550px]">
                    {viewDocument ? (
                      <div className="space-y-4">
                        <div className="text-center border-b pb-4">
                          <h3 className="text-xl font-bold font-inter mb-2">{viewDocument.title}</h3>
                          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                            <Badge variant="secondary" className="font-inter">{viewDocument.document_type}</Badge>
                            <span className="font-mono">{viewDocument.document_number}</span>
                            <span className="font-inter">{viewDocument.document_date}</span>
                          </div>
                        </div>
                        
                        {previewLanguage === "fr" && viewDocument.full_text_fr ? (
                          <div 
                            className="prose prose-sm max-w-none font-inter"
                            dangerouslySetInnerHTML={{ __html: viewDocument.full_text_fr }}
                          />
                        ) : previewLanguage === "ar" && viewDocument.full_text_ar ? (
                          <div 
                            className="prose prose-sm max-w-none font-cairo"
                            dangerouslySetInnerHTML={{ __html: viewDocument.full_text_ar }}
                          />
                        ) : previewLanguage === "both" ? (
                          <div className="grid grid-cols-2 gap-4">
                            {viewDocument.full_text_fr && (
                              <div className="border rounded-lg p-4 bg-muted/20">
                                <Badge variant="secondary" className="mb-2 font-inter">Français</Badge>
                                <div 
                                  className="prose prose-sm max-w-none font-inter"
                                  dangerouslySetInnerHTML={{ __html: viewDocument.full_text_fr }}
                                />
                              </div>
                            )}
                            {viewDocument.full_text_ar && (
                              <div className="border rounded-lg p-4 bg-muted/20">
                                <Badge variant="secondary" className="mb-2 font-cairo">العربية</Badge>
                                <div 
                                  className="prose prose-sm max-w-none font-cairo"
                                  dangerouslySetInnerHTML={{ __html: viewDocument.full_text_ar }}
                                />
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-center py-12 text-muted-foreground">
                            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p className="font-inter">Aucun texte disponible pour l'aperçu</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p className="font-inter">Sélectionnez un document dans la liste pour l'aperçu</p>
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Full Preview Dialog */}
      {viewDocument && (
        <DocumentPreviewer 
          doc={viewDocument} 
          language={previewLanguage}
          onClose={() => setViewDocument(null)}
        />
      )}
    </div>
  );
}
