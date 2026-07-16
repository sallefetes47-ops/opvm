import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, CheckCircle2 } from "lucide-react";

interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  changes: string[];
}

const entries: ChangelogEntry[] = [
  {
    version: "1.0.0",
    date: "2026",
    title: "الإصدار الرسمي الأول",
    changes: [
      "إطلاق المنصة الرسمية لديوان حماية وادي ميزاب وترقيته.",
      "إعداد الهوية البصرية (الوضع الداكن، اللون الذهبي #D4AF37، خط Cairo).",
      "دعم كامل للواجهة العربية باتجاه RTL.",
    ],
  },
  {
    version: "0.9.0",
    date: "2026",
    title: "تعزيز الأمان والصلاحيات",
    changes: [
      "تطبيق نظام الأدوار (مدير، موظف، مشاهد) عبر جدول user_roles منفصل.",
      "تفعيل سياسات الأمان على مستوى الصفوف (RLS) لجميع الجداول.",
      "منع الاستدعاء المباشر لدالة get_user_role من العميل واعتماد الاستعلام الآمن.",
      "شاشة قفل الجلسة عند الخمول لحماية البيانات.",
    ],
  },
  {
    version: "0.8.0",
    date: "2026",
    title: "سلة المحذوفات وإدارة البيانات",
    changes: [
      "إضافة سلة المحذوفات مع إمكانية الاستعادة أو الحذف النهائي.",
      "عرض اسم صاحب الملف ورقم الملف ونوع عقد التعمير في سلة المحذوفات.",
      "نظام النسخ الاحتياطي التلقائي (JSON/CSV/Excel/MDB).",
      "استيراد البيانات من نسخ JSON.",
    ],
  },
  {
    version: "0.7.0",
    date: "2026",
    title: "الذكاء الاصطناعي والبحث المتقدم",
    changes: [
      "المساعد الذكي للملفات مع تحليل واستخراج النصوص (OCR).",
      "البحث الحكومي الذكي عبر Edge Function مع مصادر ملوّنة.",
      "كشف الملفات المتشابهة تلقائياً.",
      "تلخيص المستندات الكبيرة بتقسيمها إلى أجزاء.",
    ],
  },
  {
    version: "0.6.0",
    date: "2026",
    title: "الوحدات القانونية والإدارية",
    changes: [
      "وحدة محاضر الجلسات مع الإدخال اليدوي والمسح الضوئي.",
      "وحدة الاستدعاءات مع الأعضاء والمواقع.",
      "أرشيف المراسيم والتعليمات مع الفهرسة التلقائية.",
      "تقويم الجلسات ولوحة مؤشرات الأداء (KPI).",
    ],
  },
  {
    version: "0.5.0",
    date: "2026",
    title: "الخرائط والمعالجة المكانية",
    changes: [
      "الخريطة العمرانية بصيغة GeoJSON مع تلوين البلديات.",
      "التحميل الديناميكي للملفات الكبيرة وتحسين الأداء.",
      "مُحدِّد مواقع رخص التعمير على الخريطة.",
      "تحسين عرض Leaflet باستخدام Canvas.",
    ],
  },
  {
    version: "0.4.0",
    date: "2026",
    title: "دورة حياة الملف",
    changes: [
      "تسجيل الملفات مع حقول شرطية حسب نوع عقد التعمير.",
      "إعادة الدراسة: إضافة تواريخ ودراسات جديدة للملفات القائمة.",
      "قرارات اللجنة مع أسباب إلزامية للرفض والتحفظات.",
      "سجل زمني كامل للتغييرات على كل ملف.",
    ],
  },
  {
    version: "0.3.0",
    date: "2026",
    title: "الأرشيف ولوحة التحكم",
    changes: [
      "أرشيف الملفات مع بحث متقدم وتصفية.",
      "لوحة التحكم بإحصائيات مبسّطة.",
      "صفحة التحليلات التنفيذية.",
      "صفحة تراث وادي ميزاب (القصور السبعة).",
    ],
  },
  {
    version: "0.2.0",
    date: "2026",
    title: "قاعدة البيانات والاتصال",
    changes: [
      "ربط المنصة بخدمات Lovable Cloud (المصادقة، القاعدة، التخزين).",
      "دعم الوضع المحلي (Electron + PGlite) للعمل بدون إنترنت.",
      "إعداد البلديات المدعومة: غرداية، العطف، بنورة، الضاية، متليلي.",
    ],
  },
  {
    version: "0.1.0",
    date: "2026",
    title: "النموذج الأولي",
    changes: [
      "إنشاء البنية الأساسية للمشروع (React 18 + Vite + TypeScript).",
      "تصميم واجهة تسجيل الدخول وحماية المسارات.",
      "بناء القائمة الجانبية والتنقل الأساسي.",
    ],
  },
];

export default function Changelog() {
  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#D4AF37]/10 rounded-lg flex items-center justify-center">
          <History className="w-5 h-5 text-[#D4AF37]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">سجل التحديثات</h1>
          <p className="text-muted-foreground">
            جميع المراحل والتحديثات التي مرت بها المنصة منذ انطلاقها.
          </p>
        </div>
      </div>

      <div className="relative pr-6 space-y-6">
        <div className="absolute right-[11px] top-2 bottom-2 w-px bg-[#D4AF37]/30" aria-hidden />
        {entries.map((entry) => (
          <div key={entry.version} className="relative">
            <div className="absolute -right-[22px] top-4 w-3 h-3 rounded-full bg-[#D4AF37] ring-4 ring-background" />
            <Card className="border-t-4 border-t-[#D4AF37]/40 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-lg">{entry.title}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-[#D4AF37]/40 text-[#D4AF37]">
                      v{entry.version}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {entry.date}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {entry.changes.map((change, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm leading-relaxed">
                      <CheckCircle2 className="w-4 h-4 text-[#D4AF37] mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{change}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
