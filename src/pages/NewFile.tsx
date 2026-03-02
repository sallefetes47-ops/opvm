import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateInput } from "@/components/ui/date-input";
import { Loader2, FilePlus, FileUp } from "lucide-react";
import PermitLocationPicker from "@/components/PermitLocationPicker";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { clampPropertyGroupDigits, clampSectionDigits, formatPropertyGroup, formatSection } from "@/lib/cadastre";
import type { Database } from "@/integrations/supabase/types";

type Municipality = Database["public"]["Enums"]["municipality"];
type OwnershipType = "عقد ملكية" | "دفتر عقاري" | "شهادة استفادة";
type OwnershipTypeForNonBuilding = "عقد ملكية" | "دفتر عقاري";
type CommitteeOpinion = Database["public"]["Enums"]["committee_opinion"];
type PermitType = "رخصة بناء" | "رخصة تجزئة" | "رخصة هدم" | "شهادة تقسيم" | "";

interface FileFormData {
  full_name: string;
  municipality: Municipality | "";
  permit_type: PermitType;
  file_number: string;
  year: number;
  ownership_type: OwnershipType | OwnershipTypeForNonBuilding;
  address: string;
  section: string;
  property_group: string;
  plot_area: string;
  built_area: string;
  engineer_name: string;
  shares_count: string;
  plots_count: string;
  lot_number: string;
  subdivision_name: string;
  submission_date: Date | undefined;
  session_date: Date | undefined;
  committee_opinion: CommitteeOpinion | "";
  rejection_reason: string;
  electronic_permit_file: File | null;
  location_lat: number | null;
  location_lng: number | null;
}

