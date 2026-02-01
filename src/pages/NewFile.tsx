import { useState } from "react";
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2, FilePlus } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type Municipality = Database["public"]["Enums"]["municipality"];
type OwnershipType = Database["public"]["Enums"]["ownership_type"];
type CommitteeOpinion = Database["public"]["Enums"]["committee_opinion"];
type PermitType = "رخصة بناء" | "رخصة تجزئة" | "رخصة هدم" | "شهادة تقسيم" | "";

interface FileFormData {
  full_name: string;
  municipality: Municipality | "";
  permit_type: PermitType;
  file_number: string;
  year: number;
  ownership_type: OwnershipType;
  address: string;
  section: string;
  property_group: string;
  plot_area: string;
  built_area: string;
  floors_count: string;
  engineer_name: string;
  total_area: string;
  plots_count: string;
  demolition_reason: string;
  work_duration: string;
  shares_count: string;
  property_reference: string;
  submission_date: Date | undefined;
  session_date: Date | undefined;
  committee_opinion: CommitteeOpinion | "";
  rejection_reason: string;
}

export default function NewFile() {
  const currentYear = new Date().getFullYear();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
    floors_count: "",
    engineer_name: "",
    total_area: "",
    plots_count: "",
    demolition_reason: "",
    work_duration: "",
    shares_count: "",
    property_reference: "",
    submission_date: undefined,
    session_date: undefined,
    committee_opinion: "",
    rejection_reason: "",
  });

  const createFileMutation = useMutation({
    mutationFn: async (data: FileFormData) => {
      const { error } = await supabase.from("files").insert({
        full_name: data.full_name,
        municipality: data.municipality as Municipality,
        permit_type: data.permit_type || null,
        file_number: data.file_number,
        year: data.year,
        ownership_type: data.ownership_type,
        address: data.address,
        section: data.ownership_type === "دفتر عقاري" ? data.section : null,
        property_group: data.ownership_type === "دفتر عقاري" ? data.property_group : null,
        plot_area: data.plot_area ? parseFloat(data.plot_area) : null,
        built_area: data.permit_type === "رخصة بناء" && data.built_area ? parseFloat(data.built_area) : null,
        floors_count: data.permit_type === "رخصة بناء" && data.floors_count ? parseInt(data.floors_count) : null,
        engineer_name: data.permit_type === "رخصة بناء" ? data.engineer_name : null,
        total_area: data.permit_type === "رخصة تجزئة" && data.total_area ? parseFloat(data.total_area) : null,
        plots_count: data.permit_type === "رخصة تجزئة" && data.plots_count ? parseInt(data.plots_count) : null,
        demolition_reason: data.permit_type === "رخصة هدم" ? data.demolition_reason : null,
        work_duration: data.permit_type === "رخصة هدم" ? data.work_duration : null,
        shares_count: data.permit_type === "شهادة تقسيم" && data.shares_count ? parseInt(data.shares_count) : null,
        property_reference: data.permit_type === "شهادة تقسيم" ? data.property_reference : null,
        submission_date: data.submission_date ? format(data.submission_date, "yyyy-MM-dd") : null,
        session_date: data.session_date ? format(data.session_date, "yyyy-MM-dd") : null,
        committee_opinion: data.committee_opinion || null,
        rejection_reason: (data.committee_opinion === "تحفظ" || data.committee_opinion === "مرفوض") ? data.rejection_reason : null,
        created_by: user?.id,
      });

      if (error) throw error;
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
        description: "يرجى ملء حقول القسم ومجموعة الملكية",
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
    <div className="max-w-3xl mx-auto space-y-6">
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
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="municipality">البلدية *</Label>
              <Select
                value={formData.municipality}
                onValueChange={(value: Municipality) =>
                  setFormData({ ...formData, municipality: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر البلدية" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="غرداية">غرداية</SelectItem>
                  <SelectItem value="العطف">العطف</SelectItem>
                  <SelectItem value="بونورة">بونورة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="permit_type">نوع عقد التعمير</Label>
              <Select
                value={formData.permit_type}
                onValueChange={(value: PermitType) =>
                  setFormData({ ...formData, permit_type: value })
                }
              >
                <SelectTrigger>
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
              />
            </div>
          </CardContent>
        </Card>

        {/* Dynamic Fields based on permit_type */}
        {formData.permit_type === "رخصة بناء" && (
          <Card>
            <CardHeader>
              <CardTitle>بيانات رخصة البناء</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="built_area">المساحة المبنية (م²)</Label>
                <Input
                  id="built_area"
                  type="number"
                  value={formData.built_area}
                  onChange={(e) => setFormData({ ...formData, built_area: e.target.value })}
                  placeholder="0.00"
                  step="0.01"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="floors_count">عدد الطوابق</Label>
                <Input
                  id="floors_count"
                  type="number"
                  value={formData.floors_count}
                  onChange={(e) => setFormData({ ...formData, floors_count: e.target.value })}
                  placeholder="0"
                  min="1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="engineer_name">اسم المهندس</Label>
                <Input
                  id="engineer_name"
                  value={formData.engineer_name}
                  onChange={(e) => setFormData({ ...formData, engineer_name: e.target.value })}
                  placeholder="أدخل اسم المهندس"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {formData.permit_type === "رخصة تجزئة" && (
          <Card>
            <CardHeader>
              <CardTitle>بيانات رخصة التجزئة</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="total_area">المساحة الإجمالية (م²)</Label>
                <Input
                  id="total_area"
                  type="number"
                  value={formData.total_area}
                  onChange={(e) => setFormData({ ...formData, total_area: e.target.value })}
                  placeholder="0.00"
                  step="0.01"
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
                />
              </div>
            </CardContent>
          </Card>
        )}

        {formData.permit_type === "رخصة هدم" && (
          <Card>
            <CardHeader>
              <CardTitle>بيانات رخصة الهدم</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="demolition_reason">سبب الهدم</Label>
                <Input
                  id="demolition_reason"
                  value={formData.demolition_reason}
                  onChange={(e) => setFormData({ ...formData, demolition_reason: e.target.value })}
                  placeholder="أدخل سبب الهدم"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="work_duration">مدة الأشغال</Label>
                <Input
                  id="work_duration"
                  value={formData.work_duration}
                  onChange={(e) => setFormData({ ...formData, work_duration: e.target.value })}
                  placeholder="مثال: 3 أشهر"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {formData.permit_type === "شهادة تقسيم" && (
          <Card>
            <CardHeader>
              <CardTitle>بيانات شهادة التقسيم</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="shares_count">عدد الحصص</Label>
                <Input
                  id="shares_count"
                  type="number"
                  value={formData.shares_count}
                  onChange={(e) => setFormData({ ...formData, shares_count: e.target.value })}
                  placeholder="0"
                  min="1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="property_reference">المرجع العقاري</Label>
                <Input
                  id="property_reference"
                  value={formData.property_reference}
                  onChange={(e) => setFormData({ ...formData, property_reference: e.target.value })}
                  placeholder="أدخل المرجع العقاري"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Ownership Documents */}
        <Card>
          <CardHeader>
            <CardTitle>سند الملكية</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Label>نوع السند *</Label>
              <RadioGroup
                value={formData.ownership_type}
                onValueChange={(value: OwnershipType) =>
                  setFormData({ ...formData, ownership_type: value })
                }
                className="flex gap-6"
              >
                <div className="flex items-center space-x-2 space-x-reverse">
                  <RadioGroupItem value="عقد ملكية" id="deed" />
                  <Label htmlFor="deed" className="cursor-pointer">عقد ملكية</Label>
                </div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <RadioGroupItem value="دفتر عقاري" id="booklet" />
                  <Label htmlFor="booklet" className="cursor-pointer">دفتر عقاري</Label>
                </div>
              </RadioGroup>
            </div>

            {formData.ownership_type === "دفتر عقاري" && (
              <div className="grid gap-4 md:grid-cols-2 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="section">القسم *</Label>
                  <Input
                    id="section"
                    value={formData.section}
                    onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                    placeholder="أدخل رقم القسم"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="property_group">مجموعة الملكية *</Label>
                  <Input
                    id="property_group"
                    value={formData.property_group}
                    onChange={(e) => setFormData({ ...formData, property_group: e.target.value })}
                    placeholder="أدخل رقم مجموعة الملكية"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="address">العنوان *</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="أدخل العنوان الكامل"
                required
              />
            </div>
          </CardContent>
        </Card>

        {/* Technical Data */}
        <Card>
          <CardHeader>
            <CardTitle>البيانات التقنية</CardTitle>
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
              />
            </div>
          </CardContent>
        </Card>

        {/* Administrative Status */}
        <Card>
          <CardHeader>
            <CardTitle>الوضعية الإدارية</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>تاريخ إيداع الملف</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-right font-normal",
                      !formData.submission_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="ml-2 h-4 w-4" />
                    {formData.submission_date
                      ? format(formData.submission_date, "d MMMM yyyy", { locale: ar })
                      : "اختر التاريخ"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.submission_date}
                    onSelect={(date) => setFormData({ ...formData, submission_date: date })}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>تاريخ الجلسة</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-right font-normal",
                      !formData.session_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="ml-2 h-4 w-4" />
                    {formData.session_date
                      ? format(formData.session_date, "d MMMM yyyy", { locale: ar })
                      : "اختر التاريخ"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.session_date}
                    onSelect={(date) => setFormData({ ...formData, session_date: date })}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>رأي اللجنة</Label>
              <Select
                value={formData.committee_opinion}
                onValueChange={(value: CommitteeOpinion) =>
                  setFormData({ ...formData, committee_opinion: value, rejection_reason: "" })
                }
              >
                <SelectTrigger>
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
                  placeholder="اذكر سبب التحفظ أو الرفض بالتفصيل..."
                  rows={4}
                  required
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
