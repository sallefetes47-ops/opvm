import { useState, useEffect, useCallback } from "react";
import { Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/* ═══════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════ */

const STORAGE_KEY = "opvm_permit_statuses";

const STEPS = [
    { label: "قيد الإيداع", description: "تسجيل الملف" },
    { label: "قيد الدراسة الفنية", description: "الدراسة والتحليل" },
    { label: "موافقة مبدئية", description: "القرار الأولي" },
    { label: "مكتمل / مُسلم", description: "التسليم النهائي" },
] as const;

/* ═══════════════════════════════════════════
   STORAGE HELPERS
   ═══════════════════════════════════════════ */

function readStatuses(): Record<string, number> {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function writeStatus(fileId: string, stepIndex: number) {
    const all = readStatuses();
    all[fileId] = stepIndex;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

/* ═══════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════ */

interface PermitStatusStepperProps {
    fileId: string;
    canEdit?: boolean;
}

export default function PermitStatusStepper({ fileId, canEdit = false }: PermitStatusStepperProps) {
    const { toast } = useToast();
    const [currentStep, setCurrentStep] = useState(0);

    /* ── Load from localStorage ── */
    useEffect(() => {
        const statuses = readStatuses();
        const saved = statuses[fileId];
        setCurrentStep(typeof saved === "number" ? saved : 0);
    }, [fileId]);

    /* ── Advance to next step ── */
    const handleStepClick = useCallback(
        (index: number) => {
            if (!canEdit) return;
            // Only allow clicking the NEXT step (one step forward)
            if (index !== currentStep + 1) return;
            setCurrentStep(index);
            writeStatus(fileId, index);
            toast({
                title: "✅ تم تحديث الحالة",
                description: `تم الانتقال إلى: ${STEPS[index].label}`,
            });
        },
        [canEdit, currentStep, fileId, toast]
    );

    /* ── Reset to first step ── */
    const handleReset = useCallback(() => {
        if (!canEdit) return;
        setCurrentStep(0);
        writeStatus(fileId, 0);
        toast({ title: "🔄 تم إعادة التعيين", description: "تمت إعادة الحالة إلى «قيد الإيداع»" });
    }, [canEdit, fileId, toast]);

    return (
        <div className="space-y-3" dir="rtl">
            {/* ── Header ── */}
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <div className="w-1.5 h-4 rounded-full bg-blue-500" />
                    مسار حالة الملف
                </h4>
                {canEdit && currentStep > 0 && (
                    <button
                        onClick={handleReset}
                        className="text-[10px] text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded-md hover:bg-destructive/10"
                    >
                        إعادة تعيين ↺
                    </button>
                )}
            </div>

            {/* ── Stepper ── */}
            <div className="flex items-start w-full">
                {STEPS.map((step, index) => {
                    const isCompleted = index < currentStep;
                    const isCurrent = index === currentStep;
                    const isPending = index > currentStep;
                    const isClickable = canEdit && index === currentStep + 1;
                    const isLast = index === STEPS.length - 1;

                    return (
                        <div key={index} className="flex items-start flex-1 min-w-0">
                            {/* Step circle + label */}
                            <div className="flex flex-col items-center">
                                <button
                                    onClick={() => handleStepClick(index)}
                                    disabled={!isClickable}
                                    className={`
                    relative flex items-center justify-center w-9 h-9 rounded-full border-2 transition-all duration-300 shrink-0
                    ${isCompleted
                                            ? "bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-500/30"
                                            : isCurrent
                                                ? "bg-blue-50 dark:bg-blue-950 border-blue-500 text-blue-600 shadow-md shadow-blue-500/30"
                                                : isClickable
                                                    ? "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-400 hover:border-blue-400 hover:text-blue-500 hover:shadow-md cursor-pointer"
                                                    : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-600"
                                        }
                  `}
                                    title={isClickable ? `انقر للانتقال إلى: ${step.label}` : step.label}
                                >
                                    {isCompleted ? (
                                        <Check className="w-4 h-4" />
                                    ) : (
                                        <span className="text-xs font-bold">{index + 1}</span>
                                    )}

                                    {/* Pulsing ring for current step */}
                                    {isCurrent && (
                                        <span className="absolute inset-0 rounded-full border-2 border-blue-400 animate-ping opacity-40" />
                                    )}
                                </button>

                                {/* Label */}
                                <div className="mt-2 text-center max-w-[80px]">
                                    <p className={`text-[11px] font-bold leading-tight ${isCompleted ? "text-emerald-600 dark:text-emerald-400" :
                                            isCurrent ? "text-blue-600 dark:text-blue-400" :
                                                "text-slate-400 dark:text-slate-500"
                                        }`}>
                                        {step.label}
                                    </p>
                                    <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight">
                                        {step.description}
                                    </p>
                                </div>
                            </div>

                            {/* Connecting line */}
                            {!isLast && (
                                <div className="flex-1 flex items-center mt-[18px] px-1.5 min-w-[16px]">
                                    <div className={`h-[3px] w-full rounded-full transition-all duration-500 ${isCompleted ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"
                                        }`} />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ── Helper text for admins ── */}
            {canEdit && currentStep < STEPS.length - 1 && (
                <p className="text-[10px] text-muted-foreground text-center mt-1 flex items-center justify-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    انقر على الخطوة التالية لتحديث الحالة
                </p>
            )}

            {/* ── Completed badge ── */}
            {currentStep === STEPS.length - 1 && (
                <div className="flex items-center justify-center gap-2 py-2 px-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">الملف مكتمل ومُسلم</span>
                </div>
            )}
        </div>
    );
}