export default function NewFile() {
  const currentYear = new Date().getFullYear();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const electronicPermitInputRef = useRef<HTMLInputElement | null>(null);

  const [formData, setFormData] = useState<FileFormData>({
    full_name: "",
    municipality: "",
    permit_type: "",
    file_number: "",
    year: currentYear,
    ownership_type: "عقد ملكية",
    address: "",
    section: "",
    property_group: "",
    plot_area: "",
    built_area: "",
    engineer_name: "",
    shares_count: "",
    plots_count: "",
    lot_number: "",
    subdivision_name: "",
    submission_date: undefined,
    session_date: undefined,
    committee_opinion: "",
    rejection_reason: "",
    electronic_permit_file: null,
    location_lat: null,
    location_lng: null,
  });

  // Fetch and Auto-fill Area based on GeoJSON
  useEffect(() => {
    const fetchAreaFromCadastre = async () => {
      if (formData.ownership_type !== "دفتر عقاري") return;

      const sectionStr = formData.section.trim();
      const ilotStr = formData.property_group.trim();
      const municipalityVal = formData.municipality;

      if (!sectionStr || !ilotStr || !municipalityVal) return;

      const targetSection = Number(sectionStr);
      const targetIlot = Number(ilotStr);

      if (isNaN(targetSection) || isNaN(targetIlot)) return;

      // Map municipality to COMMUNE code
      // NOTE: display labels must NOT include numeric codes.
      // Codes are used internally only for matching GeoJSON COMMUNE suffix.
      const COMMUNE_CODES: Record<string, string> = {
        "غرداية": "4701",
        "العطف": "4707",
        "بنورة": "4710",
        "الضاية": "4703",
        "متليلي": "4705",
      };

      const targetCommune = COMMUNE_CODES[municipalityVal];

      console.log(`[Area AutoFill] Searching for - Section: ${targetSection}, Ilot: ${targetIlot}, Commune Target: ${targetCommune}`);

      try {
        const res = await fetch(window.location.origin + "/mzab_cadastre_map.geojson");
        if (!res.ok) throw new Error("Could not fetch Mzab Map GeoJSON");
        const data = await res.json();

        if (data?.features?.length > 0) {
          console.log(`[Area AutoFill] DB Sample:`, data.features.slice(0, 3).map((f: any) => f.properties));
        }

        const matchedFeature = data?.features?.find((f: any) => {
          const p = f.properties;
          const fSection = Number(p.SECTION);
          const fIlot = Number(p.ILOT || p.group);
          const fCommune = String(p.COMMUNE || "");

          if (isNaN(fSection) || isNaN(fIlot)) return false;

          // Match section, ilot, and ensure the commune ends with our target code
          const matchesSectionAndIlot = fSection === targetSection && fIlot === targetIlot;
          const matchesCommune = targetCommune ? fCommune.endsWith(targetCommune) : true;

          if (matchesSectionAndIlot && matchesCommune) {
            console.log(`[Area AutoFill] Match found! ->`, p);
          }

          return matchesSectionAndIlot && matchesCommune;
        });

        if (matchedFeature && matchedFeature.properties.AREA) {
          const areaVal = matchedFeature.properties.AREA;
          const formattedArea = Number(areaVal).toFixed(2); // Keep 2 decimal places

          console.log(
            `✅ تم العثور على القطعة في (${municipalityVal} - قسم ${targetSection} - مجموعة ${targetIlot})، المساحة: ${formattedArea} م²`
          );

          setFormData(prev => ({
            ...prev,
            plot_area: formattedArea
          }));
        } else {
          console.warn(`[Area AutoFill] No matching cadastre parcel or missing AREA property for Section: ${targetSection}, Ilot: ${targetIlot}, Commune: ${targetCommune}`);
        }

      } catch (err) {
        console.warn("فشل في جلب المساحة تلقائياً:", err);
      }
    };

    fetchAreaFromCadastre();
  }, [formData.section, formData.property_group, formData.municipality, formData.ownership_type]);

  // Determine available ownership types based on permit type
  // "شهادة استفادة" is only available for "رخصة بناء"
  const getAvailableOwnershipTypes = () => {
    if (formData.permit_type === "رخصة بناء") {
      return ["عقد ملكية", "دفتر عقاري", "شهادة استفادة"] as const;
    }
    return ["عقد ملكية", "دفتر عقاري"] as const;
  };

  const handlePermitTypeChange = (value: PermitType) => {
    // If switching away from "رخصة بناء" and currently using "شهادة استفادة", reset to "عقد ملكية"
    if (value !== "رخصة بناء" && formData.ownership_type === "شهادة استفادة") {
      setFormData({
        ...formData,
        permit_type: value,
        ownership_type: "عقد ملكية",
        lot_number: "",
        subdivision_name: ""
      });
    } else {
      setFormData({ ...formData, permit_type: value });
    }
  };

  const handleElectronicPermitFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData({ ...formData, electronic_permit_file: file });
    }
  };

  const openElectronicPermitPicker = () => {
    electronicPermitInputRef.current?.click();
  };

  const createFileMutation = useMutation({
    mutationFn: async (data: FileFormData) => {
      // RLS FIX: Ensure user is authenticated before insert
      if (!user?.id) {
        throw new Error("يجب تسجيل الدخول أولاً");
      }

      const { data: insertData, error } = await supabase
        .from("files")
        .insert({
          full_name: data.full_name,
          municipality: data.municipality as Municipality,
          permit_type: data.permit_type || null,
          file_number: data.file_number,
          year: data.year,
          ownership_type: data.ownership_type as any,
          address: data.address,
          section: data.section || null,
          property_group: data.property_group || null,
          lot_number: data.ownership_type === "شهادة استفادة" ? data.lot_number : null,
          subdivision_name: data.ownership_type === "شهادة استفادة" ? data.subdivision_name : null,
          plot_area: data.permit_type === "رخصة بناء" || data.permit_type === "شهادة تقسيم" || data.permit_type === "رخصة تجزئة"
            ? (data.plot_area ? parseFloat(data.plot_area) : null)
            : null,
          built_area: data.permit_type === "رخصة بناء" && data.built_area ? parseFloat(data.built_area) : null,
          engineer_name: data.permit_type === "رخصة بناء" ? data.engineer_name : null,
          shares_count: data.permit_type === "شهادة تقسيم" && data.shares_count ? parseInt(data.shares_count) : null,
          plots_count: data.permit_type === "رخصة تجزئة" && data.plots_count ? parseInt(data.plots_count) : null,
          submission_date: data.submission_date ? format(data.submission_date, "yyyy-MM-dd") : null,
          session_date: data.session_date ? format(data.session_date, "yyyy-MM-dd") : null,
          committee_opinion: data.committee_opinion || null,
          rejection_reason: (data.committee_opinion === "تحفظ" || data.committee_opinion === "مرفوض") ? data.rejection_reason : null,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) {
        console.error("[RLS] Insert error:", error);
        console.error("[RLS] User context:", { userId: user.id, hasSession: !!user });
        throw error;
      }

      return insertData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-files"] });
      queryClient.invalidateQueries({ queryKey: ["archive-files"] });
      toast({
        title: "تم الحفظ بنجاح",
        description: "تم تسجيل الملف في قاعدة البيانات",
      });
      navigate("/archive");
    },
    onError: (error) => {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.full_name || !formData.municipality || !formData.file_number || !formData.address) {
      toast({
        title: "خطأ",
        description: "يرجى ملء جميع الحقول المطلوبة",
        variant: "destructive",
      });
      return;
    }

    if (formData.ownership_type === "دفتر عقاري" && (!formData.section || !formData.property_group)) {
      toast({
        title: "خطأ",
        description: "يرجى ملء حقلي القسم ومجموعة الملكية",
        variant: "destructive",
      });
      return;
    }

    if (formData.ownership_type === "شهادة استفادة" && (!formData.lot_number || !formData.subdivision_name)) {
      toast({
        title: "خطأ",
        description: "يرجى ملء حقلي رقم القطعة واسم التجزئة",
        variant: "destructive",
      });
      return;
    }

    if ((formData.committee_opinion === "تحفظ" || formData.committee_opinion === "مرفوض") && !formData.rejection_reason) {
      toast({
        title: "خطأ",
        description: "يرجى ذكر سبب التحفظ أو الرفض",
        variant: "destructive",
      });
      return;
    }

    createFileMutation.mutate(formData);
  };

  const showRejectionReason = formData.committee_opinion === "تحفظ" || formData.committee_opinion === "مرفوض";

  return (
    <div className="max-w-3xl mx-auto space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
          <FilePlus className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">تسجيل ملف جديد</h1>
          <p className="text-muted-foreground">ما بعد الشباك الوحيد</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>المعلومات الأساسية</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="full_name">الاسم الكامل *</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="أدخل الاسم الكامل للمالك"
                required
                className="text-right"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="municipality">البلدية *</Label>
              <Select
                dir="rtl"
                value={formData.municipality}
                onValueChange={(value: Municipality) =>
                  setFormData({ ...formData, municipality: value })
                }
              >
                <SelectTrigger className="text-right flex flex-row-reverse items-center justify-between">
                  <SelectValue placeholder="اختر البلدية" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="غرداية">غرداية</SelectItem>
                  <SelectItem value="العطف">العطف</SelectItem>
                  <SelectItem value="بنورة">بنورة</SelectItem>
                  <SelectItem value="الضاية">الضاية</SelectItem>
                  <SelectItem value="متليلي">متليلي</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="permit_type">نوع عقد التعمير</Label>
              <Select
                dir="rtl"
                value={formData.permit_type}
                onValueChange={handlePermitTypeChange}
              >
                <SelectTrigger className="text-right flex flex-row-reverse items-center justify-between">
                  <SelectValue placeholder="اختر نوع العقد" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="رخصة بناء">رخصة بناء</SelectItem>
                  <SelectItem value="رخصة تجزئة">رخصة تجزئة</SelectItem>
                  <SelectItem value="رخصة هدم">رخصة هدم</SelectItem>
                  <SelectItem value="شهادة تقسيم">شهادة تقسيم</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="file_number">رقم الملف *</Label>
              <Input
                id="file_number"
                value={formData.file_number}
                onChange={(e) => setFormData({ ...formData, file_number: e.target.value })}
                placeholder="أدخل رقم الملف"
                required
                className="text-right"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="year">السنة</Label>
              <Input
                id="year"
                type="number"
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                min={2000}
                max={2100}
                className="text-right"
              />
            </div>
          </CardContent>
        </Card>

        {/* Ownership Documents */}
        <Card>
          <CardHeader>
            <CardTitle>سند الملكية</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Label>نوع السند *</Label>
              <Select
                dir="rtl"
                value={formData.ownership_type}
                onValueChange={(value: OwnershipType | OwnershipTypeForNonBuilding) => {
                  // If switching to something other than "دفتر عقاري", clear section/ilot
                  const isRealEstateDeed = value === "دفتر عقاري";

                  setFormData({
                    ...formData,
                    ownership_type: value,
                    // Clear cadastre fields if not "دفتر عقاري"
                    section: isRealEstateDeed ? formData.section : "",
                    property_group: isRealEstateDeed ? formData.property_group : "",
                    // Also handle certificate of benefit cleanup if needed
                    lot_number: value !== "شهادة استفادة" ? "" : formData.lot_number,
                    subdivision_name: value !== "شهادة استفادة" ? "" : formData.subdivision_name,
                  });
                }}
              >
                <SelectTrigger className="text-right flex flex-row-reverse items-center justify-between">
                  <SelectValue placeholder="اختر نوع السند" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="عقد ملكية">عقد ملكية</SelectItem>
                  <SelectItem value="دفتر عقاري">دفتر عقاري</SelectItem>
                  {/* شهادة استفادة only visible for رخصة بناء */}
                  {formData.permit_type === "رخصة بناء" && (
                    <SelectItem value="شهادة استفادة">شهادة استفادة</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {formData.ownership_type === "شهادة استفادة" && (
              <div className="grid gap-4 md:grid-cols-3 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="lot_number">رقم القطعة *</Label>
                  <Input
                    id="lot_number"
                    value={formData.lot_number}
                    onChange={(e) => setFormData({ ...formData, lot_number: e.target.value })}
                    placeholder="أدخل رقم القطعة"
                    className="text-right"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subdivision_name">التجزئة *</Label>
                  <Input
                    id="subdivision_name"
                    value={formData.subdivision_name}
                    onChange={(e) => setFormData({ ...formData, subdivision_name: e.target.value })}
                    placeholder="أدخل اسم التجزئة"
                    className="text-right"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address_cert">العنوان *</Label>
                  <Input
                    id="address_cert"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="أدخل العنوان"
                    className="text-right"
                  />
                </div>
              </div>
            )}

            {/* Cadastral Data - Manual Entry */}
            {/* CONDITIONAL: Only show if ownership type is "دفتر عقاري" */}
            {formData.ownership_type === "دفتر عقاري" &&
              ["رخصة بناء", "رخصة تجزئة", "رخصة هدم", "شهادة تقسيم"].includes(formData.permit_type) && (
                <div className="grid gap-4 md:grid-cols-2 pt-4 border-t border-border mt-4">
                  <div className="md:col-span-2">
                    <Label className="text-base font-semibold">معلومات المسح (إدخال يدوي)</Label>
                    <p className="text-xs text-muted-foreground mb-3">يمكنك إدخال رقم القسم ومجموعة الملكية يدوياً (مع الالتزام بالتنسيق).</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="section">القسم (3 أرقام) *</Label>
                    <Input
                      id="section"
                      value={formData.section}
                      onChange={(e) => setFormData({ ...formData, section: clampSectionDigits(e.target.value) })}
                      onBlur={() => setFormData({ ...formData, section: formatSection(formData.section) })}
                      placeholder="مثال: 001"
                      required
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={3}
                      className="text-right font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="property_group">مجموعة الملكية (4 أرقام) *</Label>
                    <Input
                      id="property_group"
                      value={formData.property_group}
                      onChange={(e) => setFormData({ ...formData, property_group: clampPropertyGroupDigits(e.target.value) })}
                      onBlur={() => setFormData({ ...formData, property_group: formatPropertyGroup(formData.property_group) })}
                      placeholder="مثال: 0001"
                      required
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={4}
                      className="text-right font-mono"
                    />
                  </div>
                </div>
              )}

            {formData.ownership_type !== "شهادة استفادة" && (
              <div className="space-y-2">
                <Label htmlFor="address">العنوان *</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="أدخل العنوان الكامل"
                  required
                  className="text-right"
                />
              </div>
            )}
          </CardContent>
        </Card>
        {/* Dynamic Fields based on permit_type - رخصة بناء */}
        {formData.permit_type === "رخصة بناء" && (
          <Card>
            <CardHeader>
              <CardTitle>بيانات رخصة البناء</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="plot_area">مساحة الأرضية (م²)</Label>
                <Input
                  id="plot_area"
                  type="number"
                  value={formData.plot_area}
                  onChange={(e) => setFormData({ ...formData, plot_area: e.target.value })}
                  placeholder="0.00"
                  step="0.01"
                  className="text-right"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="built_area">المساحة المبنية (م²)</Label>
                <Input
                  id="built_area"
                  type="number"
                  value={formData.built_area}
                  onChange={(e) => setFormData({ ...formData, built_area: e.target.value })}
                  placeholder="0.00"
                  step="0.01"
                  className="text-right"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="engineer_name">مكتب الدراسات</Label>
                <Input
                  id="engineer_name"
                  value={formData.engineer_name}
                  onChange={(e) => setFormData({ ...formData, engineer_name: e.target.value })}
                  placeholder="أدخل اسم مكتب الدراسات"
                  className="text-right"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Dynamic Fields based on permit_type - رخصة تجزئة */}
        {formData.permit_type === "رخصة تجزئة" && (
          <Card>
            <CardHeader>
              <CardTitle>بيانات رخصة التجزئة</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="plot_area">مساحة الأرضية (م²)</Label>
                <Input
                  id="plot_area"
                  type="number"
                  value={formData.plot_area}
                  onChange={(e) => setFormData({ ...formData, plot_area: e.target.value })}
                  placeholder="0.00"
                  step="0.01"
                  className="text-right"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plots_count">عدد القطع</Label>
                <Input
                  id="plots_count"
                  type="number"
                  value={formData.plots_count}
                  onChange={(e) => setFormData({ ...formData, plots_count: e.target.value })}
                  placeholder="0"
                  min="1"
                  className="text-right"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Dynamic Fields based on permit_type - شهادة تقسيم */}
        {formData.permit_type === "شهادة تقسيم" && (
          <Card>
            <CardHeader>
              <CardTitle>بيانات شهادة التقسيم</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="plot_area">مساحة القطعة (م²)</Label>
                <Input
                  id="plot_area"
                  type="number"
                  value={formData.plot_area}
                  onChange={(e) => setFormData({ ...formData, plot_area: e.target.value })}
                  placeholder="0.00"
                  step="0.01"
                  className="text-right"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shares_count">عدد الحصص</Label>
                <Input
                  id="shares_count"
                  type="number"
                  value={formData.shares_count}
                  onChange={(e) => setFormData({ ...formData, shares_count: e.target.value })}
                  placeholder="0"
                  min="1"
                  className="text-right"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Administrative Status */}
        <Card>
          <CardHeader>
            <CardTitle>الوضعية الإدارية</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>تاريخ إيداع الملف</Label>
              <DateInput
                value={formData.submission_date}
                onChange={(date) => setFormData({ ...formData, submission_date: date })}
                placeholder="YYYY/MM/DD"
              />
            </div>
            <div className="space-y-2">
              <Label>تاريخ الجلسة</Label>
              <DateInput
                value={formData.session_date}
                onChange={(date) => setFormData({ ...formData, session_date: date })}
                placeholder="YYYY/MM/DD"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>رأي اللجنة</Label>
              <Select
                dir="rtl"
                value={formData.committee_opinion}
                onValueChange={(value: CommitteeOpinion) =>
                  setFormData({ ...formData, committee_opinion: value, rejection_reason: "" })
                }
              >
                <SelectTrigger className="text-right flex flex-row-reverse items-center justify-between">
                  <SelectValue placeholder="اختر رأي اللجنة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="رأي إيجابي">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-success" />
                      رأي إيجابي
                    </span>
                  </SelectItem>
                  <SelectItem value="تحفظ">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-warning" />
                      تحفظ
                    </span>
                  </SelectItem>
                  <SelectItem value="مرفوض">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-destructive" />
                      مرفوض
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {showRejectionReason && (
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="rejection_reason">سبب التحفظ أو الرفض *</Label>
                <Textarea
                  id="rejection_reason"
                  value={formData.rejection_reason}
                  onChange={(e) => setFormData({ ...formData, rejection_reason: e.target.value })}
                  placeholder="اذكر السبب بالتفصيل..."
                  rows={4}
                  required
                  className="text-right"
                />
              </div>
            )}

            {/* Electronic Permit Copy - Only for Building Permit */}
            {formData.permit_type === "رخصة بناء" && (
              <div className="space-y-2 md:col-span-2 pt-2 border-t border-border">
                <Label>نسخة إلكترونية من الرخصة</Label>
                <Input
                  ref={electronicPermitInputRef}
                  type="file"
                  accept=".pdf,image/*"
                  onChange={handleElectronicPermitFile}
                  className="hidden"
                  id="electronic_permit"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" onClick={openElectronicPermitPicker}>
                    <FileUp className="w-4 h-4 ml-2" />
                    رفع من الكمبيوتر
                  </Button>
                  <Input
                    value={formData.electronic_permit_file?.name || ""}
                    readOnly
                    placeholder="لم يتم اختيار ملف بعد"
                    className="flex-1 text-right"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  يمكنك رفع نسخة PDF/صورة من الكمبيوتر.
                </p>
              </div>
            )}

            {/* Map Location Focus - For All Permit Types */}
            {["رخصة بناء", "رخصة تجزئة", "رخصة هدم", "شهادة تقسيم"].includes(formData.permit_type) && (
              <div className="space-y-2 md:col-span-2 pt-2 border-t border-border">
                <PermitLocationPicker
                  value={
                    formData.section && formData.property_group
                      ? { section: formData.section, ilot: formData.property_group }
                      : null
                  }
                  onChange={(data) =>
                    setFormData({
                      ...formData,
                      section: data?.section || "",
                      property_group: data?.ilot || "",
                    })
                  }
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex gap-4">
          <Button
            type="submit"
            className="flex-1"
            disabled={createFileMutation.isPending}
          >
            {createFileMutation.isPending ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                جاري الحفظ...
              </>
            ) : (
              "حفظ المعلومات"
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/")}
          >
            إلغاء
          </Button>
        </div>
      </form>
    </div>
  );
}


