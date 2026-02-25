import { useState } from "react";
import { useAdmin } from "@/contexts/AdminContext";
import { X, Shield, Search, Grid, Ruler, FileText } from "lucide-react";

interface ToggleSwitchProps {
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    checked: boolean;
    onChange: (checked: boolean) => void;
    iconColor: string;
}

function ToggleSwitch({ label, description, icon: Icon, checked, onChange, iconColor }: ToggleSwitchProps) {
    return (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/[0.07]">
            <div className="flex items-center gap-3">
                <div className={`rounded-lg p-2 ${iconColor}`}>
                    <Icon className="h-4 w-4" />
                </div>
                <div className="text-right">
                    <p className="text-sm font-semibold text-white">{label}</p>
                    <p className="text-xs text-white/40">{description}</p>
                </div>
            </div>
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                onClick={() => onChange(!checked)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${checked ? "bg-[#D4AF37]" : "bg-white/20"
                    }`}
            >
                <span
                    className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transition-transform duration-200 ${checked ? "-translate-x-5" : "translate-x-0"
                        }`}
                />
            </button>
        </div>
    );
}

interface ViewerSettingsPanelProps {
    open: boolean;
    onClose: () => void;
}

export function ViewerSettingsPanel({ open, onClose }: ViewerSettingsPanelProps) {
    const { viewerPermissions, updatePermission, logoutAdmin } = useAdmin();

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="relative w-full max-w-md mx-4 rounded-2xl border border-white/15 bg-gradient-to-b from-[#1a1a2e] to-[#16213e] shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
                    <button
                        onClick={onClose}
                        className="rounded-full p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
                    >
                        <X className="h-4 w-4" />
                    </button>
                    <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-white">الإعدادات</h2>
                        <Shield className="h-5 w-5 text-[#D4AF37]" />
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 space-y-3">
                    <div className="mb-4 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 p-3">
                        <p className="text-center text-sm font-semibold text-[#D4AF37]">
                            صلاحيات المشاهد
                        </p>
                        <p className="text-center text-xs text-white/40 mt-1">
                            تحكم في ما يراه المشاهد العام
                        </p>
                    </div>

                    <ToggleSwitch
                        label="السماح بالبحث"
                        description="إظهار/إخفاء شريط البحث للمشاهد"
                        icon={Search}
                        checked={viewerPermissions.allowSearch}
                        onChange={(v) => updatePermission("allowSearch", v)}
                        iconColor="bg-blue-500/20 text-blue-400"
                    />

                    <ToggleSwitch
                        label="معلومات المسح"
                        description="إظهار القسم ومجموعة الملكية"
                        icon={Grid}
                        checked={viewerPermissions.showCadastralInfo}
                        onChange={(v) => updatePermission("showCadastralInfo", v)}
                        iconColor="bg-purple-500/20 text-purple-400"
                    />

                    <ToggleSwitch
                        label="المساحة الحقيقية"
                        description="إظهار/إخفاء المساحة الحقيقية"
                        icon={Ruler}
                        checked={viewerPermissions.showRawArea}
                        onChange={(v) => updatePermission("showRawArea", v)}
                        iconColor="bg-emerald-500/20 text-emerald-400"
                    />

                    <ToggleSwitch
                        label="مساحة المسح"
                        description="إظهار/إخفاء مساحة المسح الرسمية"
                        icon={FileText}
                        checked={viewerPermissions.showOfficialArea}
                        onChange={(v) => updatePermission("showOfficialArea", v)}
                        iconColor="bg-teal-500/20 text-teal-400"
                    />
                </div>

                {/* Footer */}
                <div className="border-t border-white/10 px-6 py-4">
                    <button
                        onClick={() => {
                            logoutAdmin();
                            onClose();
                        }}
                        className="w-full rounded-xl border border-red-500/30 bg-red-500/10 py-2.5 text-sm font-semibold text-red-400 transition hover:bg-red-500/20"
                    >
                        خروج من وضع المسؤول
                    </button>
                </div>
            </div>
        </div>
    );
}
