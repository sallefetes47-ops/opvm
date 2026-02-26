import { useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Columns2, FileText, Languages, Printer, Search, FileSpreadsheet, BrainCircuit, Download } from "lucide-react";
import { generateSummary, formatSummaryForDisplay } from "@/lib/ai-summarizer";
import { useToast } from "@/hooks/use-toast";

type PreviewLang = "ar" | "fr";

type CoreDocId = "instruction-004-2017" | "decret-15-19" | "loi-08-15" | "loi-90-29";

interface CoreLegalDocument {
    id: CoreDocId;
    number: string;
    date: string; // YYYY/MM/DD
    type_ar: string;
    type_fr: string;
    title_ar: string;
    title_fr: string;
    keywords: string[];
    html_ar: string;
    html_fr: string;
    official_ar: string;
    official_fr: string;
}

function escapeRegExp(input: string) {
    return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightHtml(html: string, term: string) {
    const q = term.trim();
    if (!q) return html;

    // DOM-based highlighter to avoid breaking HTML tags.
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const re = new RegExp(escapeRegExp(q), "gi");

    const walk = (node: Node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            const tag = el.tagName.toLowerCase();
            if (tag === "script" || tag === "style") return;
            Array.from(node.childNodes).forEach(walk);
            return;
        }

        if (node.nodeType !== Node.TEXT_NODE) return;
        const text = node.nodeValue ?? "";
        if (!re.test(text)) return;

        // Reset regex state after test()
        re.lastIndex = 0;

        const frag = doc.createDocumentFragment();
        let lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(text)) !== null) {
            const start = m.index;
            const end = start + m[0].length;
            const before = text.slice(lastIndex, start);
            if (before) frag.appendChild(doc.createTextNode(before));

            const mark = doc.createElement("mark");
            mark.textContent = text.slice(start, end);
            mark.setAttribute("data-opvm-mark", "1");
            frag.appendChild(mark);

            lastIndex = end;
        }
        const after = text.slice(lastIndex);
        if (after) frag.appendChild(doc.createTextNode(after));

        node.parentNode?.replaceChild(frag, node);
    };

    walk(doc.body);
    return doc.body.innerHTML;
}

