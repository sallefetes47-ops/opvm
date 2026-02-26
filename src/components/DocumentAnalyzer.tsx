import React, { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
    Upload, FileText, Loader2, Sparkles, Trash2, AlertTriangle,
    Calendar, Hash, Building2, Gavel, FileSearch, Tag, User,
} from 'lucide-react';

/* ════════════════════════════════════════════════════════
   TYPES
   ════════════════════════════════════════════════════════ */

/** The 4 recognized official administrative document types */
type OfficialDocType =
    | 'محاضر الجلسات'     // Meeting Minutes
    | 'الاستدعاءات'        // Summons / Invitations
    | 'المراسيم'           // Decrees
    | 'التعليمات';         // Directives / Instructions

export interface AnalysisResult {
    classification: OfficialDocType | string;
    classificationConfidence: 'high' | 'medium' | 'low';
    date: string;
    referenceNumber: string;
    issuingAuthority: string;
    signatories: string[];
    mainSubject: string;
    keyDecisions: string[];
    rawText: string;
}

interface DocumentAnalyzerProps {
    onAnalysisComplete?: (data: AnalysisResult, file: File) => void;
}

/* ════════════════════════════════════════════════════════
   CLASSIFICATION CONFIG
   ════════════════════════════════════════════════════════ */

const DOC_TYPES: { type: OfficialDocType; label: string; labelFr: string; icon: string; color: string }[] = [
    { type: 'محاضر الجلسات', label: 'محاضر الجلسات', labelFr: 'Meeting Minutes', icon: '📋', color: '#2563eb' },
    { type: 'الاستدعاءات', label: 'الاستدعاءات', labelFr: 'Summons / Invitations', icon: '📨', color: '#16a34a' },
    { type: 'المراسيم', label: 'المراسيم', labelFr: 'Decrees', icon: '📜', color: '#dc2626' },
    { type: 'التعليمات', label: 'التعليمات', labelFr: 'Directives / Instructions', icon: '📌', color: '#9333ea' },
];

