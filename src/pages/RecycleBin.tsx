import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { formatPropertyGroup, formatSection } from "@/lib/cadastre";

interface DeletedFile {
  id: string;
  municipality: string;
  section: string | null;
  property_group: string | null;
  deleted_at: string | null;
  full_name: string | null;
  file_number: string | null;
  permit_type: string | null;
}

const CORE_MUNICIPALITIES = ["غرداية", "العطف", "بنورة", "الضاية", "متليلي"] as const;

function cleanMunicipality(name: string) {
  if (!name) return "";
  const cleaned = name.replace(/بلدية\s*/g, "").trim();
  const matched = CORE_MUNICIPALITIES.find((m) => cleaned.includes(m));
  return matched ?? cleaned;
}

export default function RecycleBin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<DeletedFile | null>(null);
  const [actionType, setActionType] = useState<"restore" | "delete" | null>(null);

  const syncDashboardCache = (fileId: string, action: "restore" | "delete") => {
    queryClient.setQueryData<any[]>(["dashboard-executive"], (prev = []) => {
      if (action === "restore") {
        return prev.map((row) => (row?.id === fileId ? { ...row, is_deleted: false, deleted_at: null } : row));
      }
      return prev.filter((row) => row?.id !== fileId);
    });
  };

  const { data: deletedFiles = [], isLoading } = useQuery({
    queryKey: ["deleted-files"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("files")
        .select("id, municipality, section, property_group, deleted_at")
        .is("is_deleted", true)
        .order("deleted_at", { ascending: false, nullsFirst: false });

      if (error) throw error;
      return (data ?? []) as DeletedFile[];
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const { error } = await supabase
        .from("files")
        .update({ is_deleted: false, deleted_at: null })
        .eq("id", fileId);
      if (error) throw error;
    },
    onMutate: async (fileId) => {
      queryClient.setQueryData<DeletedFile[]>(["deleted-files"], (prev = []) => prev.filter((item) => item.id !== fileId));
      syncDashboardCache(fileId, "restore");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deleted-files"] });
      queryClient.invalidateQueries({ queryKey: ["archive-files"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-executive"] });
      toast({ title: "تمت الاستعادة", description: "تمت استعادة السجل بنجاح." });
      setSelectedFile(null);
      setActionType(null);
    },
    onError: (error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const { error } = await supabase.from("files").delete().eq("id", fileId);
      if (error) throw error;
    },
    onMutate: async (fileId) => {
      queryClient.setQueryData<DeletedFile[]>(["deleted-files"], (prev = []) => prev.filter((item) => item.id !== fileId));
      syncDashboardCache(fileId, "delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deleted-files"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-executive"] });
      toast({ title: "تم الحذف النهائي", description: "تم حذف السجل نهائياً." });
      setSelectedFile(null);
      setActionType(null);
    },
    onError: (error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const handleAction = (file: DeletedFile, action: "restore" | "delete") => {
    setSelectedFile(file);
    setActionType(action);
  };

  const confirmAction = () => {
    if (!selectedFile || !actionType) return;
    if (actionType === "restore") restoreMutation.mutate(selectedFile.id);
    else permanentDeleteMutation.mutate(selectedFile.id);
  };

  if (isLoading) {
    return (
      <div className="space-y-6" dir="rtl">
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
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-destructive/10 rounded-lg flex items-center justify-center">
          <Trash2 className="w-5 h-5 text-destructive" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">سلة المحذوفات</h1>
          <p className="text-muted-foreground">السجلات التي تم حذفها ويمكن استعادتها أو حذفها نهائياً.</p>
        </div>
      </div>

      <Card className="border-t-4 border-t-destructive/20 shadow-sm">
        <CardHeader className="p-4 pb-2 border-b bg-muted/20">
          <CardTitle className="text-sm">السجلات المحذوفة ({deletedFiles.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {deletedFiles.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                  <TableRow>
                    <TableHead className="w-[160px]">البلدية</TableHead>
                    <TableHead className="w-[120px]">القسم</TableHead>
                    <TableHead className="w-[160px]">مجموعة الملكية</TableHead>
                    <TableHead className="w-[160px]">تاريخ الحذف</TableHead>
                    <TableHead className="w-[170px]">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deletedFiles.map((file) => (
                    <TableRow key={file.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-medium text-sm">{cleanMunicipality(file.municipality)}</TableCell>
                      <TableCell className="font-mono text-sm">{formatSection(file.section)}</TableCell>
                      <TableCell className="font-mono text-sm">{formatPropertyGroup(file.property_group)}</TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {file.deleted_at ? format(new Date(file.deleted_at), "yyyy/MM/dd") : "---"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 border-green-200 text-green-700 bg-green-50 hover:bg-green-100 hover:text-green-800"
                            onClick={() => handleAction(file, "restore")}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span className="text-xs font-semibold">استعادة</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 border-red-200 text-red-600 bg-red-50 hover:bg-red-100 hover:text-red-700"
                            onClick={() => handleAction(file, "delete")}
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
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={!!selectedFile && !!actionType}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedFile(null);
            setActionType(null);
          }
        }}
      >
        <AlertDialogContent className="rounded-2xl border-0 shadow-2xl" dir="rtl">
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
                ? `هل أنت متأكد من استعادة سجل ${cleanMunicipality(selectedFile?.municipality || "")}؟`
                : "هل أنت متأكد من حذف هذا السجل نهائياً؟ لا يمكن التراجع عن هذا الإجراء."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 gap-3 sm:gap-0">
            <AlertDialogCancel className="border-slate-200 hover:bg-slate-100 font-medium">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmAction();
              }}
              className={actionType === "delete" ? "bg-red-600 text-white hover:bg-red-700 font-semibold" : "bg-green-600 text-white hover:bg-green-700 font-semibold"}
              disabled={restoreMutation.isPending || permanentDeleteMutation.isPending}
            >
              {(restoreMutation.isPending || permanentDeleteMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
              {actionType === "restore" ? "تأكيد الاستعادة" : "نعم، حذف نهائي"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
