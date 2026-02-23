import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

interface DeletedFile {
  id: string;
  file_number: string;
  full_name: string;
  municipality: string;
  deleted_at: string;
  committee_opinion: string | null;
}

export default function TrashBin() {
  const { role, isViewer } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<DeletedFile | null>(null);
  const [actionType, setActionType] = useState<"restore" | "delete" | null>(null);

  const canManage = role === "admin" && !isViewer;

  const { data: deletedFiles, isLoading } = useQuery({
    queryKey: ["deleted-files"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("files")
        .select("id, file_number, full_name, municipality, deleted_at, committee_opinion")
        .eq("is_deleted", true)
        .order("deleted_at", { ascending: false });

      if (error) throw error;
      return data as DeletedFile[];
    },
    enabled: canManage,
  });

  const restoreMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const { error } = await supabase
        .from("files")
        .update({ is_deleted: false, deleted_at: null }, { returning: "minimal" })
        .eq("id", fileId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deleted-files"] });
      queryClient.invalidateQueries({ queryKey: ["archive-files"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-files"] });
      toast({
        title: "✅ تم الاستعادة",
        description: "تم استعادة الملف بنجاح إلى الأرشيف",
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

  const permanentDeleteMutation = useMutation({
    mutationFn: async (fileId: string) => {
      // Avoid requiring SELECT on the deleted row in the response.
      const { error } = await supabase
        .from("files")
        .delete({ returning: "minimal" })
        .eq("id", fileId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deleted-files"] });
      toast({
        title: "🗑️ تم الحذف نهائياً",
        description: "تم حذف الملف نهائياً ولا يمكن استرجاعه",
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

  if (!canManage) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="w-12 h-12 text-warning mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">غير مصرح</h2>
            <p className="text-muted-foreground">هذه الصفحة متاحة للمدير فقط</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-lg" />
          <Skeleton className="h-8 w-32" />
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
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-destructive/10 rounded-lg flex items-center justify-center">
          <Trash2 className="w-5 h-5 text-destructive" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">سلة المحذوفات</h1>
          <p className="text-muted-foreground">الملفات المحذوفة مؤقتاً</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>الملفات المحذوفة ({deletedFiles?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {deletedFiles && deletedFiles.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>رقم الملف</TableHead>
                    <TableHead>الاسم الكامل</TableHead>
                    <TableHead>البلدية</TableHead>
                    <TableHead>تاريخ الحذف</TableHead>
                    <TableHead>الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deletedFiles.map((file) => (
                    <TableRow key={file.id}>
                      <TableCell className="font-medium">{file.file_number}</TableCell>
                      <TableCell>{file.full_name}</TableCell>
                      <TableCell>{file.municipality}</TableCell>
                      <TableCell>
                        {file.deleted_at
                          ? format(new Date(file.deleted_at), "d MMMM yyyy", { locale: ar })
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleAction(file, "restore")}
                            title="استعادة"
                            className="text-success hover:text-success hover:bg-success/10"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleAction(file, "delete")}
                            title="حذف نهائي"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
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
            <div className="text-center py-12 text-muted-foreground">
              <Trash2 className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>سلة المحذوفات فارغة</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!selectedFile && !!actionType} onOpenChange={() => { setSelectedFile(null); setActionType(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === "restore" ? "استعادة الملف" : "حذف نهائي"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === "restore"
                ? `هل تريد استعادة الملف رقم "${selectedFile?.file_number}" إلى الأرشيف؟`
                : `هل أنت متأكد من الحذف النهائي للملف رقم "${selectedFile?.file_number}"؟ هذا الإجراء لا يمكن التراجع عنه.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAction}
              className={actionType === "delete" ? "bg-destructive hover:bg-destructive/90" : "bg-success hover:bg-success/90"}
              disabled={restoreMutation.isPending || permanentDeleteMutation.isPending}
            >
              {(restoreMutation.isPending || permanentDeleteMutation.isPending) ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : actionType === "restore" ? (
                "استعادة"
              ) : (
                "حذف نهائي"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