const CONFIDENCE_STYLES = {
    high: { label: 'ثقة عالية', bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300' },
    medium: { label: 'ثقة متوسطة', bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300' },
    low: { label: 'ثقة منخفضة', bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300' },
};

/* ════════════════════════════════════════════════════════
   REGEX-BASED LOCAL ANALYSIS ENGINE
   ════════════════════════════════════════════════════════ */

function classifyDocument(text: string): { type: OfficialDocType | string; confidence: 'high' | 'medium' | 'low' } {
    const lower = text;
    // Meeting Minutes
    if (/محضر\s*(جلسة|اجتماع|اللجنة|لجنة)/.test(lower)) return { type: 'محاضر الجلسات', confidence: 'high' };
    if (/جلسة\s*(يوم|بتاريخ|المنعقدة)/.test(lower)) return { type: 'محاضر الجلسات', confidence: 'medium' };
    // Summons
    if (/استدعاء|دعوة\s*(لحضور|للحضور|إلى\s*اجتماع)/.test(lower)) return { type: 'الاستدعاءات', confidence: 'high' };
    if (/يدعو|ندعو|مدعو/.test(lower)) return { type: 'الاستدعاءات', confidence: 'medium' };
    // Decrees
    if (/مرسوم\s*(تنفيذي|رئاسي)?/.test(lower)) return { type: 'المراسيم', confidence: 'high' };
    if (/قرار\s*(وزاري)?/.test(lower)) return { type: 'المراسيم', confidence: 'medium' };
    // Directives
    if (/تعليمة|منشور|توجيه/.test(lower)) return { type: 'التعليمات', confidence: 'high' };
    if (/تنبيه|إرشادات/.test(lower)) return { type: 'التعليمات', confidence: 'medium' };
    return { type: 'غير محدد', confidence: 'low' };
}

function extractMetadata(text: string): Omit<AnalysisResult, 'classification' | 'classificationConfidence' | 'rawText'> {
    // Reference number
    let referenceNumber = '';
    const refPatterns = [
        /(?:مرسوم|قرار|تعليمة|أمر|قانون|منشور)\s*(?:تنفيذي\s*)?(?:رقم|رقم:)\s*([\d\-\/\.]+)/,
        /رقم\s*:?\s*([\d\-\/\.]+)/,
        /n[°o]\s*([\d\-\/\.]+)/i,
        /المرجع\s*:?\s*(.{3,40}?)(?:\n|$)/,
    ];
    for (const p of refPatterns) {
        const m = text.match(p);
        if (m) { referenceNumber = m[1].trim(); break; }
    }

    // Date
    let date = '';
    const monthMap: Record<string, string> = {
        'جانفي': '01', 'يناير': '01', 'فيفري': '02', 'فبراير': '02',
        'مارس': '03', 'أفريل': '04', 'أبريل': '04', 'ماي': '05', 'مايو': '05',
        'جوان': '06', 'يونيو': '06', 'جويلية': '07', 'يوليو': '07',
        'أوت': '08', 'أغسطس': '08', 'سبتمبر': '09', 'أكتوبر': '10',
        'نوفمبر': '11', 'ديسمبر': '12',
    };
    const dateP1 = text.match(/(?:المؤرخ في|بتاريخ|الموافق(?:\s*لـ?)?)\s*(\d{1,2})\s*(جانفي|فيفري|فبراير|يناير|مارس|أفريل|أبريل|ماي|مايو|جوان|يونيو|جويلية|يوليو|أوت|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)\s*(?:سنة\s*)?(\d{4})/);
    if (dateP1) {
        const day = dateP1[1].padStart(2, '0');
        const monthAr = dateP1[2];
        const year = dateP1[3];
        const monthNum = monthMap[monthAr] || '01';
        date = `${year}-${monthNum}-${day}`;
    } else {
        const dateP2 = text.match(/(?:المؤرخ في|بتاريخ|الموافق)\s*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
        if (dateP2) {
            date = `${dateP2[3]}-${dateP2[2].padStart(2, '0')}-${dateP2[1].padStart(2, '0')}`;
        }
    }

    // Issuing authority
    let issuingAuthority = '';
    const authPatterns = [
        /(?:الجمهورية الجزائرية|وزارة|ولاية|بلدية|مديرية|ديوان)\s*(.{5,80}?)(?:\n|$)/,
        /(?:عن\s*(?:الوزير|الوالي|رئيس)|الممضي|الإمضاء)\s*:?\s*(.{5,60}?)(?:\n|$)/,
    ];
    for (const p of authPatterns) {
        const m = text.match(p);
        if (m) { issuingAuthority = m[0].trim(); break; }
    }

    // Signatories
    const signatories: string[] = [];
    const sigP = text.match(/(?:الممضي|الإمضاء|الموقعون|وقع)\s*:?\s*(.{5,100}?)(?:\n|$)/g);
    if (sigP) {
        sigP.forEach(s => {
            const cleaned = s.replace(/(?:الممضي|الإمضاء|الموقعون|وقع)\s*:?\s*/, '').trim();
            if (cleaned) signatories.push(cleaned);
        });
    }

    // Main subject
    let mainSubject = '';
    const subjectPatterns = [
        /(?:المتضمن|يتضمن|المتعلق\s*بـ?)\s*(.{10,200}?)(?:\.|،|$)/,
        /(?:الموضوع|موضوع)\s*:?\s*(.{10,200}?)(?:\.|،|\n|$)/,
    ];
    for (const p of subjectPatterns) {
        const m = text.match(p);
        if (m) { mainSubject = m[1].trim(); break; }
    }

    // Key decisions
    const keyDecisions: string[] = [];
    const decisionPatterns = [
        /(?:المادة|البند)\s*(?:الأولى|الثانية|الثالثة|\d+)\s*:?\s*(.{10,200}?)(?:\.|$)/g,
        /(?:يقرر|تقرر|قرر)\s*:?\s*(.{10,200}?)(?:\.|$)/g,
    ];
    for (const p of decisionPatterns) {
        let m;
        while ((m = p.exec(text)) !== null && keyDecisions.length < 5) {
            keyDecisions.push(m[1].trim());
        }
    }

    return { date, referenceNumber, issuingAuthority, signatories, mainSubject, keyDecisions };
}

/* ════════════════════════════════════════════════════════
   COMPONENT
   ════════════════════════════════════════════════════════ */

export default function DocumentAnalyzer({ onAnalysisComplete }: DocumentAnalyzerProps) {
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Core state
    const [file, setFile] = useState<File | null>(null);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

    // Processing state
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState('');

    // Drag state
    const [isDragging, setIsDragging] = useState(false);

    /* ── File selection handler ── */
    const processFile = useCallback(async (selectedFile: File) => {
        const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
        if (!validTypes.includes(selectedFile.type)) {
            toast({ title: 'نوع ملف غير مدعوم', description: 'يرجى اختيار ملف PDF أو صورة (PNG, JPG, WEBP)', variant: 'destructive' });
            return;
        }
        if (selectedFile.size > 20 * 1024 * 1024) {
            toast({ title: 'حجم الملف كبير جداً', description: 'الحد الأقصى 20 ميجابايت', variant: 'destructive' });
            return;
        }

        // Set file and create preview URL
        setFile(selectedFile);
        const url = URL.createObjectURL(selectedFile);
        setPdfUrl(url);

        // Start AI analysis
        setIsProcessing(true);
        setProgress(10);
        setStatusText('جاري تحميل الملف...');

        try {
            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('documentType', 'legal_document');

            setProgress(30);
            const isPdf = selectedFile.type === 'application/pdf';
            const sizeMB = selectedFile.size / (1024 * 1024);
            setStatusText(isPdf && sizeMB > 2
                ? `جاري معالجة ملف PDF (${sizeMB.toFixed(1)} م.ب)... قد يستغرق وقتاً`
                : 'جاري استخراج البيانات بالذكاء الاصطناعي...');

            // Gradual progress simulation
            const progressInterval = setInterval(() => {
                setProgress(prev => prev >= 85 ? prev : prev + (isPdf && sizeMB > 2 ? 2 : 5));
            }, 1000);

            const { data, error } = await supabase.functions.invoke('extract-document', { body: formData });

            clearInterval(progressInterval);
            setProgress(95);
            setStatusText('جاري تحليل النتائج...');

            if (error) throw error;

            const rawText = data?.raw_response || data?.data?.content_text || data?.data?.raw_text || '';
            const aiData = data?.data || {};

            // Classification
            const { type, confidence } = classifyDocument(rawText || JSON.stringify(aiData));

            // Metadata extraction (AI first, regex fallback)
            const regexMeta = extractMetadata(rawText);

            const result: AnalysisResult = {
                classification: aiData.document_type || type,
                classificationConfidence: confidence,
                date: aiData.document_date || regexMeta.date || '',
                referenceNumber: aiData.document_number || regexMeta.referenceNumber || '',
                issuingAuthority: aiData.issuing_authority || regexMeta.issuingAuthority || '',
                signatories: aiData.signatories || regexMeta.signatories || [],
                mainSubject: aiData.title_ar || aiData.description || regexMeta.mainSubject || '',
                keyDecisions: aiData.key_decisions || regexMeta.keyDecisions || [],
                rawText,
            };

            setAnalysis(result);
            setProgress(100);
            setStatusText('تم التحليل بنجاح!');

            if (onAnalysisComplete) {
                onAnalysisComplete(result, selectedFile);
            }

            toast({ title: 'تم التحليل', description: 'تم استخراج البيانات وتصنيف الوثيقة بنجاح' });
        } catch (error: any) {
            console.error('Analysis Error:', error);

            // Even if AI fails, try local regex analysis on filename
            const fallback: AnalysisResult = {
                classification: 'غير محدد',
                classificationConfidence: 'low',
                date: '',
                referenceNumber: '',
                issuingAuthority: '',
                signatories: [],
                mainSubject: `فشل التحليل التلقائي: ${error.message || 'خطأ غير معروف'}`,
                keyDecisions: [],
                rawText: '',
            };
            setAnalysis(fallback);
            setProgress(0);
            setStatusText('');
        }

        setIsProcessing(false);
    }, [toast, onAnalysisComplete]);

    /* ── DELETE / RESET ── */
    const handleDelete = () => {
        if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        setFile(null);
        setPdfUrl(null);
        setAnalysis(null);
        setProgress(0);
        setStatusText('');
        setIsProcessing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    /* ── Drag & Drop handlers ── */
    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = () => setIsDragging(false);
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const dropped = e.dataTransfer.files[0];
        if (dropped) processFile(dropped);
    };
    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f) processFile(f);
    };

    const fileSizeMB = file ? (file.size / (1024 * 1024)).toFixed(1) : '0';
    const isPdf = file?.type === 'application/pdf';

    /* ════════════════════ RENDER ════════════════════ */

    // STATE 1: No file uploaded → show upload zone
    if (!file) {
        return (
            <div className="container mx-auto py-8 space-y-6">
                <Card className="max-w-2xl mx-auto shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-primary" />
                            تحميل وثيقة للتحليل
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer ${isDragging
                                ? 'border-primary bg-primary/5 scale-[1.01]'
                                : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'
                                }`}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Upload className={`w-14 h-14 mx-auto mb-4 transition-colors ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
                            <p className="text-lg font-medium mb-2">
                                {isDragging ? 'أفلت الملف هنا' : 'اسحب وأفلت الملف هنا'}
                            </p>
                            <p className="text-sm text-muted-foreground mb-4">
                                أو انقر لاختيار ملف PDF أو صورة (حتى 20 م.ب)
                            </p>

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".pdf,image/png,image/jpeg,image/webp"
                                onChange={handleFileInput}
                                className="hidden"
                            />

                            <div className="flex flex-wrap gap-2 justify-center">
                                {DOC_TYPES.map((dt) => (
                                    <span key={dt.type} className="px-2 py-1 bg-muted rounded-full text-[10px] text-muted-foreground">
                                        {dt.icon} {dt.label}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // STATE 2: File uploaded → split-screen with PDF viewer + analysis
    return (
        <div className="h-full flex flex-col space-y-4">
            {/* ─── HEADER BAR ─── */}
            <div className="flex items-center justify-between flex-wrap gap-3 p-1">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <FileSearch className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">تحليل الوثائق</h1>
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <FileText className="w-3.5 h-3.5" />
                            <span className="truncate max-w-[200px]">{file.name}</span>
                        </p>
                    </div>
                </div>

                {/* ── DELETE FILE BUTTON ── */}
                <Button
                    variant="destructive"
                    onClick={handleDelete}
                    className="gap-2 shadow-sm"
                    size="sm"
                >
                    <Trash2 className="w-4 h-4" />
                    حذف / إلغاء
                </Button>
            </div>

            {/* ─── PROGRESS BAR (visible during processing) ─── */}
            {isProcessing && (
                <Card className="border-primary/20">
                    <CardContent className="p-4 space-y-2">
                        <Progress value={progress} className="h-2" />
                        <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-2">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            {statusText}
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* ═══════════════════════════════════════════
                SPLIT-SCREEN: PDF Viewer  |  Analysis Summary
               ═══════════════════════════════════════════ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0">

                {/* ── SECTION A: Live PDF/Image Viewer ── */}
                <Card className="overflow-hidden flex flex-col h-full border-muted/60 shadow-sm">
                    <CardHeader className="py-2 px-4 bg-muted/30 border-b shrink-0">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <FileText className="w-4 h-4 text-blue-600" />
                            معاينة الوثيقة الأصلية
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 flex-1 h-[500px] md:h-auto overflow-hidden bg-zinc-100 dark:bg-zinc-900">
                        {isPdf ? (
                            <iframe
                                src={pdfUrl!}
                                title="PDF Preview"
                                className="w-full h-full border-0"
                            />
                        ) : (
                            <div className="w-full h-full overflow-auto p-4 flex items-center justify-center">
                                <img
                                    src={pdfUrl!}
                                    alt={file.name}
                                    className="max-w-full max-h-full object-contain shadow-lg"
                                />
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* ── SECTION B: Analysis Summary ── */}
                <Card className="overflow-hidden flex flex-col h-full border-muted/60 shadow-sm">
                    <CardHeader className="py-2 px-4 bg-muted/30 border-b shrink-0">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-amber-600" />
                            نتائج التحليل
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 flex-1 h-[500px] md:h-auto overflow-y-auto bg-card">
                        {isProcessing && !analysis ? (
                            <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                <p className="text-muted-foreground text-sm">جاري تحليل البيانات...</p>
                            </div>
                        ) : analysis ? (
                            <div className="p-4 space-y-4" dir="rtl">

                                {/* 1. Document Classification */}
                                <MetadataCard
                                    icon={<Tag className="w-4 h-4" />}
                                    title="تصنيف الوثيقة"
                                    titleFr="Document Classification"
                                >
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <ClassificationBadge type={analysis.classification} />
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${CONFIDENCE_STYLES[analysis.classificationConfidence]?.bg || ''
                                            } ${CONFIDENCE_STYLES[analysis.classificationConfidence]?.text || ''}`}>
                                            {CONFIDENCE_STYLES[analysis.classificationConfidence]?.label || analysis.classificationConfidence}
                                        </span>
                                    </div>
                                </MetadataCard>

                                {/* 2. Date & Reference Number */}
                                <MetadataCard
                                    icon={<Calendar className="w-4 h-4" />}
                                    title="التاريخ والمرجع"
                                    titleFr="Date & Reference Number"
                                >
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <p className="text-[10px] text-muted-foreground mb-0.5">التاريخ</p>
                                            <p className="font-medium text-sm">{analysis.date || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-muted-foreground mb-0.5">الرقم المرجعي</p>
                                            <p className="font-mono font-medium text-sm">{analysis.referenceNumber || '—'}</p>
                                        </div>
                                    </div>
                                </MetadataCard>

                                {/* 3. Issuing Authority / Signatories */}
                                <MetadataCard
                                    icon={<Building2 className="w-4 h-4" />}
                                    title="الجهة المصدرة / الموقعون"
                                    titleFr="Issuing Authority / Signatories"
                                >
                                    <div className="space-y-2">
                                        <div>
                                            <p className="text-[10px] text-muted-foreground mb-0.5">الجهة المصدرة</p>
                                            <p className="font-medium text-sm">{analysis.issuingAuthority || '—'}</p>
                                        </div>
                                        {analysis.signatories.length > 0 && (
                                            <div>
                                                <p className="text-[10px] text-muted-foreground mb-1">الموقعون</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {analysis.signatories.map((s, i) => (
                                                        <span key={i} className="flex items-center gap-1 px-2 py-0.5 bg-muted rounded-full text-xs">
                                                            <User className="w-3 h-3" />
                                                            {s}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </MetadataCard>

                                {/* 4. Key Decisions / Main Subject */}
                                <MetadataCard
                                    icon={<Gavel className="w-4 h-4" />}
                                    title="القرارات الرئيسية / الموضوع"
                                    titleFr="Key Decisions / Main Subject"
                                >
                                    <div className="space-y-2">
                                        {analysis.mainSubject && (
                                            <div>
                                                <p className="text-[10px] text-muted-foreground mb-0.5">الموضوع الرئيسي</p>
                                                <p className="font-medium text-sm leading-relaxed">{analysis.mainSubject}</p>
                                            </div>
                                        )}
                                        {analysis.keyDecisions.length > 0 && (
                                            <div>
                                                <p className="text-[10px] text-muted-foreground mb-1">القرارات</p>
                                                <ul className="space-y-1.5">
                                                    {analysis.keyDecisions.map((d, i) => (
                                                        <li key={i} className="flex items-start gap-2 text-sm">
                                                            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                                                                {i + 1}
                                                            </span>
                                                            <span className="leading-relaxed">{d}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        {!analysis.mainSubject && analysis.keyDecisions.length === 0 && (
                                            <p className="text-sm text-muted-foreground italic">لم يتم استخراج قرارات أو موضوع</p>
                                        )}
                                    </div>
                                </MetadataCard>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-muted-foreground">
                                <AlertTriangle className="w-8 h-8" />
                                <p>لا توجد نتائج تحليل</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

/* ══════════════════ SUB-COMPONENTS ══════════════════ */

function MetadataCard({
    icon, title, titleFr, children,
}: {
    icon: React.ReactNode;
    title: string;
    titleFr: string;
    children: React.ReactNode;
}) {
    return (
        <div className="border rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b">
                <span className="text-primary">{icon}</span>
                <div>
                    <p className="text-xs font-semibold">{title}</p>
                    <p className="text-[9px] text-muted-foreground">{titleFr}</p>
                </div>
            </div>
            <div className="p-3">{children}</div>
        </div>
    );
}

function ClassificationBadge({ type }: { type: string }) {
    const found = DOC_TYPES.find(dt => dt.type === type || type.includes(dt.label));
    if (found) {
        return (
            <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold text-white shadow"
                style={{ backgroundColor: found.color }}
            >
                {found.icon} {found.label}
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200">
            📄 {type || 'غير محدد'}
        </span>
    );
}