const CORE_DOCS: CoreLegalDocument[] = [
    {
        id: "instruction-004-2017",
        number: "004/2017",
        date: "2017/03/15",
        type_ar: "تعليمات وزارية",
        type_fr: "Instructions ministérielles",
        title_ar: "التعليمة 004/2017 المتعلقة بهشاشة الموقع ومعايير البناء",
        title_fr: "Instruction 004/2017 relative à la vulnérabilité des sites et aux critères de construction",
        keywords: ["هشاشة", "vulnérabilité", "دراسة التربة", "parasismique", "معايير البناء"],
        html_ar: `
      <h1 class="text-2xl font-bold text-center mb-6">التعليمة الوزارية رقم 004/2017</h1>
      <h2 class="text-xl font-bold mb-4">المتعلقة بهشاشة الموقع ومعايير البناء</h2>

      <div class="mb-6">
        <h3 class="font-bold mb-2">1) الهدف والنطاق</h3>
        <p class="mb-3">تهدف هذه التعليمة إلى ضبط المقاربة التقنية لتقييم <strong>هشاشة الموقع</strong> وتحديد معايير البناء الواجب احترامها عند إعداد ملفات البناء في المناطق المصنفة ذات حساسية أو أخطار.</p>
      </div>

      <div class="mb-6">
        <h3 class="font-bold mb-2">2) هشاشة الموقع (هشاشة/قابلية التضرر)</h3>
        <p class="mb-3"><strong>تعريف عملي:</strong> تُعد المنطقة هشة عندما تكون معرّضة لأخطار طبيعية أو تكنولوجية أو عندما تُظهر خصائص جيولوجية/هيدروجيولوجية تُضعف استقرار المنشآت.</p>
        <ul class="list-disc pr-6 mb-3">
          <li>مناطق زلزالية.</li>
          <li>مناطق فيضانات/مجاري أودية.</li>
          <li>مناطق انزلاقات/تربة ضعيفة أو قابلة للانتفاخ.</li>
          <li>حواف صخرية/منحدرات/مناطق انهيارات.</li>
        </ul>
      </div>

      <div class="mb-6">
        <h3 class="font-bold mb-2">3) معايير البناء والاشتراطات التقنية</h3>
        <p class="mb-3">تُرفق ملفات البناء في المناطق الهشة، حسب الحالة، بعناصر تقنية إضافية لضمان السلامة والاستدامة:</p>
        <ol class="list-decimal pr-6 mb-3">
          <li><strong>دراسة التربة</strong> إلزامية وتُكيَّف مع نوع الخطر (ميكانيك التربة/الهيدرولوجيا/الاستقرار).</li>
          <li><strong>قواعد البناء المضاد للزلازل</strong> وتكييف النظام الإنشائي حسب التصنيف الزلزالي.</li>
          <li><strong>ضبط الارتفاعات والكثافة</strong> بما يتلاءم مع استقرار الموقع وقدرة البنية التحتية.</li>
          <li><strong>تدابير الحماية</strong>: تصريف مياه الأمطار، حماية الأساسات، حواجز/تدعيم عند اللزوم.</li>
          <li><strong>الارتدادات/المسافات الآمنة</strong> عن مجاري السيول والمنحدرات وشبكات المخاطر.</li>
        </ol>
      </div>

      <div class="mb-6">
        <h3 class="font-bold mb-2">4) مخرجات ملف التقييم</h3>
        <p class="mb-3">يُدرج ضمن الملف: تشخيص موقع، توصيات تقنية، مخطط تدابير تخفيف الخطر، وتحديد التزامات المتابعة أثناء الإنجاز.</p>
      </div>
    `,
        html_fr: `
      <h1 class="text-2xl font-bold text-center mb-6">Instruction ministérielle n° 004/2017</h1>
      <h2 class="text-xl font-bold mb-4">Relative à la vulnérabilité des sites et aux critères de construction</h2>

      <div class="mb-6">
        <h3 class="font-bold mb-2">1) Objet et champ d'application</h3>
        <p class="mb-3">Cette instruction fixe une approche technique d'évaluation de la <strong>vulnérabilité des sites</strong> et précise des critères à intégrer dans les dossiers de construction pour les zones exposées à des aléas.</p>
      </div>

      <div class="mb-6">
        <h3 class="font-bold mb-2">2) Vulnérabilité du site</h3>
        <p class="mb-3"><strong>Définition opérationnelle :</strong> un site est dit vulnérable lorsqu'il est exposé à des risques naturels/technologiques ou présente des caractéristiques géotechniques et hydrologiques défavorables à la stabilité des ouvrages.</p>
        <ul class="list-disc pl-6 mb-3">
          <li>Zones sismiques.</li>
          <li>Zones inondables / oueds.</li>
          <li>Zones de glissement / sols faibles ou gonflants.</li>
          <li>Falaises / pentes / instabilités.</li>
        </ul>
      </div>

      <div class="mb-6">
        <h3 class="font-bold mb-2">3) Critères de construction (exigences techniques)</h3>
        <p class="mb-3">Selon la nature du risque, le dossier de construction doit être complété par des pièces techniques renforcées :</p>
        <ol class="list-decimal pl-6 mb-3">
          <li><strong>Étude de sol</strong> obligatoire et adaptée (géotechnique, hydrologie, stabilité).</li>
          <li><strong>Respect des règles parasismiques</strong> et choix du système structurel conforme.</li>
          <li><strong>Maîtrise des hauteurs et de la densité</strong> au regard de la capacité du site et des réseaux.</li>
          <li><strong>Mesures de protection</strong> : drainage, protection des fondations, soutènements si nécessaire.</li>
          <li><strong>Reculs et distances de sécurité</strong> vis-à-vis des couloirs d'écoulement et des zones instables.</li>
        </ol>
      </div>

      <div class="mb-6">
        <h3 class="font-bold mb-2">4) Sorties attendues</h3>
        <p class="mb-3">Le dossier comprend : diagnostic du site, recommandations, plan de réduction du risque et modalités de suivi en phase travaux.</p>
      </div>
    `,
        official_ar: "https://www.mhatre.dz/Instructions/004-2017.pdf",
        official_fr: "https://www.mhatre.dz/Instructions/004-2017.pdf",
    },
    {
        id: "decret-15-19",
        number: "15-19",
        date: "2015/01/25",
        type_ar: "مرسوم تنفيذي",
        type_fr: "Décret exécutif",
        title_ar: "المرسوم 15-19: رخص وشهادات التعمير الخمس",
        title_fr: "Décret 15-19 : les cinq permis / certificats d'urbanisme",
        keywords: ["رخصة البناء", "رخصة التجزئة", "رخصة الهدم", "شهادة التعمير", "شهادة المطابقة"],
        html_ar: `
      <h1 class="text-2xl font-bold text-center mb-6">المرسوم التنفيذي رقم 15-19</h1>
      <h2 class="text-xl font-bold mb-4">يحدد كيفيات منح رخص التعمير والشهادات الحضرية</h2>
      <p class="mb-6 text-sm text-muted-foreground">التاريخ: 2015/01/25</p>

      <div class="mb-6">
        <h3 class="font-bold mb-2">1) المبادئ العامة</h3>
        <p class="mb-3">يؤطر هذا المرسوم مسار إيداع ودراسة ومنح وثائق التعمير، مع احترام وثائق التهيئة (PDAU/POS) والأنظمة التقنية.</p>
      </div>

      <div class="mb-6">
        <h3 class="font-bold mb-2">2) رخص وشهادات التعمير الخمس (محور تطبيقي)</h3>
        <ol class="list-decimal pr-6 mb-3">
          <li><strong>رخصة البناء</strong>: تمنح لإنجاز البناء الجديد أو التوسعة/التعديل وفق الشروط.</li>
          <li><strong>رخصة التجزئة</strong>: تخص تقسيم العقار إلى قطع للبناء مع احترام الشبكات والارتفاقات.</li>
          <li><strong>رخصة الهدم</strong>: تُطلب قبل أشغال الهدم (خاصة بالمناطق المحمية أو ذات تنظيم خاص).</li>
          <li><strong>شهادة التعمير</strong>: تُبيّن قابلية التعمير والقيود التنظيمية وشروط الربط.</li>
          <li><strong>شهادة المطابقة</strong>: تُثبت مطابقة الأشغال المنجزة للرخصة المسلمة عند نهاية الأشغال.</li>
        </ol>
      </div>

      <div class="mb-6">
        <h3 class="font-bold mb-2">3) عناصر الملف (إطار عام)</h3>
        <ul class="list-disc pr-6 mb-3">
          <li>هوية صاحب الطلب وملكية/حيازة العقار.</li>
          <li>مخططات معمارية/تقنية وفق طبيعة الرخصة.</li>
          <li>مطابقة المشروع لوثائق التعمير والارتفاقات.</li>
          <li>عند الاقتضاء: دراسات تقنية (تربة/هشاشة/سلامة) حسب موقع المشروع.</li>
        </ul>
      </div>
    `,
        html_fr: `
      <h1 class="text-2xl font-bold text-center mb-6">Décret exécutif n° 15-19</h1>
      <h2 class="text-xl font-bold mb-4">Fixant les modalités de délivrance des permis et certificats d'urbanisme</h2>
      <p class="mb-6 text-sm text-muted-foreground">Date : 2015/01/25</p>

      <div class="mb-6">
        <h3 class="font-bold mb-2">1) Principes généraux</h3>
        <p class="mb-3">Le décret encadre le dépôt, l'instruction et la délivrance des actes d'urbanisme, en cohérence avec les documents d'urbanisme (PDAU/POS) et les normes techniques applicables.</p>
      </div>

      <div class="mb-6">
        <h3 class="font-bold mb-2">2) Les cinq permis / certificats (axe opérationnel)</h3>
        <ol class="list-decimal pl-6 mb-3">
          <li><strong>Permis de construire</strong> : autorise la construction nouvelle et certains travaux selon les règles.</li>
          <li><strong>Permis de lotir</strong> : concerne la division foncière à des fins de construction (réseaux, servitudes, voirie).</li>
          <li><strong>Permis de démolir</strong> : requis pour les opérations de démolition, notamment en zones réglementées.</li>
          <li><strong>Certificat d'urbanisme</strong> : précise la constructibilité et les contraintes (règles, raccordements, servitudes).</li>
          <li><strong>Certificat de conformité</strong> : atteste la conformité des travaux au permis délivré en fin de chantier.</li>
        </ol>
      </div>

      <div class="mb-6">
        <h3 class="font-bold mb-2">3) Pièces générales du dossier</h3>
        <ul class="list-disc pl-6 mb-3">
          <li>Identité du demandeur et titre/justificatif foncier.</li>
          <li>Plans architecturaux et pièces techniques selon l'acte demandé.</li>
          <li>Conformité au PDAU/POS et aux servitudes.</li>
          <li>Le cas échéant : études (sol, vulnérabilité, sécurité) en fonction du site.</li>
        </ul>
      </div>
    `,
        official_ar: "https://www.joradp.dz/AR/07/2015",
        official_fr: "https://www.joradp.dz/FR/07/2015",
    },
    {
        id: "loi-08-15",
        number: "08-15",
        date: "2008/07/19",
        type_ar: "قانون",
        type_fr: "Loi",
        title_ar: "قانون 08-15: شهادة إتمام البناء ومعايير الإتمام/التسوية",
        title_fr: "Loi 08-15 : certificat d'achèvement et exigences de conformité",
        keywords: ["إتمام", "achèvement", "مطابقة", "conformité", "تسوية"],
        html_ar: `
      <h1 class="text-2xl font-bold text-center mb-6">القانون رقم 08-15</h1>
      <h2 class="text-xl font-bold mb-4">المتعلق بشهادة إتمام البناء</h2>
      <p class="mb-6 text-sm text-muted-foreground">التاريخ: 2008/07/19</p>

      <div class="mb-6">
        <h3 class="font-bold mb-2">1) المبدأ</h3>
        <p class="mb-3">يهدف القانون إلى ترسيخ إلزامية الحصول على <strong>شهادة إتمام البناء</strong> بعد انتهاء الأشغال، باعتبارها أداة ضبط لمطابقة الإنجاز للرخص المسلمة.</p>
      </div>

      <div class="mb-6">
        <h3 class="font-bold mb-2">2) معايير الإتمام والمطابقة</h3>
        <ul class="list-disc pr-6 mb-3">
          <li>إنجاز الأشغال الأساسية كما وردت في الرخصة (مساحات/واجهات/علو/استعمال).</li>
          <li>سلامة العناصر التقنية والربط بالشبكات وفق الإمكانات القانونية.</li>
          <li>احترام الارتفاقات والارتدادات وعدم الاعتداء على المجال العام.</li>
        </ul>
      </div>

      <div class="mb-6">
        <h3 class="font-bold mb-2">3) التسوية وإتمام الأشغال</h3>
        <p class="mb-3">تُعالج وضعيات عدم الإتمام أو الانحرافات وفق مسارات تسوية/تصحيح، عبر استكمال الأشغال أو مواءمة الوضعية بما يضمن العودة إلى المطابقة قبل طلب الشهادة.</p>
      </div>
    `,
        html_fr: `
      <h1 class="text-2xl font-bold text-center mb-6">Loi n° 08-15</h1>
      <h2 class="text-xl font-bold mb-4">Relative au certificat d'achèvement des travaux</h2>
      <p class="mb-6 text-sm text-muted-foreground">Date : 2008/07/19</p>

      <div class="mb-6">
        <h3 class="font-bold mb-2">1) Principe</h3>
        <p class="mb-3">La loi consacre l'obligation d'obtenir un <strong>certificat d'achèvement</strong> à la fin des travaux, en tant qu'outil de contrôle de la conformité des réalisations au permis délivré.</p>
      </div>

      <div class="mb-6">
        <h3 class="font-bold mb-2">2) Exigences d'achèvement et de conformité</h3>
        <ul class="list-disc pl-6 mb-3">
          <li>Réalisation des travaux essentiels selon l'autorisation (surfaces, façades, hauteur, destination).</li>
          <li>Sécurité technique et raccordements selon les conditions réglementaires.</li>
          <li>Respect des servitudes, des reculs, et non-atteinte au domaine public.</li>
        </ul>
      </div>

      <div class="mb-6">
        <h3 class="font-bold mb-2">3) Régularisation et achèvement</h3>
        <p class="mb-3">Les situations d'inachèvement ou de non-conformité sont traitées par des démarches de mise en conformité : achèvement des travaux, corrections, et validation avant la demande du certificat.</p>
      </div>
    `,
        official_ar: "https://www.joradp.dz/AR/44/2008",
        official_fr: "https://www.joradp.dz/FR/44/2008",
    },
    {
        id: "loi-90-29",
        number: "90-29",
        date: "1990/12/01",
        type_ar: "قانون",
        type_fr: "Loi",
        title_ar: "قانون 90-29: الإطار الأساسي للتعمير والبناء",
        title_fr: "Loi 90-29 : cadre fondamental de l'urbanisme et de la construction",
        keywords: ["PDAU", "POS", "التعمير", "urbanisme", "رخص"],
        html_ar: `
      <h1 class="text-2xl font-bold text-center mb-6">القانون رقم 90-29</h1>
      <h2 class="text-xl font-bold mb-4">المتعلق بالتعمير والبناء</h2>
      <p class="mb-6 text-sm text-muted-foreground">التاريخ: 1990/12/01</p>

      <div class="mb-6">
        <h3 class="font-bold mb-2">1) الغاية</h3>
        <p class="mb-3">يضع هذا القانون القواعد العامة لاستعمال الأراضي وتنظيم العمران، ويؤسس لمنظومة وثائق التهيئة، ويربط منح الرخص باحترام القواعد العمرانية.</p>
      </div>

      <div class="mb-6">
        <h3 class="font-bold mb-2">2) وثائق التعمير (مرتكزات)</h3>
        <ul class="list-disc pr-6 mb-3">
          <li><strong>PDAU</strong>: المخطط التوجيهي للتهيئة والتعمير (توجهات عامة).</li>
          <li><strong>POS</strong>: مخطط شغل الأراضي (قواعد تفصيلية وارتفاقات).</li>
        </ul>
      </div>

      <div class="mb-6">
        <h3 class="font-bold mb-2">3) رخص التعمير والرقابة</h3>
        <p class="mb-3">يربط القانون إنجاز الأشغال بالحصول على الرخص/الشهادات، ويؤسس لرقابة المطابقة ومحاربة البناء غير الشرعي.</p>
      </div>
    `,
        html_fr: `
      <h1 class="text-2xl font-bold text-center mb-6">Loi n° 90-29</h1>
      <h2 class="text-xl font-bold mb-4">Relative à l'urbanisme et à la construction</h2>
      <p class="mb-6 text-sm text-muted-foreground">Date : 1990/12/01</p>

      <div class="mb-6">
        <h3 class="font-bold mb-2">1) Finalité</h3>
        <p class="mb-3">Cette loi fixe les règles générales d'utilisation des sols et d'organisation urbaine. Elle structure les documents d'urbanisme et conditionne la délivrance des actes au respect des règles applicables.</p>
      </div>

      <div class="mb-6">
        <h3 class="font-bold mb-2">2) Documents d'urbanisme (socle)</h3>
        <ul class="list-disc pl-6 mb-3">
          <li><strong>PDAU</strong> : Plan Directeur d'Aménagement et d'Urbanisme (orientations générales).</li>
          <li><strong>POS</strong> : Plan d'Occupation des Sols (règles détaillées, servitudes).</li>
        </ul>
      </div>

      <div class="mb-6">
        <h3 class="font-bold mb-2">3) Actes d'urbanisme et contrôle</h3>
        <p class="mb-3">La loi subordonne l'exécution des travaux à l'obtention d'autorisations et instaure le contrôle de conformité pour lutter contre les constructions illicites.</p>
      </div>
    `,
    },
];

