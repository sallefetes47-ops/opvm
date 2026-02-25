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
import { ar } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { formatFileNumberWithYear } from "@/lib/file-number";

interface DeletedFile {
  id: string;
  file_number: string;
  year: number;
  full_name: string;
  municipality: string;
  permit_type: string | null;
  deleted_at: string;
}

export default function TrashBin() {
  const { role, isViewer } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<DeletedFile | null>(null);
  const [actionType, setActionType] = useState<"restore" | "delete" | null>(null);

  const canManage = role === "admin" && !isViewer;

  /* ── جلب الملفات المحذوفة (deleted_at IS NOT NULL) ── */
  const { data: deletedFiles, isLoading } = useQuery({
    queryKey: ["deleted-files"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("files")
        .select("id, file_number, year, full_name, municipality, permit_type, deleted_at")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });

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
          { is_deleted: false, deleted_at: null },
          { returning: "minimal" }
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
        .delete({ returning: "minimal" })
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
      <Card className="border-t-4 border-t-destructive/20">
        <CardHeader className="p-4 pb-2 border-b bg-muted/20">
          <CardTitle className="text-sm">
            الملفات المحذوفة ({deletedFiles?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {deletedFiles && deletedFiles.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                  <TableRow>
                    <TableHead className="w-[80px]">رقم الملف</TableHead>
                    <TableHead>صاحب الملف</TableHead>
                    <TableHead className="w-[140px]">تاريخ الحذف</TableHead>
                    <TableHead className="w-[100px]">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deletedFiles.map((file) => (
                    <TableRow key={file.id} className="hover:bg-muted/50">
                      <TableCell className="font-mono text-xs font-bold">
                        {formatFileNumberWithYear(file.file_number, file.year)}
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">
                            {file.full_name}
                          </span>
                          <span className="text-[10px] text-muted-foreground flex gap-1">
                            <span>{file.municipality}</span>
                            {file.permit_type && (
                              <span>• {file.permit_type}</span>
                            )}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {file.deleted_at
                          ? format(
                            new Date(file.deleted_at),
                            "d MMMM yyyy",
                            { locale: ar }
                          )
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => handleAction(file, "restore")}
                            title="استعادة الملف"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleAction(file, "delete")}
                            title="حذف نهائي"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <Trash2 className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium">سلة المحذوفات فارغة</p>
              <p className="text-sm mt-1">لا توجد ملفات محذوفة حالياً</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── نافذة التأكيد ── */}
      <AlertDialog
        open={!!selectedFile && !!actionType}
        onOpenChange={() => {
          setSelectedFile(null);
          setActionType(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === "restore"
                ? "تأكيد استعادة الملف"
                : "تأكيد الحذف النهائي"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === "restore"
                ? `هل تريد استعادة الملف رقم "${formatFileNumberWithYear(selectedFile?.file_number, selectedFile?.year)}" الخاص بـ "${selectedFile?.full_name}" وإعادته إلى الأرشيف الرقمي؟`
                : `هل أنت متأكد من الحذف النهائي للملف رقم "${formatFileNumberWithYear(selectedFile?.file_number, selectedFile?.year)}" الخاص بـ "${selectedFile?.full_name}"؟ هذا الإجراء لا يمكن التراجع عنه.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAction}
              className={
                actionType === "delete"
                  ? "bg-destructive hover:bg-destructive/90"
                  : "bg-green-600 hover:bg-green-700"
              }
              disabled={
                restoreMutation.isPending || permanentDeleteMutation.isPending
              }
            >
              {restoreMutation.isPending ||
                permanentDeleteMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin ml-2" />
              ) : null}
              {actionType === "restore" ? "استعادة" : "حذف نهائي"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
