import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
    Search,
    Loader2,
    ExternalLink,
    FileText,
    Globe,
    AlertCircle,
    Download,
    Eye,
    Archive,
} from "lucide-react";
import {
    searchGovDomains,
    isSearchConfigured,
    isPdfUrl,
    type GovSearchResult,
} from "@/lib/gov-search";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export default function GovSearch() {
    const { toast } = useToast();
    const { user } = useAuth();
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<GovSearchResult[]>([]);
    const [totalResults, setTotalResults] = useState(0);
    const [searchTime, setSearchTime] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasSearched, setHasSearched] = useState(false);
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [retryAfter, setRetryAfter] = useState<number | null>(null);
    const [retryCountdown, setRetryCountdown] = useState(0);

    const configured = isSearchConfigured();

    useEffect(() => {
        if (!retryAfter) {
            setRetryCountdown(0);
            return;
        }

        const updateCountdown = () => {
            const seconds = Math.max(0, Math.ceil((retryAfter - Date.now()) / 1000));
            setRetryCountdown(seconds);
            if (seconds === 0) setRetryAfter(null);
        };

        updateCountdown();
        const timer = window.setInterval(updateCountdown, 1000);
        return () => window.clearInterval(timer);
    }, [retryAfter]);

    const handleSearch = useCallback(
        async (e?: React.FormEvent) => {
            e?.preventDefault();
            if (!query.trim() || loading) return;
            if (retryAfter && Date.now() < retryAfter) return;

            // HARD RESET: Clear all previous states before new search
            setLoading(true);
            setError(null);
            setResults([]);
            setTotalResults(0);
            setSearchTime(0);
            setHasSearched(true);

            console.log("[UI] Starting fresh search, all states reset");

            const response = await searchGovDomains(query);

            setResults(response.results);
            setTotalResults(response.totalResults);
            setSearchTime(response.searchTime);
            if (response.error) {
                setError(response.error);
                if (response.statusCode === 403) {
                    const until = Date.now() + 60_000;
                    setRetryAfter(until);
                    setRetryCountdown(60);
                }
                console.error("[UI] Search error:", response.error);
            }

            setLoading(false);
        },
        [query, loading, retryAfter]
    );

    const handleResultClick = useCallback(
        (result: GovSearchResult) => {
            if (isPdfUrl(result.link)) {
                setPdfPreviewUrl(result.link);
            } else {
                window.open(result.link, "_blank", "noopener,noreferrer");
            }
        },
        []
    );

    const handleSaveToArchive = useCallback(
        async (result: GovSearchResult, buttonId: string) => {
            if (savingId === buttonId) return; // Prevent double-click

            // RLS FIX: Ensure user is authenticated before insert
            if (!user?.id) {
                toast({
                    variant: "destructive",
                    title: "خطأ",
                    description: "يجب تسجيل الدخول أولاً",
                });
                return;
            }

            setSavingId(buttonId);

            try {
                // Extract date from snippet if available (look for date patterns)
                const dateMatch = result.snippet?.match(/\b(\d{4}[-/]\d{1,2}[-/]\d{1,2})\b/);
                const extractedDate = dateMatch ? dateMatch[1] : null;

                const { error } = await supabase.from("legal_documents").insert({
                    title_ar: result.title.replace(/<[^>]*>/g, ""),
                    document_type: "مرسوم",
                    file_url: result.link,
                    description: result.snippet?.replace(/<[^>]*>/g, "") || null,
                    document_date: extractedDate,
                    created_by: user.id,
                });

                if (error) {
                    console.error("[RLS] legal_documents insert error:", error);
                    toast({
                        variant: "destructive",
                        title: "خطأ في الحفظ",
                        description: "حدث خطأ أثناء حفظ المرسوم. يرجى المحاولة مرة أخرى.",
                    });
                } else {
                    toast({
                        title: "تم الحفظ بنجاح",
                        description: "تم حفظ المرسوم في قاعدة بيانات الديوان بنجاح",
                        className: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700",
                    });
                }
            } catch (err) {
                console.error("[RLS] legal_documents catch error:", err);
                toast({
                    variant: "destructive",
                    title: "خطأ في الاتصال",
                    description: "تعذر الاتصال بقاعدة البيانات. يرجى التحقق من الاتصال والمحاولة مرة أخرى.",
                });
            } finally {
                setSavingId(null);
            }
        },
        [savingId, toast, user]
    );

    return (
        <div className="space-y-4" dir="rtl">
            {/* ── Module Header ──────────────────────────────────── */}
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Globe className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold font-cairo">
                            محرك البحث الحكومي
                        </h1>
                        <p className="text-muted-foreground text-sm font-cairo">
                            البحث في النطاقات الحكومية الجزائرية الرسمية
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Search Bar ─────────────────────────────────────── */}
            <Card>
                <CardContent className="pt-6">
                    <form onSubmit={handleSearch} className="flex gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                            <Input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="ابحث عن قانون، مرسوم، تعليمة... مثال: رخصة البناء"
                                className="pr-11 font-cairo text-base h-12"
                                dir="rtl"
                                disabled={!configured || loading}
                            />
                        </div>
                        <Button
                            type="submit"
                            size="lg"
                            className="font-cairo h-12 px-8"
                            disabled={!configured || loading || !query.trim() || retryCountdown > 0}
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin ml-2" />
                            ) : (
                                <Search className="w-5 h-5 ml-2" />
                            )}
                            بحث
                        </Button>
                    </form>

                    {/* Domain Chips */}
                    <div className="flex flex-wrap gap-2 mt-4">
                        <DomainChip
                            label="وزارة السكن والعمران"
                            color="bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700"
                        />
                        <DomainChip
                            label="وزارة الثقافة"
                            color="bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700"
                        />
                        <DomainChip
                            label="وزارة الداخلية"
                            color="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700"
                        />
                        <DomainChip
                            label="الجريدة الرسمية"
                            color="bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* ── Config Warning ─────────────────────────────────── */}
            {!configured && (
                <Card className="border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20">
                    <CardContent className="pt-6">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <div className="font-cairo">
                                <h3 className="font-bold text-amber-800 dark:text-amber-300 mb-1">
                                    مفاتيح البحث غير مُعدّة
                                </h3>
                                <p className="text-sm text-amber-700 dark:text-amber-400 leading-relaxed">
                                    يرجى إضافة المتغيرات التالية في ملف{" "}
                                    <code className="font-mono bg-amber-200/50 dark:bg-amber-800/30 px-1.5 py-0.5 rounded text-xs">
                                        .env
                                    </code>
                                    :
                                </p>
                                <ul className="mt-2 space-y-1 text-sm text-amber-700 dark:text-amber-400 font-mono" dir="ltr">
                                    <li>VITE_GOOGLE_SEARCH_API_KEY=your_api_key</li>
                                    <li>VITE_GOOGLE_SEARCH_CX=your_search_engine_id</li>
                                </ul>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ── Results Area ───────────────────────────────────── */}
            {hasSearched && !loading && !error && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground font-cairo">
                    <span>
                        تم العثور على{" "}
                        <strong className="text-foreground">
                            {totalResults.toLocaleString("ar-DZ")}
                        </strong>{" "}
                        نتيجة
                    </span>
                    <span className="text-xs font-mono" dir="ltr">
                        ({searchTime}ms)
                    </span>
                </div>
            )}

            {/* Loading State - Clean Spinner */}
            {loading && (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                    <p className="font-cairo text-lg text-foreground font-semibold">
                        جارٍ البحث في النطاقات الحكومية...
                    </p>
                    <p className="font-cairo text-sm text-muted-foreground">
                        يرجى الانتظار
                    </p>
                </div>
            )}

            {/* Error State - Inline with results area */}
            {error && !loading && (
                <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
                    <AlertCircle className="w-12 h-12 text-amber-500" />
                    <div className="font-cairo max-w-md">
                        <p className="text-sm text-muted-foreground mb-4" dir="rtl">
                            {error}
                        </p>
                        <Button
                            variant="default"
                            size="sm"
                            className="font-cairo"
                            onClick={() => handleSearch()}
                            disabled={retryCountdown > 0}
                        >
                            <Search className="w-4 h-4 ml-2" />
                            {retryCountdown > 0 ? `إعادة المحاولة بعد ${retryCountdown} ثانية` : "إعادة المحاولة"}
                        </Button>
                    </div>
                </div>
            )}

            {/* Result Cards */}
            {!loading && results.length > 0 && (
                <ScrollArea className="max-h-[calc(100vh-380px)]">
                    <div className="space-y-3 pb-4">
                        {results.map((result, idx) => (
                            <ResultCard
                                key={`${result.link}-${idx}`}
                                result={result}
                                onViewClick={handleResultClick}
                                onSaveToArchive={handleSaveToArchive}
                                isSaving={savingId === `save-${result.link}`}
                            />
                        ))}
                    </div>
                </ScrollArea>
            )}

            {/* Empty State */}
            {!loading && hasSearched && results.length === 0 && !error && (
                <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                        <FileText className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <div className="font-cairo">
                        <h3 className="font-bold text-lg text-foreground mb-1">
                            لا توجد نتائج
                        </h3>
                        <p className="text-sm text-muted-foreground max-w-md">
                            لم يتم العثور على نتائج مطابقة. حاول استخدام كلمات مفتاحية مختلفة
                            أو أوسع نطاقاً.
                        </p>
                    </div>
                </div>
            )}

            {/* Initial State (before first search) */}
            {!hasSearched && configured && (
                <div className="flex flex-col items-center justify-center py-16 gap-6 text-center">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                        <Globe className="w-10 h-10 text-primary" />
                    </div>
                    <div className="font-cairo max-w-lg">
                        <h3 className="font-bold text-xl text-foreground mb-2">
                            محرك البحث في النطاقات الحكومية الجزائرية
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            ابحث في المواقع الرسمية للوزارات والجريدة الرسمية عن القوانين
                            والمراسيم والتعليمات المتعلقة بالتعمير والبناء.
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 w-full max-w-md">
                        <SuggestionChip label="رخصة البناء" onClick={() => { setQuery("رخصة البناء"); }} />
                        <SuggestionChip label="شهادة المطابقة" onClick={() => { setQuery("شهادة المطابقة"); }} />
                        <SuggestionChip label="التراث الثقافي" onClick={() => { setQuery("التراث الثقافي"); }} />
                        <SuggestionChip label="مخطط شغل الأراضي" onClick={() => { setQuery("مخطط شغل الأراضي"); }} />
                    </div>
                </div>
            )}

            {/* ── PDF Preview Dialog ─────────────────────────────── */}
            <Dialog
                open={!!pdfPreviewUrl}
                onOpenChange={(open) => {
                    if (!open) setPdfPreviewUrl(null);
                }}
            >
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0">
                    <DialogHeader className="p-4 border-b">
                        <DialogTitle className="font-cairo flex items-center gap-2">
                            <FileText className="w-5 h-5" />
                            معاينة المستند
                        </DialogTitle>
                    </DialogHeader>
                    <div className="p-4">
                        <div
                            className="border rounded-lg overflow-hidden"
                            style={{ height: "70vh" }}
                        >
                            {pdfPreviewUrl && (
                                <iframe
                                    src={pdfPreviewUrl}
                                    className="w-full h-full"
                                    title="PDF Preview"
                                />
                            )}
                        </div>
                        <div className="flex items-center justify-between mt-3">
                            <p className="text-xs text-muted-foreground font-cairo">
                                إذا لم يظهر المستند، استخدم زر التحميل المباشر
                            </p>
                            {pdfPreviewUrl && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="font-cairo"
                                    onClick={() =>
                                        window.open(
                                            pdfPreviewUrl,
                                            "_blank",
                                            "noopener,noreferrer"
                                        )
                                    }
                                >
                                    <ExternalLink className="w-4 h-4 ml-2" />
                                    فتح في نافذة جديدة
                                </Button>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ── Sub-components ───────────────────────────────────────────────────

function ResultCard({
    result,
    onViewClick,
    onSaveToArchive,
    isSaving,
}: {
    result: GovSearchResult;
    onViewClick: (r: GovSearchResult) => void;
    onSaveToArchive: (r: GovSearchResult, id: string) => void;
    isSaving: boolean;
}) {
    const isPdf = isPdfUrl(result.link);
    const saveButtonId = `save-${result.link}`;

    return (
        <Card className="hover:shadow-md transition-shadow duration-200 border-border/60">
            <CardContent className="pt-5 pb-4">
                <div className="flex flex-col gap-3">
                    {/* Top row: Badge + Title */}
                    <div className="flex items-start gap-3">
                        <Badge
                            variant="outline"
                            className={cn(
                                "shrink-0 font-cairo text-xs px-2.5 py-1 border",
                                result.sourceBadge.color,
                                result.sourceBadge.textColor,
                                result.sourceBadge.borderColor
                            )}
                        >
                            {result.sourceBadge.label}
                        </Badge>
                        {isPdf && (
                            <Badge
                                variant="secondary"
                                className="shrink-0 font-mono text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            >
                                PDF
                            </Badge>
                        )}
                    </div>

                    {/* Title */}
                    <h3
                        className="font-cairo font-bold text-base leading-7 text-foreground cursor-pointer hover:text-primary transition-colors"
                        onClick={() => onViewClick(result)}
                        dangerouslySetInnerHTML={{ __html: result.title }}
                    />

                    {/* Snippet */}
                    <p
                        className="font-cairo text-sm text-muted-foreground leading-relaxed line-clamp-3"
                        dangerouslySetInnerHTML={{ __html: result.snippet }}
                    />

                    {/* Bottom row: Domain + Actions */}
                    <div className="flex items-center justify-between pt-1 border-t border-border/40">
                        <span
                            className="text-xs text-muted-foreground font-mono"
                            dir="ltr"
                        >
                            {result.displayLink}
                        </span>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="font-cairo text-xs h-8"
                                onClick={() =>
                                    window.open(
                                        result.link,
                                        "_blank",
                                        "noopener,noreferrer"
                                    )
                                }
                            >
                                <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                                فتح
                            </Button>
                            <Button
                                variant="default"
                                size="sm"
                                className="font-cairo text-xs h-8"
                                onClick={() => onViewClick(result)}
                            >
                                {isPdf ? (
                                    <>
                                        <Download className="w-3.5 h-3.5 ml-1.5" />
                                        تحميل
                                    </>
                                ) : (
                                    <>
                                        <Eye className="w-3.5 h-3.5 ml-1.5" />
                                        عرض
                                    </>
                                )}
                            </Button>
                            <Button
                                variant="secondary"
                                size="sm"
                                className={cn(
                                    "font-cairo text-xs h-8",
                                    isSaving
                                        ? "bg-emerald-600 hover:bg-emerald-700"
                                        : "bg-emerald-600/90 hover:bg-emerald-700"
                                )}
                                onClick={() => onSaveToArchive(result, saveButtonId)}
                                disabled={isSaving}
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 ml-1.5 animate-spin" />
                                        جارٍ الحفظ...
                                    </>
                                ) : (
                                    <>
                                        <Archive className="w-3.5 h-3.5 ml-1.5" />
                                        حفظ في الأرشيف
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function DomainChip({ label, color }: { label: string; color: string }) {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-cairo border",
                color
            )}
        >
            <Globe className="w-3 h-3" />
            {label}
        </span>
    );
}

function SuggestionChip({
    label,
    onClick,
}: {
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-border/60 bg-muted/30 hover:bg-muted/60 transition-colors font-cairo text-sm text-foreground"
        >
            <Search className="w-3.5 h-3.5 text-muted-foreground" />
            {label}
        </button>
    );
}
