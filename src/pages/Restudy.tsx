import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Search, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { formatFileNumberWithYear } from "@/lib/file-number";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type Municipality = Database["public"]["Enums"]["municipality"];
type PermitType = "رخصة بناء" | "رخصة تجزئة" | "رخصة هدم" | "شهادة تقسيم" | "";
type FileRecord = Database["public"]["Tables"]["files"]["Row"];

interface SearchParams {
  municipality: Municipality | "";
  permit_type: PermitType;
  file_number: string;
  year: string;
}

interface RestudyFormData {
  study_date: Date | undefined;
  new_opinion: "مقبول" | "تحفظ" | "مرفوض" | "";
  new_reason: string;
}

export default function Restudy() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchParams, setSearchParams] = useState<SearchParams>({
    municipality: "",
    permit_type: "",
    file_number: "",
    year: new Date().getFullYear().toString(),
  });

  const [foundFile, setFoundFile] = useState<FileRecord | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const [restudyData, setRestudyData] = useState<RestudyFormData>({
    study_date: new Date(),
    new_opinion: "",
    new_reason: "",
  });

  const handleSearch = async () => {
    if (!searchParams.municipality || !searchParams.file_number || !searchParams.year) {
      toast({
        title: "خطأ",
        description: "يرجى ملء جميع حقول البحث المطلوبة",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);
    setFoundFile(null);

    try {
      let query = supabase
        .from("files")
        .select("*")
        .eq("is_deleted", false)
        .eq("municipality", searchParams.municipality)
        .eq("file_number", searchParams.file_number)
        .eq("year", parseInt(searchParams.year));

      if (searchParams.permit_type) {
        query = query.eq("permit_type", searchParams.permit_type);
      }

      const { data, error } = await query.maybeSingle();

      if (error) throw error;

      if (data) {
        setFoundFile(data);
        toast({
          title: "تم العثور على الملف",
          description: `الملف رقم ${formatFileNumberWithYear(data.file_number, data.year)} للمالك ${data.full_name}`,
        });
      } else {
        toast({
          title: "لم يتم العثور",
          description: "لا يوجد ملف مطابق لمعايير البحث",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const addStudyMutation = useMutation({
    mutationFn: async () => {
      if (!foundFile || !restudyData.study_date || !restudyData.new_opinion) {
        throw new Error("يرجى ملء جميع الحقول المطلوبة");
      }

      if ((restudyData.new_opinion === "تحفظ" || restudyData.new_opinion === "مرفوض") && !restudyData.new_reason) {
        throw new Error("يرجى ذكر سبب التحفظ أو الرفض");
      }

      // Map the new opinion to committee_opinion format
      const committeeOpinion = restudyData.new_opinion === "مقبول"
        ? "رأي إيجابي"
        : restudyData.new_opinion;

      // Insert into file_studies table
      // RLS FIX: Ensure user is authenticated before insert
      if (!user?.id) {
        throw new Error("يجب تسجيل الدخول أولاً");
      }

      const { error: studyError } = await supabase.from("file_studies").insert({
        file_id: foundFile.id,
        study_date: format(restudyData.study_date, "yyyy-MM-dd"),
        permit_type: foundFile.permit_type,
        committee_opinion: committeeOpinion,
        rejection_reason: (restudyData.new_opinion === "تحفظ" || restudyData.new_opinion === "مرفوض")
          ? restudyData.new_reason
          : null,
        created_by: user.id,
      });

      if (studyError) {
        console.error("[RLS] file_studies insert error:", studyError);
        console.error("[RLS] User context:", { userId: user.id, hasSession: !!user });
        throw studyError;
      }

      // Update the main file record with the new opinion
      const { error: updateError } = await supabase
        .from("files")
        .update({
          committee_opinion: committeeOpinion as Database["public"]["Enums"]["committee_opinion"],
          session_date: format(restudyData.study_date, "yyyy-MM-dd"),
          rejection_reason: (restudyData.new_opinion === "تحفظ" || restudyData.new_opinion === "مرفوض")
            ? restudyData.new_reason
            : null,
        })
        .eq("id", foundFile.id);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["archive-files"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-files"] });
      toast({
        title: "تم الحفظ بنجاح",
        description: "تم تسجيل إعادة الدراسة بنجاح",
      });
      // Reset form
      setFoundFile(null);
      setRestudyData({
        study_date: new Date(),
        new_opinion: "",
        new_reason: "",
      });
      setSearchParams({
        municipality: "",
        permit_type: "",
        file_number: "",
        year: new Date().getFullYear().toString(),
      });
    },
    onError: (error: Error) => {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getOpinionBadge = (opinion: string | null) => {
    switch (opinion) {
      case "رأي إيجابي":
        return <Badge className="bg-success hover:bg-success/90">رأي إيجابي</Badge>;
      case "تحفظ":
        return <Badge className="bg-warning hover:bg-warning/90 text-warning-foreground">تحفظ</Badge>;
      case "مرفوض":
        return <Badge className="bg-destructive hover:bg-destructive/90">مرفوض</Badge>;
      default:
        return <Badge variant="secondary">قيد الانتظار</Badge>;
    }
  };

  const showNewReason = restudyData.new_opinion === "تحفظ" || restudyData.new_opinion === "مرفوض";

  return (
    <div className="space-y-6 max-w-3xl mx-auto" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
          <RefreshCw className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">إعادة الدراسة</h1>
          <p className="text-muted-foreground">البحث عن ملف وإضافة دراسة جديدة</p>
        </div>
      </div>

      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            البحث عن الملف
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>البلدية *</Label>
              <Select
                dir="rtl"
                value={searchParams.municipality}
                onValueChange={(value: Municipality) =>
                  setSearchParams({ ...searchParams, municipality: value })
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
              <Label>نوع عقد التعمير</Label>
              <Select
                dir="rtl"
                value={searchParams.permit_type}
                onValueChange={(value: PermitType) =>
                  setSearchParams({ ...searchParams, permit_type: value })
                }
              >
                <SelectTrigger className="text-right flex flex-row-reverse items-center justify-between">
                  <SelectValue placeholder="اختر نوع العقد (اختياري)" />
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
              <Label>رقم الملف *</Label>
              <Input
                value={searchParams.file_number}
                onChange={(e) => setSearchParams({ ...searchParams, file_number: e.target.value })}
                placeholder="أدخل رقم الملف"
                className="text-right"
              />
            </div>
            <div className="space-y-2">
              <Label>السنة *</Label>
              <Input
                type="number"
                value={searchParams.year}
                onChange={(e) => setSearchParams({ ...searchParams, year: e.target.value })}
                min={2000}
                max={2100}
                className="text-right"
              />
            </div>
          </div>
          <Button onClick={handleSearch} disabled={isSearching} className="w-full">
            {isSearching ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                جاري البحث...
              </>
            ) : (
              <>
                <Search className="ml-2 h-4 w-4" />
                بحث
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Found File - Read Only Details */}
      {foundFile && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>بيانات الملف (غير قابلة للتعديل)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-sm">الاسم الكامل</Label>
                  <p className="font-medium bg-muted/50 p-2 rounded-md">{foundFile.full_name}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-sm">البلدية</Label>
                  <p className="font-medium bg-muted/50 p-2 rounded-md">{foundFile.municipality}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-sm">رقم الملف</Label>
                  <p className="font-medium bg-muted/50 p-2 rounded-md">{formatFileNumberWithYear(foundFile.file_number, foundFile.year)}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-sm">السنة</Label>
                  <p className="font-medium bg-muted/50 p-2 rounded-md">{foundFile.year}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-sm">تاريخ الجلسة السابقة</Label>
                  <p className="font-medium bg-muted/50 p-2 rounded-md">
                    {foundFile.session_date
                      ? format(new Date(foundFile.session_date), "d MMMM yyyy", { locale: ar })
                      : "غير محدد"}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-sm">الرأي السابق</Label>
                  <div className="bg-muted/50 p-2 rounded-md">
                    {getOpinionBadge(foundFile.committee_opinion)}
                  </div>
                </div>
                {foundFile.rejection_reason && (
                  <div className="space-y-1 md:col-span-2">
                    <Label className="text-muted-foreground text-sm">أسباب التحفظ أو الرفض السابقة</Label>
                    <p className="font-medium bg-muted/50 p-3 rounded-md whitespace-pre-wrap">
                      {foundFile.rejection_reason}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* New Study Entry */}
          <Card>
            <CardHeader>
              <CardTitle>إعادة الدراسة الجديدة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>تاريخ إعادة الدراسة *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-right font-normal",
                          !restudyData.study_date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="ml-2 h-4 w-4" />
                        {restudyData.study_date
                          ? format(restudyData.study_date, "d MMMM yyyy", { locale: ar })
                          : "اختر التاريخ"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={restudyData.study_date}
                        onSelect={(date) => setRestudyData({ ...restudyData, study_date: date })}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>القرار الجديد *</Label>
                  <Select
                    dir="rtl"
                    value={restudyData.new_opinion}
                    onValueChange={(value: "مقبول" | "تحفظ" | "مرفوض") =>
                      setRestudyData({ ...restudyData, new_opinion: value, new_reason: "" })
                    }
                  >
                    <SelectTrigger className="text-right flex flex-row-reverse items-center justify-between">
                      <SelectValue placeholder="اختر القرار" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="مقبول">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-success" />
                          مقبول
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
              </div>

              {showNewReason && (
                <div className="space-y-2">
                  <Label>الأسباب الجديدة *</Label>
                  <Textarea
                    value={restudyData.new_reason}
                    onChange={(e) => setRestudyData({ ...restudyData, new_reason: e.target.value })}
                    placeholder="اذكر أسباب التحفظ أو الرفض الجديدة..."
                    rows={4}
                    className="text-right"
                  />
                </div>
              )}

              <Button
                onClick={() => addStudyMutation.mutate()}
                disabled={addStudyMutation.isPending}
                className="w-full"
              >
                {addStudyMutation.isPending ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    جاري الحفظ...
                  </>
                ) : (
                  "حفظ إعادة الدراسة"
                )}
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
