import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2, RotateCcw, AlertTriangle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { formatSection, formatPropertyGroup } from "@/lib/cadastre";

interface DeletedFile {
  id: string;
  municipality: string;
  section: string | null;
  property_group: string | null;
  deleted_at: string | null;
  file_number?: string;
  full_name?: string;
}

const cleanMunicipality = (name: string) => {
  if (!name) return "";
  const cleaned = name.replace(/بلدية\s*/g, "").trim();
  // Ensure we just output the core names
  const coreNames = ["غرداية", "العطف", "بنورة", "الضاية", "متليلي"];
  for (const coreName of coreNames) {
    if (cleaned.includes(coreName)) return coreName;
  }
  return cleaned;
};

export default function RecycleBin() {
  const { role, isViewer } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<DeletedFile | null>(null);
  const [actionType, setActionType] = useState<"restore" | "delete" | null>(null);

  const canManage = role === "admin" && !isViewer;

  /* ── جلب الملفات المحذوفة ── */
  const { data: deletedFiles, isLoading } = useQuery({
    queryKey: ["deleted-files"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("files")
        .select("id, municipality, section, property_group, deleted_at, file_number, full_name")
        .eq("is_deleted", true)
        // sort by most recently deleted if deleted_at exists, else sort by ID
        .order("deleted_at", { ascending: false, nullsFirst: false });

      if (error) throw error;
      return data as DeletedFile[];
    },
    enabled: canManage,
  });

  /* ── استعادة الملف ── */
  const restoreMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const { error } = await supabase
        .from("files")
        .update(
          { is_deleted: false, deleted_at: null }
        )
        .eq("id", fileId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deleted-files"] });
      queryClient.invalidateQueries({ queryKey: ["archive-files"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-files"] });
      toast({
        title: "✅ تمت الاستعادة",
        description: "تم استعادة الملف بنجاح وإعادته إلى الأرشيف الرقمي",
      });
      setSelectedFile(null);
      setActionType(null);
    },
    onError: (error) => {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  /* ── حذف نهائي ── */
  const permanentDeleteMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const { error } = await supabase
        .from("files")
        .delete()
        .eq("id", fileId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deleted-files"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-files"] });
      toast({
        title: "🗑️ تم الحذف نهائياً",
        description: "تم حذف الملف نهائياً من قاعدة البيانات ولا يمكن استرجاعه",
      });
      setSelectedFile(null);
      setActionType(null);
    },
    onError: (error) => {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAction = (file: DeletedFile, action: "restore" | "delete") => {
    setSelectedFile(file);
    setActionType(action);
  };

  const confirmAction = () => {
    if (!selectedFile || !actionType) return;

    if (actionType === "restore") {
      restoreMutation.mutate(selectedFile.id);
    } else {
      permanentDeleteMutation.mutate(selectedFile.id);
    }
  };

  /* ── غير مصرح ── */
  if (!canManage) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="w-12 h-12 text-warning mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">غير مصرح</h2>
            <p className="text-muted-foreground">
              هذه الصفحة متاحة للمدير فقط
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ── حالة التحميل ── */
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-lg" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-64" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── العنوان ── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-destructive/10 rounded-lg flex items-center justify-center">
          <Trash2 className="w-5 h-5 text-destructive" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">سلة المحذوفات</h1>
          <p className="text-muted-foreground">
            إدارة الملفات المنقولة إلى سلة المحذوفات — يمكن استعادتها أو حذفها نهائياً
          </p>
        </div>
      </div>

      {/* ── الجدول ── */}
      <Card className="border-t-4 border-t-destructive/20 shadow-sm">
        <CardHeader className="p-4 pb-2 border-b bg-muted/20">
          <CardTitle className="text-sm">
            المرجع العمراني ({deletedFiles?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {deletedFiles && deletedFiles.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                  <TableRow>
                    <TableHead className="w-[140px]">البلدية</TableHead>
                    <TableHead className="w-[100px]">القسم</TableHead>
                    <TableHead className="w-[150px]">مجموعة الملكية</TableHead>
                    <TableHead className="w-[150px]">تاريخ الحذف</TableHead>
                    <TableHead className="w-[120px]">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deletedFiles.map((file) => (
                    <TableRow key={file.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-medium text-sm">
                        {cleanMunicipality(file.municipality)}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatSection(file.section)}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatPropertyGroup(file.property_group)}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {file.deleted_at
                          ? format(new Date(file.deleted_at), "yyyy/MM/dd")
                          : "---"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 border-green-200 text-green-700 bg-green-50 hover:bg-green-100 hover:text-green-800 transition-colors"
                            onClick={() => handleAction(file, "restore")}
                            title="استعادة"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span className="text-xs font-semibold">استعادة</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 border-red-200 text-red-600 bg-red-50 hover:bg-red-100 hover:text-red-700 transition-colors"
                            onClick={() => handleAction(file, "delete")}
                            title="حذف نهائي"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="text-xs font-semibold">حذف نهائي</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-20 text-muted-foreground">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-5">
                <Trash2 className="w-10 h-10 text-slate-300" />
              </div>
              <p className="text-xl font-semibold text-slate-700">سلة المحذوفات فارغة حالياً</p>
              <p className="text-sm text-slate-500 mt-2">لا توجد أي ملفات أو قيود بانتظار الحذف النهائي</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── نافذة التأكيد ── */}
      <AlertDialog
        open={!!selectedFile && !!actionType}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedFile(null);
            setActionType(null);
          }
        }}
      >
        <AlertDialogContent className="rounded-2xl border-0 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-xl">
              {actionType === "restore" ? (
                <>
                  <RotateCcw className="h-5 w-5 text-green-600" />
                  <span>تأكيد الاستعادة</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <span className="text-red-600">تأكيد الحذف النهائي</span>
                </>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base text-slate-600 mt-3 leading-relaxed">
              {actionType === "restore"
                ? `هل أنت متأكد من رغبتك في استعادة بيانات "${cleanMunicipality(selectedFile?.municipality)}" القسم ${formatSection(selectedFile?.section)} بمجموعة الملكية ${formatPropertyGroup(selectedFile?.property_group)} وإعادتها إلى النظام؟`
                : `هل أنت متأكد من الحذف النهائي لبيانات "${cleanMunicipality(selectedFile?.municipality)}" القسم ${formatSection(selectedFile?.section)} بمجموعة الملكية ${formatPropertyGroup(selectedFile?.property_group)}؟ هذا الإجراء لا يمكن التراجع عنه بأي شكل من الأشكال.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 gap-3 sm:gap-0">
            <AlertDialogCancel className="border-slate-200 hover:bg-slate-100 font-medium">إلغاء الأمر</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault(); // Prevent closing right away if we wanna show loader
                confirmAction();
              }}
              className={
                actionType === "delete"
                  ? "bg-red-600 text-white hover:bg-red-700 font-semibold"
                  : "bg-green-600 text-white hover:bg-green-700 font-semibold"
              }
              disabled={
                restoreMutation.isPending || permanentDeleteMutation.isPending
              }
            >
              {(restoreMutation.isPending || permanentDeleteMutation.isPending) && (
                <Loader2 className="w-4 h-4 animate-spin outline-none ml-2" />
              )}
              {actionType === "restore" ? "تأكيد الاستعادة" : "نعم، احذف نهائياً"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
