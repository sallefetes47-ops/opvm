import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, Landmark, BookOpen, Globe, FolderSearch } from "lucide-react";

interface Ksar {
  nameAr: string;
  nameBerber: string;
  nameFr: string;
  founded: string;
  municipality: string;
  description: string;
}

const ksour: Ksar[] = [
  {
    nameAr: "غرداية",
    nameBerber: "تَغَرْدَايْت (Tagherdayt)",
    nameFr: "Ghardaïa",
    founded: "1048م / 440هـ",
    municipality: "غرداية",
    description: "عاصمة وادي مزاب وأكبر قصورها، يتوسطها جامع الشيخ بكير بن سليمان ذو المئذنة الهرمية الشهيرة. سوقها التاريخي المسقوف من أنشط أسواق المنطقة.",
  },
  {
    nameAr: "بني يزقن",
    nameBerber: "آت إِيزْجَنْ (At Izjen)",
    nameFr: "Beni Isguen",
    founded: "1347م / 748هـ",
    municipality: "بني يزقن",
    description: "القصر المقدّس، يحافظ على تقاليده الصارمة ويُغلق أبوابه ليلاً. يضم مكتبات عريقة وبرج بوليلة الذي كان يُستخدم للمراقبة.",
  },
  {
    nameAr: "مليكة",
    nameBerber: "آتْ مْلِيشَتْ (At Mlichet)",
    nameFr: "Melika",
    founded: "1350م تقريباً",
    municipality: "غرداية",
    description: "يقع على ربوة عالية مطلّة على وادي مزاب، يتميّز بضريح الشيخ سيدي عيسى ومقبرته التاريخية ذات النصب الفريدة.",
  },
  {
    nameAr: "بنورة",
    nameBerber: "آتْ بُونُورْ (At Bounour)",
    nameFr: "Bounoura",
    founded: "1046م / 437هـ",
    municipality: "بنورة",
    description: "من أقدم القصور، مبني على صخرة مرتفعة مع أزقة ضيقة متشعبة. يضم جامعاً عتيقاً ومنازل ذات طابع دفاعي واضح.",
  },
  {
    nameAr: "العطف",
    nameBerber: "تَجْنِينْتْ (Tajnint)",
    nameFr: "El Atteuf",
    founded: "1012م / 402هـ",
    municipality: "العطف",
    description: "أقدم قصور وادي مزاب وأولها تأسيساً. يضم مسجد سيدي إبراهيم الذي ألهم المعماري لو كوربوزييه في تصاميمه.",
  },
  {
    nameAr: "القرارة",
    nameBerber: "إِقْرَارَنْ (Iqraran)",
    nameFr: "Guerrara",
    founded: "1631م / 1041هـ",
    municipality: "القرارة",
    description: "قصر شمالي تأسس لاحقاً، اشتهر بنشاطه التجاري وواحاته الواسعة. مسقط رأس عدد من العلماء والمصلحين.",
  },
  {
    nameAr: "بريان",
    nameBerber: "أَتْ إِبَرْجَنْ (At Ibergan)",
    nameFr: "Berriane",
    founded: "1690م تقريباً",
    municipality: "بريان",
    description: "أحدث القصور السبعة، يقع شمال غرداية ويتميّز بنخيله الكثيف وسوقه التجاري النشط.",
  },
];

const references = [
  { label: "جمعية التراث - أتمزاب", url: "http://www.atmzab.net/", icon: Globe },
  { label: "اليونسكو - وادي مزاب (تراث عالمي 1982)", url: "https://whc.unesco.org/en/list/188/", icon: BookOpen },
  { label: "ديوان حماية وادي ميزاب وترقيته (OPVM)", url: "#", icon: Landmark },
];

export default function MzabHeritage() {
  const navigate = useNavigate();

  const openArchiveForKsar = (municipality: string) => {
    navigate(`/archive?municipality=${encodeURIComponent(municipality)}`);
  };

  return (
    <div dir="rtl" className="container mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Landmark className="h-8 w-8 text-[#D4AF37]" />
          تراث وادي مزاب
        </h1>
        <p className="text-muted-foreground">
          القصور السبعة (پنطابوليس مزاب) - موقع تراث عالمي مصنّف من قبل اليونسكو منذ 1982
        </p>
      </div>

      <Card className="border-[#D4AF37]/30">
        <CardHeader>
          <CardTitle className="text-xl">نبذة تاريخية</CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed text-muted-foreground space-y-2">
          <p>
            وادي مزاب منطقة صحراوية تقع جنوب الجزائر بمسافة 600 كلم تقريباً. أسّس بنو مزاب الإباضيون قصورهم
            بين القرنين 11 و 17 الميلاديين بنظام عمراني فريد يجمع بين الوظيفة الدفاعية والاجتماعية والدينية.
          </p>
          <p>
            صُنّفت قصور مزاب الخمسة الأصلية ضمن قائمة التراث العالمي لليونسكو سنة 1982 لما تمثّله من نموذج
            متكامل للعمارة الصحراوية المستدامة، وقد ألهمت كبار المعماريين العالميين مثل لو كوربوزييه وفرنان بويون.
          </p>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-2xl font-semibold mb-4">القصور السبعة</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {ksour.map((k) => (
            <Card
              key={k.nameAr}
              role="button"
              tabIndex={0}
              onClick={() => openArchiveForKsar(k.municipality)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openArchiveForKsar(k.municipality);
                }
              }}
              className="cursor-pointer hover:border-[#D4AF37] hover:shadow-lg transition-all group"
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{k.nameAr}</CardTitle>
                  <Badge variant="outline" className="text-xs">{k.founded}</Badge>
                </div>
                <CardDescription className="space-y-1">
                  <div className="text-xs">{k.nameBerber}</div>
                  <div className="text-xs italic">{k.nameFr}</div>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm leading-relaxed text-muted-foreground">{k.description}</p>
                <Separator />
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Landmark className="h-3 w-3" />
                    <span>بلدية: {k.municipality}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[#D4AF37] opacity-0 group-hover:opacity-100 transition-opacity">
                    <FolderSearch className="h-3 w-3" />
                    <span>عرض الملفات</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-[#D4AF37]" />
            روابط ومراجع
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {references.map((ref) => (
              <li key={ref.label}>
                <a
                  href={ref.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm hover:text-[#D4AF37] transition-colors"
                >
                  <ref.icon className="h-4 w-4" />
                  <span>{ref.label}</span>
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </a>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
