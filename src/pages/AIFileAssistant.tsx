import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles, Search, Bot, Loader2, FileText, AlertCircle,
  CheckCircle2, XCircle, Lightbulb,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface FileRecord {
  id: string;
  file_number: string;
  full_name: string;
  municipality: string;
  address: string;
  permit_type: string | null;
  ownership_type: string;
  plot_area: number | null;
  built_area: number | null;
  floors_count: number | null;
  property_group: string | null;
  subdivision_name: string | null;
  lot_number: string | null;
  property_reference: string | null;
  engineer_name: string | null;
  work_duration: string | null;
  demolition_reason: string | null;
  committee_opinion: string | null;
  session_date: string | null;
  created_at: string;
}

const AIFileAssistant = () => {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [municipalityFilter, setMunicipalityFilter] = useState<string>("all");
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string>("");
  const [analyzing, setAnalyzing] = useState(false);

  // Load files
  const { data: files = [], isLoading } = useQuery({
    queryKey: ["ai-assistant-files", municipalityFilter],
    queryFn: async () => {
      let q = supabase
        .from("files")
        .select("*")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(200);
      if (municipalityFilter !== "all") {
        q = q.eq("municipality", municipalityFilter as any);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data as FileRecord[]) || [];
    },
  });

  const filteredFiles = files.filter((f) => {
    const s = search.trim().toLowerCase();
    if (!s) return true;
    return (
      f.file_number?.toLowerCase().includes(s) ||
      f.full_name?.toLowerCase().includes(s) ||
      f.address?.toLowerCase().includes(s)
    );
  });

  const selectedFile = files.find((f) => f.id === selectedFileId) || null;

  const handleAnalyze = async () => {
    if (!selectedFile) return;
    setAnalyzing(true);
    setAnalysis("");

    try {
      // Fetch studies
      const { data: studies } = await supabase
        .from("file_studies")
        .select("study_date, committee_opinion, rejection_reason, notes")
        .eq("file_id", selectedFile.id)
        .order("study_date", { ascending: true });

      const { data, error } = await supabase.functions.invoke("ai-file-assistant", {
        body: {
          fileData: {
            ...selectedFile,
            studies: studies || [],
          },
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setAnalysis(data.analysis || "");
      toast({ title: "تم التحليل بنجاح", description: "اطّلع على نتائج المساعد الذكي" });
    } catch (e: any) {
      toast({
        title: "فشل التحليل",
        description: e.message || "حدث خطأ غير متوقع",
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">المساعد الذكي للملفات</h1>
          <p className="text-sm text-muted-foreground">
            تحليل تلقائي للملفات واقتراح القرار باستخدام الذكاء الاصطناعي
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Files list */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              اختر ملفًا للتحليل
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث برقم الملف أو الاسم..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-9"
              />
            </div>
            <Select value={municipalityFilter} onValueChange={setMunicipalityFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع البلديات</SelectItem>
                <SelectItem value="Ghardaia">غرداية</SelectItem>
                <SelectItem value="El Attef">العطف</SelectItem>
                <SelectItem value="Bounoura">بنورة</SelectItem>
                <SelectItem value="Metlili">المنيعة</SelectItem>
                <SelectItem value="Daya Ben Dahoua">ضاية بن ضحوة</SelectItem>
              </SelectContent>
            </Select>

            <div className="max-h-[500px] overflow-y-auto space-y-2 mt-3">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))
              ) : filteredFiles.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  لا توجد ملفات
                </p>
              ) : (
                filteredFiles.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setSelectedFileId(f.id)}
                    className={`w-full text-right p-3 rounded-lg border transition-all ${
                      selectedFileId === f.id
                        ? "bg-primary/10 border-primary"
                        : "bg-card hover:bg-accent border-border"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{f.file_number}</p>
                        <p className="text-xs text-muted-foreground truncate">{f.full_name}</p>
                      </div>
                      {f.committee_opinion && (
                        <Badge
                          variant="outline"
                          className={
                            f.committee_opinion === "accepted"
                              ? "border-green-500 text-green-600"
                              : f.committee_opinion === "rejected"
                              ? "border-red-500 text-red-600"
                              : "border-amber-500 text-amber-600"
                          }
                        >
                          {f.committee_opinion === "accepted"
                            ? "مقبول"
                            : f.committee_opinion === "rejected"
                            ? "مرفوض"
                            : "تحفظ"}
                        </Badge>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Analysis area */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bot className="h-4 w-4" />
                نتيجة التحليل
              </CardTitle>
              <Button
                onClick={handleAnalyze}
                disabled={!selectedFile || analyzing}
                className="gap-2"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    جاري التحليل...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    حلّل الملف
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!selectedFile ? (
              <div className="text-center py-16 space-y-3">
                <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <p className="text-muted-foreground">
                  اختر ملفًا من القائمة لبدء التحليل الذكي
                </p>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  سيقوم المساعد بتحليل بيانات الملف، مراجعة الدراسات السابقة،
                  واقتراح القرار المناسب وفق المرسوم 15-19
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Selected file summary */}
                <div className="bg-muted/30 rounded-lg p-4 border border-border">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">رقم الملف: </span>
                      <span className="font-semibold">{selectedFile.file_number}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">الصاحب: </span>
                      <span className="font-semibold">{selectedFile.full_name}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">البلدية: </span>
                      <span>{selectedFile.municipality}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">نوع الرخصة: </span>
                      <span>{selectedFile.permit_type || "—"}</span>
                    </div>
                  </div>
                </div>

                {/* Analysis output */}
                {analyzing && !analysis ? (
                  <div className="space-y-3 py-6">
                    <div className="flex items-center gap-2 text-primary">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">المساعد يحلل الملف الآن...</span>
                    </div>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-4/6" />
                  </div>
                ) : analysis ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none rtl:text-right bg-card border border-border rounded-lg p-5">
                    <ReactMarkdown
                      components={{
                        h1: ({ children }) => (
                          <h1 className="text-xl font-bold text-primary mt-4 mb-2">
                            {children}
                          </h1>
                        ),
                        h2: ({ children }) => (
                          <h2 className="text-lg font-bold text-primary mt-4 mb-2 flex items-center gap-2">
                            {children}
                          </h2>
                        ),
                        h3: ({ children }) => (
                          <h3 className="text-base font-semibold mt-3 mb-1">{children}</h3>
                        ),
                        ul: ({ children }) => (
                          <ul className="list-disc pr-5 space-y-1 my-2">{children}</ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="list-decimal pr-5 space-y-1 my-2">{children}</ol>
                        ),
                        strong: ({ children }) => (
                          <strong className="text-foreground font-bold">{children}</strong>
                        ),
                        p: ({ children }) => (
                          <p className="leading-relaxed my-2">{children}</p>
                        ),
                      }}
                    >
                      {analysis}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="text-center py-10 space-y-2">
                    <AlertCircle className="h-10 w-10 mx-auto text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">
                      اضغط على زر "حلّل الملف" لبدء التحليل
                    </p>
                  </div>
                )}

                {/* Disclaimer */}
                {analysis && (
                  <div className="text-xs text-muted-foreground bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 flex gap-2">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 text-amber-500 mt-0.5" />
                    <p>
                      <strong>تنبيه:</strong> هذا التحليل استرشادي فقط ولا يُغني عن
                      دراسة اللجنة المختصة. القرار النهائي يبقى من صلاحيات اللجنة وفق
                      المرسوم التنفيذي 15-19.
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AIFileAssistant;