function DocHtml({ html, lang, className }: { html: string; lang: PreviewLang; className?: string }) {
    return (
        <div
            className={cn(
                "prose max-w-none",
                lang === "ar" ? "font-cairo" : "font-inter",
                className
            )}
            style={{ direction: lang === "ar" ? "rtl" : "ltr" }}
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}

export default function LegalArchive() {
    const { toast } = useToast();
    const [listQuery, setListQuery] = useState("");
    const [selectedId, setSelectedId] = useState<CoreDocId>("loi-90-29");
    const [previewLang, setPreviewLang] = useState<PreviewLang>("ar");
    const [sideBySide, setSideBySide] = useState(false);
    const [textQuery, setTextQuery] = useState("");
    const [summaryOpen, setSummaryOpen] = useState(false);
    const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);

    const selectedDoc = useMemo(() => CORE_DOCS.find((d) => d.id === selectedId)!, [selectedId]);

    const filteredDocs = useMemo(() => {
        const q = listQuery.trim().toLowerCase();
        if (!q) return CORE_DOCS;
        return CORE_DOCS.filter((d) => {
            const hay = [
                d.number,
                d.date,
                d.title_ar,
                d.title_fr,
                d.type_ar,
                d.type_fr,
                ...d.keywords,
            ]
                .join(" ")
                .toLowerCase();
            return hay.includes(q);
        });
    }, [listQuery]);

    const htmlAr = useMemo(
        () => highlightHtml(selectedDoc.html_ar, textQuery),
        [selectedDoc.html_ar, textQuery]
    );
    const htmlFr = useMemo(
        () => highlightHtml(selectedDoc.html_fr, textQuery),
        [selectedDoc.html_fr, textQuery]
    );

    // Side-by-side synchronized scrolling (French LEFT, Arabic RIGHT)
    const frColRef = useRef<HTMLDivElement | null>(null);
    const arColRef = useRef<HTMLDivElement | null>(null);
    const syncingRef = useRef(false);

    const syncScroll = (from: HTMLDivElement, to: HTMLDivElement) => {
        const fromMax = Math.max(1, from.scrollHeight - from.clientHeight);
        const toMax = Math.max(1, to.scrollHeight - to.clientHeight);
        const ratio = from.scrollTop / fromMax;
        to.scrollTop = ratio * toMax;
    };

    const handleScrollFr = () => {
        if (syncingRef.current) return;
        const from = frColRef.current;
        const to = arColRef.current;
        if (!from || !to) return;
        syncingRef.current = true;
        syncScroll(from, to);
        requestAnimationFrame(() => {
            syncingRef.current = false;
        });
    };

    const handleScrollAr = () => {
        if (syncingRef.current) return;
        const from = arColRef.current;
        const to = frColRef.current;
        if (!from || !to) return;
        syncingRef.current = true;
        syncScroll(from, to);
        requestAnimationFrame(() => {
            syncingRef.current = false;
        });
    };

    const handlePrintToPdf = () => {
        // Print only the preview content (clean output for "Save to PDF").
        const w = window.open("", "_blank", "noopener,noreferrer");
        if (!w) return;

        const docTitle = `${selectedDoc.number} - ${selectedDoc.date}`;
        const body = sideBySide
            ? `
        <div class="grid">
          <div class="col fr" dir="ltr">${htmlFr}</div>
          <div class="col ar" dir="rtl">${htmlAr}</div>
        </div>
      `
            : previewLang === "ar"
                ? `<div class="single ar" dir="rtl">${htmlAr}</div>`
                : `<div class="single fr" dir="ltr">${htmlFr}</div>`;

        w.document.open();
        w.document.write(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${docTitle}</title>
    <style>
      @page { margin: 16mm; }
      html, body { height: 100%; }
      body { margin: 0; padding: 0; color: #111827; }
      /* Font fallbacks if web fonts are unavailable */
      .ar { font-family: Cairo, system-ui, -apple-system, "Segoe UI", Arial, sans-serif; }
      .fr { font-family: Inter, system-ui, -apple-system, "Segoe UI", Arial, sans-serif; }
      .container { padding: 16px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
      .col { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
      .single { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
      mark { background: #fde68a; padding: 0 2px; }
      h1,h2,h3 { margin: 0 0 12px; }
      p,li { line-height: 1.65; }
      .text-muted-foreground { color: #6b7280; }
    </style>
  </head>
  <body>
    <div class="container">
      ${body}
    </div>
    <script>
      window.onload = () => { window.print(); };
    </script>
  </body>
</html>`);
        w.document.close();
    };

    const handleOpenSummary = () => {
        setSummaryOpen(true);
    };

    const handleOpenPdfPreview = () => {
        setPdfPreviewOpen(true);
    };

    const summary = useMemo(() => generateSummary(selectedDoc.id, selectedDoc.html_ar), [selectedDoc]);
    const formattedSummary = useMemo(() => formatSummaryForDisplay(summary), [summary]);

    // Get PDF path for local preview
    const getPdfPath = (docId: string) => {
        const pdfMap: Record<string, string> = {
            "instruction-004-2017": "/documents/legislations/instruction-004-2017.pdf",
            "decret-15-19": "/documents/legislations/decret-15-19.pdf",
            "loi-08-15": "/documents/legislations/loi-08-15.pdf",
            "loi-90-29": "/documents/legislations/loi-90-29.pdf",
        };
        return pdfMap[docId] || "";
    };

    return (
        <div className="space-y-4">
            {/* Module Header */}
            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                            <FileText className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold font-cairo">مستعرض النصوص القانونية</h1>
                            <p className="text-muted-foreground text-sm font-cairo">Document Previewer (1962 - 2026)</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="font-cairo"
                            onClick={handleOpenPdfPreview}
                        >
                            <FileSpreadsheet className="w-4 h-4 ml-2" />
                            معاينة PDF
                        </Button>
                        <Button
                            variant="default"
                            size="sm"
                            className="font-cairo"
                            onClick={handleOpenSummary}
                        >
                            <BrainCircuit className="w-4 h-4 ml-2" />
                            ملخص ذكي
                        </Button>
                    </div>
                </div>

                {/* Search by Number Bar */}
                <div className="flex items-center gap-3 bg-muted/30 p-3 rounded-lg border">
                    <Search className="w-4 h-4 text-muted-foreground" />
                    <span className="font-cairo text-sm font-semibold">البحث برقم النص:</span>
                    <Input
                        value={listQuery}
                        onChange={(e) => setListQuery(e.target.value)}
                        placeholder="مثال: 15-19، 22-55، 004/2017، 08-15، 90-29"
                        className="flex-1 font-cairo font-mono"
                        dir="ltr"
                    />
                </div>
            </div>

            <div className="grid grid-cols-12 gap-4 min-h-[650px]">
                {/* LEFT (25%) — List */}
                <div className="col-span-12 lg:col-span-3">
                    <Card className="h-full">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base font-bold font-cairo">القائمة</CardTitle>
                            <div className="relative mt-2">
                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    value={listQuery}
                                    onChange={(e) => setListQuery(e.target.value)}
                                    placeholder="بحث / Recherche"
                                    className="pr-10"
                                />
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <ScrollArea className="h-[560px]">
                                <div className="p-2">
                                    {filteredDocs.map((d) => {
                                        const active = d.id === selectedId;
                                        return (
                                            <button
                                                key={d.id}
                                                type="button"
                                                onClick={() => setSelectedId(d.id)}
                                                className={cn(
                                                    "w-full text-left rounded-lg border px-3 py-3 mb-2 transition-colors",
                                                    active
                                                        ? "bg-[#D4AF37]/15 border-[#D4AF37]/40"
                                                        : "hover:bg-muted/40 border-border"
                                                )}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <div className="font-cairo font-semibold leading-6 truncate" dir="rtl">
                                                            {d.title_ar}
                                                        </div>
                                                        <div className="font-inter text-xs text-muted-foreground leading-5 truncate" dir="ltr">
                                                            {d.title_fr}
                                                        </div>
                                                    </div>
                                                    <Badge variant="secondary" className="shrink-0 font-mono">
                                                        {d.number}
                                                    </Badge>
                                                </div>
                                                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                                                    <span className="font-cairo" dir="rtl">{d.type_ar}</span>
                                                    <span className="font-mono" dir="ltr">{d.date}</span>
                                                </div>
                                            </button>
                                        );
                                    })}

                                    {filteredDocs.length === 0 && (
                                        <div className="p-6 text-center text-muted-foreground">
                                            <p className="font-cairo" dir="rtl">لا توجد نتائج</p>
                                            <p className="font-inter text-xs" dir="ltr">Aucun résultat</p>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>

                {/* RIGHT (75%) — Preview */}
                <div className="col-span-12 lg:col-span-9">
                    <Card className="h-full">
                        <CardHeader className="pb-2">
                            <div className="flex flex-col gap-3">
                                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                                    <CardTitle className="text-base font-bold font-cairo">Preview</CardTitle>

                                    {/* Permanent Language toggle + Side-by-side */}
                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant={!sideBySide && previewLang === "ar" ? "default" : "ghost"}
                                                className="h-8 text-xs font-cairo"
                                                onClick={() => {
                                                    setSideBySide(false);
                                                    setPreviewLang("ar");
                                                }}
                                            >
                                                عربي
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant={!sideBySide && previewLang === "fr" ? "default" : "ghost"}
                                                className="h-8 text-xs font-inter"
                                                onClick={() => {
                                                    setSideBySide(false);
                                                    setPreviewLang("fr");
                                                }}
                                            >
                                                FR
                                            </Button>
                                        </div>

                                        <Button
                                            type="button"
                                            size="sm"
                                            variant={sideBySide ? "default" : "outline"}
                                            className="h-8 text-xs font-cairo"
                                            onClick={() => setSideBySide((v) => !v)}
                                        >
                                            <Columns2 className="w-4 h-4 ml-2" />
                                            جنباً إلى جنب
                                        </Button>

                                        <Separator orientation="vertical" className="hidden lg:block h-6" />

                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="h-8 text-xs"
                                            onClick={handlePrintToPdf}
                                            title="Print to PDF"
                                        >
                                            <Printer className="w-4 h-4 ml-2" />
                                            Print
                                        </Button>
                                    </div>
                                </div>

                                {/* Search Text bar (inside preview) */}
                                <div className="flex flex-col lg:flex-row gap-2">
                                    <div className="relative flex-1">
                                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <Input
                                            value={textQuery}
                                            onChange={(e) => setTextQuery(e.target.value)}
                                            placeholder="Search text داخل النص / Rechercher"
                                            className="pr-10"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Languages className="w-4 h-4" />
                                        <span className="font-mono">{selectedDoc.number}</span>
                                        <span className="font-mono">{selectedDoc.date}</span>
                                    </div>
                                </div>
                            </div>
                        </CardHeader>

                        <CardContent className="pt-0">
                            {sideBySide ? (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    {/* LEFT — French */}
                                    <div className="border rounded-lg bg-muted/10">
                                        <div className="flex items-center justify-between p-3 border-b">
                                            <Badge variant="secondary" className="font-inter">
                                                Français
                                            </Badge>
                                        </div>
                                        <div
                                            ref={frColRef}
                                            onScroll={handleScrollFr}
                                            className="h-[520px] overflow-auto p-4"
                                        >
                                            <DocHtml html={htmlFr} lang="fr" />
                                        </div>
                                    </div>

                                    {/* RIGHT — Arabic */}
                                    <div className="border rounded-lg bg-muted/10">
                                        <div className="flex items-center justify-between p-3 border-b">
                                            <Badge variant="secondary" className="font-cairo">
                                                العربية
                                            </Badge>
                                        </div>
                                        <div
                                            ref={arColRef}
                                            onScroll={handleScrollAr}
                                            className="h-[520px] overflow-auto p-4"
                                        >
                                            <DocHtml html={htmlAr} lang="ar" />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="border rounded-lg bg-muted/10">
                                    <div className="flex items-center justify-between p-3 border-b">
                                        <Badge variant="secondary" className={previewLang === "ar" ? "font-cairo" : "font-inter"}>
                                            {previewLang === "ar" ? "العربية" : "Français"}
                                        </Badge>
                                    </div>
                                    <ScrollArea className="h-[520px]">
                                        <div className="p-4">
                                            {previewLang === "ar" ? (
                                                <DocHtml html={htmlAr} lang="ar" />
                                            ) : (
                                                <DocHtml html={htmlFr} lang="fr" />
                                            )}
                                        </div>
                                    </ScrollArea>
                                </div>
                            )}

                            <div className="mt-3 text-xs text-muted-foreground">
                                <span className="font-cairo" dir="rtl">بدون تذييل — للطباعة إلى PDF استخدم زر Print.</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* AI Summary Dialog */}
            <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="font-cairo text-xl">
                            <BrainCircuit className="w-5 h-5 inline ml-2" />
                            الملخص الذكي - {selectedDoc.number}
                        </DialogTitle>
                        <DialogDescription className="font-cairo">
                            {selectedDoc.title_ar}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 mt-4">
                        {/* Objectif */}
                        <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                            <h3 className="font-cairo font-bold text-lg mb-3 text-blue-800 dark:text-blue-300 flex items-center gap-2">
                                <span className="text-2xl">📋</span>
                                الهدف (Objectif)
                            </h3>
                            <ul className="space-y-2 mr-6">
                                {summary.objectif.map((item, i) => (
                                    <li key={i} className="font-cairo text-sm text-foreground">
                                        <span className="text-blue-600 dark:text-blue-400 ml-2">•</span>
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Conditions */}
                        <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                            <h3 className="font-cairo font-bold text-lg mb-3 text-amber-800 dark:text-amber-300 flex items-center gap-2">
                                <span className="text-2xl">⚠️</span>
                                الشروط (Conditions)
                            </h3>
                            <ul className="space-y-2 mr-6">
                                {summary.conditions.map((item, i) => (
                                    <li key={i} className="font-cairo text-sm text-foreground">
                                        <span className="text-amber-600 dark:text-amber-400 ml-2">•</span>
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Procedures */}
                        <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                            <h3 className="font-cairo font-bold text-lg mb-3 text-green-800 dark:text-green-300 flex items-center gap-2">
                                <span className="text-2xl">✅</span>
                                الإجراءات (Procedures)
                            </h3>
                            <ul className="space-y-2 mr-6">
                                {summary.procedures.map((item, i) => (
                                    <li key={i} className="font-cairo text-sm text-foreground">
                                        <span className="text-green-600 dark:text-green-400 ml-2">•</span>
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Raw text for copying */}
                        <div className="bg-muted p-3 rounded-lg border">
                            <p className="font-cairo text-xs text-muted-foreground mb-2">نسخ الملخص:</p>
                            <pre className="font-cairo text-sm whitespace-pre-wrap" dir="rtl">
                                {formattedSummary}
                            </pre>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* PDF Preview Dialog */}
            <Dialog open={pdfPreviewOpen} onOpenChange={setPdfPreviewOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0">
                    <DialogHeader className="p-4 border-b">
                        <DialogTitle className="font-cairo">
                            معاينة PDF - {selectedDoc.number}
                        </DialogTitle>
                        <DialogDescription className="font-cairo">
                            {selectedDoc.title_ar}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="p-4">
                        <div className="border rounded-lg overflow-hidden" style={{ height: '70vh' }}>
                            <iframe
                                src={getPdfPath(selectedDoc.id)}
                                className="w-full h-full"
                                title={`PDF Preview - ${selectedDoc.number}`}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground mt-2 font-cairo">
                            ملاحظة: إذا لم يظهر PDF، تأكد من وجود الملف في: {getPdfPath(selectedDoc.id)}
                        </p>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

